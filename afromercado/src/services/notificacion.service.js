const { enviarEmail } = require("../utils/email");
const { enviarMensajeWA } = require("../utils/whatsapp");
const { enviarPushAUsuario } = require("../utils/push");
const emailPedido = require("../utils/templates/email-pedido");
const prisma = require("../config/prisma");
const emailPago = require("../utils/templates/email-pago");
const sseManager = require("../utils/sse-manager");

async function crearNotificacionDB(usuarioId, { tipo, titulo, mensaje, url, datos }) {
  try {
    const notif = await prisma.notificacion.create({
      data: { usuarioId, tipo, titulo, mensaje, url: url || null, datos: datos || null },
    });
    sseManager.enviar(usuarioId, "notificacion", notif);
  } catch (e) {
    console.error("[NOTIF-DB]", e.message);
  }
}

function formatearPrecio(valor) {
  return `$${Number(valor || 0).toLocaleString("es-CO")} COP`;
}

function formatearProductos(items) {
  if (!Array.isArray(items)) return "";
  return items
    .map((it) => `• ${it.cantidad}x ${it.nombre || it.producto?.nombre || "Producto"} — ${formatearPrecio(it.subtotal)}`)
    .join("\n");
}

function primerNombre(nombre) {
  return (nombre || "").split(" ")[0] || nombre || "";
}

function mensajeNuevoPedido({ pedidoId, nombreComerciante, productosTexto, neto, comprador, direccion, notas }) {
  const lineas = [
    `¡Hola, ${primerNombre(nombreComerciante)}! 🎉 Tienes un nuevo pedido.`,
    ``,
    `*AfroMercado — Pedido #${pedidoId}*`,
    ``,
    `📦 *Productos:*`,
    productosTexto,
    ``,
    `💰 *Tu ganancia:* ${neto}`,
    ``,
    `📍 *Dirección de envío:*`,
    direccion || "No especificada",
    ``,
    `👤 *Comprador:* ${comprador.nombre || ""}`,
  ];
  if (comprador.telefono) lineas.push(`📞 ${comprador.telefono}`);
  if (notas) lineas.push(``, `📝 *Nota del comprador:* ${notas}`);
  lineas.push(``, `⏳ El pago está en verificación. Te avisamos cuando esté confirmado.`);
  return lineas.join("\n");
}

function mensajePagoConfirmado({ pedidoId, nombreComerciante, productosTexto, neto, comprador, direccion, notas }) {
  const lineas = [
    `✅ *¡Pago confirmado! — Pedido #${pedidoId}*`,
    ``,
    `Hola, ${primerNombre(nombreComerciante)}. Ya puedes preparar este pedido.`,
    ``,
    `📦 *Productos:*`,
    productosTexto,
    ``,
    `💰 *Tu ganancia:* ${neto}`,
    ``,
    `📍 *Dirección de envío:*`,
    direccion || "No especificada",
    ``,
    `👤 *Comprador:* ${comprador.nombre || ""}`,
  ];
  if (comprador.telefono) lineas.push(`📞 ${comprador.telefono}`);
  if (notas) lineas.push(``, `📝 *Nota del comprador:* ${notas}`);
  lineas.push(``, `Entra a tu panel en AfroMercado para gestionar el envío. 🌿`);
  return lineas.join("\n");
}

async function dispararNotificacion(fn, descripcion) {
  try {
    await fn();
  } catch (err) {
    console.error(`[NOTIF] Error en ${descripcion}:`, err.message);
  }
}

async function notificarAdmins({ tipo, titulo, mensaje, url, datos }) {
  try {
    const admins = await prisma.usuario.findMany({
      where: { rol: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      await crearNotificacionDB(admin.id, { tipo, titulo, mensaje, url, datos });
    }
  } catch (e) {
    console.error("[NOTIF-ADMINS]", e.message);
  }
}

const NotificacionService = {
  async checkoutCompletado({ pedido, comprador, comerciantes }) {
    const pedidoId = pedido.id;
    const totalFormateado = formatearPrecio(pedido.total);
    const productosTexto = (pedido.subPedidos || [])
      .flatMap((sp) => sp.items || [])
      .map((it) => `• ${it.cantidad}x ${it.producto?.nombre || "Producto"}`)
      .join("\n");

    // Notificación in-app al comprador
    await crearNotificacionDB(comprador.id, {
      tipo: "PEDIDO_CREADO",
      titulo: "Pedido registrado",
      mensaje: `Tu pedido #${pedidoId} fue recibido. Tienes tiempo para completar el pago.`,
      url: `/pedido/${pedidoId}`,
      datos: { pedidoId },
    });

    // Email al comprador
    await dispararNotificacion(() =>
      enviarEmail({
        to: comprador.email,
        subject: `Tu pedido #${pedidoId} fue recibido — AfroMercado`,
        html: emailPedido.pedidoCreado({
          nombreComprador: comprador.nombre,
          pedidoId,
          total: totalFormateado,
          productosTexto,
          expiresAt: pedido.expiresAt,
        }),
      }), "email comprador checkout");

    // WhatsApp al comprador
    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `Hola ${comprador.nombre} 👋\n\nTu pedido *#${pedidoId}* en AfroMercado quedó registrado.\n💰 Total: ${totalFormateado}\n\nSube el comprobante de pago en la app para que lo verifiquemos. 🌿`
        ), "WA comprador checkout");
    }

    // Notificar a cada comerciante
    for (const sp of (pedido.subPedidos || [])) {
      const comercio = comerciantes?.find((c) => c.id === sp.comercioId) || sp.comercio;
      if (!comercio) continue;

      const itemsComerciante = sp.items || [];
      const productosComercianteTexto = itemsComerciante
        .map((it) => `• ${it.cantidad}x ${it.producto?.nombre || "Producto"} — ${formatearPrecio(it.subtotal)}`)
        .join("\n");
      const neto = formatearPrecio(sp.neto);

      if (comercio.usuario?.id) {
        await crearNotificacionDB(comercio.usuario.id, {
          tipo: "NUEVO_PEDIDO",
          titulo: "Nuevo pedido recibido 🎉",
          mensaje: `Tienes un nuevo pedido #${pedidoId}. El pago está en verificación.`,
          url: `/comerciante/pedidos`,
          datos: { pedidoId },
        });
      }

      if (comercio.usuario?.email) {
        await dispararNotificacion(() =>
          enviarEmail({
            to: comercio.usuario.email,
            subject: `Nuevo pedido #${pedidoId} en tu tienda — AfroMercado`,
            html: emailPedido.pedidoComercianteNuevo({
              nombreComerciante: comercio.usuario.nombre,
              pedidoId,
              productosTexto: productosComercianteTexto,
              montoNeto: neto,
            }),
          }), `email comerciante ${comercio.id} checkout`);
      }

      const telComerciante = comercio.whatsapp || comercio.usuario?.telefono;
      if (telComerciante) {
        await dispararNotificacion(() =>
          enviarMensajeWA(telComerciante,
            mensajeNuevoPedido({
              pedidoId,
              nombreComerciante: comercio.usuario?.nombre || "Comerciante",
              productosTexto: productosComercianteTexto,
              neto,
              comprador: { nombre: comprador?.nombre, telefono: comprador?.telefono },
              direccion: pedido.direccionTexto,
              notas: pedido.notas,
            })
          ), `WA comerciante ${comercio.id} checkout`);
      }
    }
  },

  async comprobanteSubido({ pedido, comprador }) {
    const pedidoId = pedido.id;
    const monto = formatearPrecio(pedido.pagos?.[0]?.monto || pedido.total);

    // N-C-04: in-app al comprador
    if (comprador?.id) {
      await crearNotificacionDB(comprador.id, {
        tipo: "COMPROBANTE_ENVIADO",
        titulo: "Comprobante recibido ✅",
        mensaje: `Recibimos tu comprobante del pedido #${pedidoId}. Lo verificaremos en los próximos 30 minutos en días hábiles.`,
        url: `/mis-pedidos`,
        datos: { pedidoId },
      });
    }

    // N-A-01: in-app a todos los admins
    await notificarAdmins({
      tipo: "COMPROBANTE_A_VERIFICAR",
      titulo: "Comprobante pendiente de verificación",
      mensaje: `Pedido #${pedidoId} — ${monto} — ${comprador?.nombre || "Comprador"}. Verifica el pago.`,
      url: `/admin/pagos`,
      datos: { pedidoId },
    });

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await dispararNotificacion(() =>
        enviarEmail({
          to: adminEmail,
          subject: `[VERIFICAR] Comprobante pedido #${pedidoId} — AfroMercado`,
          html: emailPago.comprobanteSubido({
            pedidoId,
            nombreComprador: comprador?.nombre || "Comprador",
            monto,
          }),
        }), "email admin comprobante");
    }
  },

  async pagoAprobado({ pedido, comprador, comerciantes }) {
    const pedidoId = pedido.id;

    await crearNotificacionDB(comprador.id, {
      tipo: "PAGO_CONFIRMADO",
      titulo: "¡Pago confirmado!",
      mensaje: `Tu pago del pedido #${pedidoId} fue verificado. Los productores ya empiezan a prepararlo.`,
      url: `/mis-pedidos`,
      datos: { pedidoId },
    });

    await dispararNotificacion(() =>
      enviarEmail({
        to: comprador.email,
        subject: `Pago confirmado — Pedido #${pedidoId} en preparación`,
        html: emailPago.pagoAprobadoComprador({ nombreComprador: comprador.nombre, pedidoId }),
      }), "email comprador pago aprobado");

    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `¡Buenas noticias, ${comprador.nombre}! ✅\n\nTu pago del pedido *#${pedidoId}* fue verificado y confirmado.\n\nLos comerciantes ya están preparando tu pedido. 🌿`
        ), "WA comprador pago aprobado");
    }

    for (const sp of (pedido.subPedidos || [])) {
      const comercio = comerciantes?.find((c) => c.id === sp.comercioId) || sp.comercio;
      if (!comercio) continue;

      const itemsTexto = (sp.items || [])
        .map((it) => `• ${it.cantidad}x ${it.producto?.nombre || "Producto"} — ${formatearPrecio(it.subtotal)}`)
        .join("\n");
      const neto = formatearPrecio(sp.neto);

      if (comercio.usuario?.email) {
        await dispararNotificacion(() =>
          enviarEmail({
            to: comercio.usuario.email,
            subject: `¡Pago confirmado! Pedido #${pedidoId} listo para preparar`,
            html: emailPago.pagoAprobadoComerciante({
              nombreComerciante: comercio.usuario.nombre,
              pedidoId,
              productosTexto: itemsTexto,
              montoNeto: neto,
            }),
          }), `email comerciante ${comercio.id} pago aprobado`);
      }

      const tel = comercio.whatsapp || comercio.usuario?.telefono;
      if (tel) {
        await dispararNotificacion(() =>
          enviarMensajeWA(tel,
            mensajePagoConfirmado({
              pedidoId,
              nombreComerciante: comercio.usuario?.nombre || "Comerciante",
              productosTexto: itemsTexto,
              neto,
              comprador: { nombre: comprador?.nombre, telefono: comprador?.telefono },
              direccion: pedido.direccionTexto,
              notas: pedido.notas,
            })
          ), `WA comerciante ${comercio.id} pago aprobado`);
      }
    }
  },

  async pedidoListo({ pedidoId, comprador }) {
    await crearNotificacionDB(comprador.id, {
      tipo: "PEDIDO_LISTO",
      titulo: "Tu pedido está listo 📦",
      mensaje: `El pedido #${pedidoId} ya fue preparado y está esperando por ti.`,
      url: `/mis-pedidos`,
      datos: { pedidoId },
    });

    await dispararNotificacion(() =>
      enviarEmail({
        to: comprador.email,
        subject: `Tu pedido #${pedidoId} está listo para entrega — AfroMercado`,
        html: emailPedido.pedidoListo({ nombreComprador: comprador.nombre, pedidoId }),
      }), "email comprador pedido listo");

    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `¡Tu pedido está listo! 📦\n\nHola ${primerNombre(comprador.nombre)}, el pedido *#${pedidoId}* ya fue preparado y está esperando por ti.\n\nEl productor coordinará contigo el envío. ¡Gracias por apoyar a los productores locales! 🌿`
        ), "WA comprador pedido listo");
    }
  },

  async pedidoEntregado({ pedidoId, comprador }) {
    await crearNotificacionDB(comprador.id, {
      tipo: "PEDIDO_ENTREGADO",
      titulo: "¡Pedido entregado! ✅",
      mensaje: `Tu pedido #${pedidoId} fue entregado. ¿Quedaste satisfecho? Deja tu reseña.`,
      url: `/mis-pedidos`,
      datos: { pedidoId },
    });

    await dispararNotificacion(() =>
      enviarEmail({
        to: comprador.email,
        subject: `¡Pedido #${pedidoId} entregado! — AfroMercado`,
        html: emailPedido.pedidoEntregado({ nombreComprador: comprador.nombre, pedidoId }),
      }), "email comprador pedido entregado");

    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `¡Entregado! ✅\n\nHola ${primerNombre(comprador.nombre)}, tu pedido *#${pedidoId}* fue marcado como entregado.\n\n¿Todo llegó bien? Deja tu reseña en AfroMercado y apoya a los productores locales. 🌿`
        ), "WA comprador pedido entregado");
    }
  },

  async pagoRechazado({ pedido, comprador, motivo }) {
    const pedidoId = pedido.id;

    // N-C-06: in-app al comprador
    if (comprador?.id) {
      await crearNotificacionDB(comprador.id, {
        tipo: "PAGO_RECHAZADO",
        titulo: "Problema con tu pago",
        mensaje: motivo
          ? `No pudimos verificar tu pago del pedido #${pedidoId}. Motivo: ${motivo}`
          : `No pudimos verificar tu pago del pedido #${pedidoId}. Sube un nuevo comprobante o contáctanos.`,
        url: `/mis-pedidos`,
        datos: { pedidoId },
      });
    }

    await dispararNotificacion(() =>
      enviarEmail({
        to: comprador.email,
        subject: `Problema con tu pago — Pedido #${pedidoId}`,
        html: emailPago.pagoRechazado({ nombreComprador: comprador.nombre, pedidoId, motivo }),
      }), "email comprador pago rechazado");

    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `Hola ${comprador.nombre}, hubo un problema con el pago del pedido *#${pedidoId}*.\n\n${motivo || "El comprobante no pudo ser verificado."}\n\nPor favor sube un nuevo comprobante en la app o contáctanos. 🌿`
        ), "WA comprador pago rechazado");
    }
  },

  // N-C-09 comprador + N-V-07 comerciante
  async entregaRecogida({ pedidoId, comprador, comerciante }) {
    await crearNotificacionDB(comprador.id, {
      tipo: "ENTREGA_RECOGIDA",
      titulo: "El repartidor ya recogió tu pedido",
      mensaje: `El repartidor recogió los productos del pedido #${pedidoId} y viene en camino.`,
      url: `/mis-pedidos`,
      datos: { pedidoId },
    });
    if (comerciante?.usuarioId) {
      await crearNotificacionDB(comerciante.usuarioId, {
        tipo: "ENTREGA_RECOGIDA",
        titulo: "Repartidor recogió el pedido",
        mensaje: `El repartidor ya recogió el pedido #${pedidoId} de tu local.`,
        url: `/comerciante/pedidos`,
        datos: { pedidoId },
      });
    }
  },

  // N-C-10 comprador CRÍTICO (WA + Push)
  async entregaEnCamino({ pedidoId, comprador, repartidorNombre, direccion }) {
    await crearNotificacionDB(comprador.id, {
      tipo: "ENTREGA_EN_CAMINO",
      titulo: "🚴 ¡Tu pedido va en camino!",
      mensaje: `${repartidorNombre} está en camino con tu pedido #${pedidoId}. Prepárate para recibirlo.`,
      url: `/mis-pedidos`,
      datos: { pedidoId },
    });
    await enviarPushAUsuario(prisma, comprador.id, {
      titulo: "🚴 ¡Tu pedido va en camino!",
      cuerpo: `${repartidorNombre} está en camino. Prepárate para recibirlo.`,
      url: `/mis-pedidos`,
    });
    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `🚴 *¡Tu pedido va en camino!*\n\nHola ${primerNombre(comprador.nombre)}, el repartidor *${repartidorNombre}* está en camino con tu pedido *#${pedidoId}*.\n\nPrepárate para recibirlo en:\n📍 ${direccion || "tu dirección registrada"}\n\n¡Gracias por apoyar a los productores locales! 🌿`
        ), "WA comprador entrega en camino");
    }
  },

  // N-C-12 comprador + N-A-06 admin
  async entregaFallida({ pedidoId, comprador }) {
    await crearNotificacionDB(comprador.id, {
      tipo: "ENTREGA_FALLIDA",
      titulo: "Problema con tu entrega",
      mensaje: `Tuvimos un inconveniente entregando el pedido #${pedidoId}. Nuestro equipo te contactará pronto.`,
      url: `/mis-pedidos`,
      datos: { pedidoId },
    });
    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `Hola ${primerNombre(comprador.nombre)}, tuvimos un problema entregando tu pedido *#${pedidoId}*.\n\nNuestro equipo te contactará pronto para resolverlo. Disculpa los inconvenientes. 🌿`
        ), "WA comprador entrega fallida");
    }
    await notificarAdmins({
      tipo: "ENTREGA_FALLIDA_ADMIN",
      titulo: "Entrega fallida — requiere acción",
      mensaje: `Pedido #${pedidoId} marcado como FALLIDO. Coordina reentrega o reembolso.`,
      url: `/admin/entregas`,
      datos: { pedidoId },
    });
  },

  // N-V-08 comerciante — entrega completada
  async entregaCompletadaComerciante({ pedidoId, comerciante }) {
    if (!comerciante?.usuarioId) return;
    await crearNotificacionDB(comerciante.usuarioId, {
      tipo: "ENTREGA_COMPLETADA",
      titulo: "Entrega completada ✅",
      mensaje: `El pedido #${pedidoId} fue entregado al cliente. Los fondos serán liquidados según el acuerdo.`,
      url: `/comerciante/pedidos`,
      datos: { pedidoId },
    });
  },

  // N-R-04 repartidor — entrega asignada CRÍTICO (Push + WA)
  async entregaAsignada({ entregaId, pedidoId, repartidor, comercioNombre, comercioMunicipio, direccion }) {
    await enviarPushAUsuario(prisma, repartidor.id, {
      titulo: "🚴 Nueva entrega asignada",
      cuerpo: `Recoge en ${comercioNombre}. Pedido #${pedidoId}.`,
      url: `/repartidor`,
    });
    await crearNotificacionDB(repartidor.id, {
      tipo: "ENTREGA_ASIGNADA",
      titulo: "Nueva entrega asignada 🚴",
      mensaje: `Recoge en ${comercioNombre}${comercioMunicipio ? ` — ${comercioMunicipio}` : ""}. Pedido #${pedidoId}.`,
      url: `/repartidor`,
      datos: { entregaId, pedidoId },
    });
    if (repartidor.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(repartidor.telefono,
          `🚴 *Nueva entrega asignada — AfroMercado*\n\n📦 Pedido #${pedidoId}\n🏪 Recoge en: *${comercioNombre}*${comercioMunicipio ? ` — ${comercioMunicipio}` : ""}\n📍 Entrega en: ${direccion || "ver en la app"}\n\nEntra a la app para ver los detalles.`
        ), "WA repartidor entrega asignada");
    }
  },

  // N-R-01 usuario + N-A-04 admin — solicitud enviada
  async solicitudRepartidorCreada({ usuarioId, usuarioNombre }) {
    await crearNotificacionDB(usuarioId, {
      tipo: "SOLICITUD_REPARTIDOR_CREADA",
      titulo: "Solicitud recibida",
      mensaje: "Recibimos tu solicitud para ser repartidor. La revisaremos en 2–3 días hábiles.",
      url: `/ser-repartidor`,
      datos: {},
    });
    await notificarAdmins({
      tipo: "NUEVA_SOLICITUD_REPARTIDOR",
      titulo: "Nueva solicitud de repartidor",
      mensaje: `${usuarioNombre} quiere ser repartidor. Revisa el vehículo y la licencia.`,
      url: `/admin/solicitudes-repartidor`,
      datos: { usuarioId },
    });
  },

  // N-R-02 — solicitud aprobada CRÍTICO (Push + WA)
  async solicitudRepartidorAprobada({ usuario }) {
    await enviarPushAUsuario(prisma, usuario.id, {
      titulo: "¡Solicitud aprobada! 🎉",
      cuerpo: "Ya eres repartidor oficial de AfroMercado. ¡Bienvenido al equipo!",
      url: `/repartidor`,
    });
    await crearNotificacionDB(usuario.id, {
      tipo: "SOLICITUD_REPARTIDOR_APROBADA",
      titulo: "¡Solicitud aprobada! 🎉",
      mensaje: "Tu solicitud fue aprobada. Ya eres repartidor oficial de AfroMercado. ¡Bienvenido al equipo!",
      url: `/repartidor`,
      datos: {},
    });
    if (usuario.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(usuario.telefono,
          `¡Felicitaciones, ${primerNombre(usuario.nombre)}! 🎉🚴\n\nTu solicitud para ser repartidor de *AfroMercado* fue *aprobada*.\n\nYa puedes ingresar al panel de repartidor en la app y empezar a recibir entregas. ¡Bienvenido al equipo! 🌿`
        ), "WA solicitud repartidor aprobada");
    }
  },

  // N-R-03 — solicitud rechazada
  async solicitudRepartidorRechazada({ usuario, notasAdmin }) {
    await crearNotificacionDB(usuario.id, {
      tipo: "SOLICITUD_REPARTIDOR_RECHAZADA",
      titulo: "Solicitud no aprobada",
      mensaje: notasAdmin
        ? `Tu solicitud no fue aprobada. Motivo: ${notasAdmin}. Puedes corregir los datos y volver a aplicar.`
        : "Tu solicitud no fue aprobada. Puedes corregir los datos y volver a aplicar.",
      url: `/ser-repartidor`,
      datos: {},
    });
    if (usuario.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(usuario.telefono,
          `Hola ${primerNombre(usuario.nombre)}, lamentablemente tu solicitud de repartidor *no fue aprobada*.\n\n${notasAdmin ? `Motivo: ${notasAdmin}\n\n` : ""}Puedes corregir los datos y volver a aplicar en la app. 🌿`
        ), "WA solicitud repartidor rechazada");
    }
  },

  // Método genérico: crea notificación en BD y la envía por SSE.
  // Acepta tanto un objeto { usuarioId, tipo, titulo, mensaje, pedidoId, comercioId }
  // como parámetros posicionales (usuarioId, tipo, titulo, mensaje, { pedidoId, comercioId }).
  async crearYEnviar(usuarioIdOrObj, tipo, titulo, mensaje, { pedidoId, comercioId } = {}) {
    try {
      let uid, t, tit, msg, pid, cid;
      if (typeof usuarioIdOrObj === "object" && usuarioIdOrObj !== null) {
        ({ usuarioId: uid, tipo: t, titulo: tit, mensaje: msg, pedidoId: pid, comercioId: cid } = usuarioIdOrObj);
      } else {
        uid = usuarioIdOrObj; t = tipo; tit = titulo; msg = mensaje; pid = pedidoId; cid = comercioId;
      }
      const datos = {};
      if (pid !== undefined) datos.pedidoId = pid;
      if (cid !== undefined) datos.comercioId = cid;
      const notif = await prisma.notificacion.create({
        data: {
          usuarioId: uid,
          tipo: t,
          titulo: tit,
          mensaje: msg,
          datos: Object.keys(datos).length ? datos : null,
        },
      });
      sseManager.enviar(uid, "notificacion", notif);
      return notif;
    } catch (e) {
      console.error("[NOTIF] crearYEnviar:", e.message);
    }
  },

  // Notificación in-app al comerciante cuando recibe un pedido nuevo
  async pedidoNuevoComercio(comercioId, pedidoId, compradorNombre, subtotal) {
    try {
      const comercio = await prisma.comercio.findUnique({
        where: { id: Number(comercioId) },
        select: { usuarioId: true },
      });
      if (!comercio?.usuarioId) return;
      const montoFormateado = formatearPrecio(subtotal);
      await crearNotificacionDB(comercio.usuarioId, {
        tipo: "PEDIDO_NUEVO",
        titulo: "Nuevo pedido recibido",
        mensaje: `${compradorNombre} acaba de realizar un pedido por ${montoFormateado}`,
        url: `/comerciante/pedidos`,
        datos: { pedidoId, comercioId },
      });
    } catch (e) {
      console.error("[NOTIF] pedidoNuevoComercio:", e.message);
    }
  },

  // N-V-02 — comercio verificado CRÍTICO
  async comercioVerificado({ comercio, usuario }) {
    await crearNotificacionDB(usuario.id, {
      tipo: "COMERCIO_VERIFICADO",
      titulo: "¡Tu comercio fue verificado! 🌿",
      mensaje: `${comercio.nombre} está verificado en AfroMercado. Ya puedes publicar productos y comenzar a vender.`,
      url: `/comerciante`,
      datos: { comercioId: comercio.id },
    });
    if (usuario.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(usuario.telefono,
          `¡Felicitaciones, ${primerNombre(usuario.nombre)}! 🎉🌿\n\nTu comercio *${comercio.nombre}* fue *verificado* en AfroMercado.\n\nYa puedes publicar tus productos y comenzar a recibir pedidos. ¡Mucho éxito!`
        ), "WA comercio verificado");
    }
  },

  // Cultura — evento pospuesto o cancelado: avisa a cada comprador con reserva activa
  async eventoCulturalCambioEstado({ evento, estado, compradores }) {
    const titulo = evento.titulo;
    const esPospuesto = estado === "POSPUESTO";
    const mensaje = esPospuesto
      ? `El evento "${titulo}" fue pospuesto. Te avisaremos la nueva fecha.`
      : `El evento "${titulo}" fue cancelado. Contáctanos para tu reembolso si ya pagaste.`;
    const mensajeWA = esPospuesto
      ? `📅 *Evento pospuesto*\n\nHola, el evento *"${titulo}"* fue pospuesto. Te avisaremos la nueva fecha por AfroMercado.`
      : `⚠️ *Evento cancelado*\n\nHola, el evento *"${titulo}"* fue cancelado.\n\nSi ya pagaste tu entrada, contáctanos para gestionar tu reembolso.`;

    for (const comprador of compradores || []) {
      if (!comprador?.id) continue;
      await crearNotificacionDB(comprador.id, {
        tipo: esPospuesto ? "EVENTO_CULTURAL_POSPUESTO" : "EVENTO_CULTURAL_CANCELADO",
        titulo: esPospuesto ? "Evento pospuesto" : "Evento cancelado",
        mensaje,
        url: `/cultura/${evento.id}`,
        datos: { eventoCulturalId: evento.id },
      });
      if (comprador.telefono) {
        await dispararNotificacion(() =>
          enviarMensajeWA(comprador.telefono, mensajeWA), `WA comprador ${comprador.id} evento cultural ${estado.toLowerCase()}`);
      }
    }
  },
};

module.exports = NotificacionService;
