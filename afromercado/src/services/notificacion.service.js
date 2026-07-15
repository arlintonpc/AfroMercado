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
    `*Teravia — Pedido #${pedidoId}*`,
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
  lineas.push(``, `Entra a tu panel en Teravia para gestionar el envío. 🌿`);
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
        subject: `Tu pedido #${pedidoId} fue recibido — Teravia`,
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
          `Hola ${comprador.nombre} 👋\n\nTu pedido *#${pedidoId}* en Teravia quedó registrado.\n💰 Total: ${totalFormateado}\n\nSube el comprobante de pago en la app para que lo verifiquemos. 🌿`
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
            subject: `Nuevo pedido #${pedidoId} en tu tienda — Teravia`,
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
          subject: `[VERIFICAR] Comprobante pedido #${pedidoId} — Teravia`,
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
        subject: `Tu pedido #${pedidoId} está listo para entrega — Teravia`,
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
        subject: `¡Pedido #${pedidoId} entregado! — Teravia`,
        html: emailPedido.pedidoEntregado({ nombreComprador: comprador.nombre, pedidoId }),
      }), "email comprador pedido entregado");

    if (comprador.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(comprador.telefono,
          `¡Entregado! ✅\n\nHola ${primerNombre(comprador.nombre)}, tu pedido *#${pedidoId}* fue marcado como entregado.\n\n¿Todo llegó bien? Deja tu reseña en Teravia y apoya a los productores locales. 🌿`
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
          `🚴 *Nueva entrega asignada — Teravia*\n\n📦 Pedido #${pedidoId}\n🏪 Recoge en: *${comercioNombre}*${comercioMunicipio ? ` — ${comercioMunicipio}` : ""}\n📍 Entrega en: ${direccion || "ver en la app"}\n\nEntra a la app para ver los detalles.`
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
      cuerpo: "Ya eres repartidor oficial de Teravia. ¡Bienvenido al equipo!",
      url: `/repartidor`,
    });
    await crearNotificacionDB(usuario.id, {
      tipo: "SOLICITUD_REPARTIDOR_APROBADA",
      titulo: "¡Solicitud aprobada! 🎉",
      mensaje: "Tu solicitud fue aprobada. Ya eres repartidor oficial de Teravia. ¡Bienvenido al equipo!",
      url: `/repartidor`,
      datos: {},
    });
    if (usuario.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(usuario.telefono,
          `¡Felicitaciones, ${primerNombre(usuario.nombre)}! 🎉🚴\n\nTu solicitud para ser repartidor de *Teravia* fue *aprobada*.\n\nYa puedes ingresar al panel de repartidor en la app y empezar a recibir entregas. ¡Bienvenido al equipo! 🌿`
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
  async crearYEnviar(usuarioIdOrObj, tipo, titulo, mensaje, { pedidoId, comercioId, ...extra } = {}) {
    try {
      let uid, t, tit, msg, pid, cid, datosExtra;
      if (typeof usuarioIdOrObj === "object" && usuarioIdOrObj !== null) {
        ({ usuarioId: uid, tipo: t, titulo: tit, mensaje: msg, pedidoId: pid, comercioId: cid, ...datosExtra } = usuarioIdOrObj);
      } else {
        uid = usuarioIdOrObj; t = tipo; tit = titulo; msg = mensaje; pid = pedidoId; cid = comercioId; datosExtra = extra;
      }
      const datos = { ...datosExtra };
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
      mensaje: `${comercio.nombre} está verificado en Teravia. Ya puedes publicar productos y comenzar a vender.`,
      url: `/comerciante`,
      datos: { comercioId: comercio.id },
    });
    if (usuario.telefono) {
      await dispararNotificacion(() =>
        enviarMensajeWA(usuario.telefono,
          `¡Felicitaciones, ${primerNombre(usuario.nombre)}! 🎉🌿\n\nTu comercio *${comercio.nombre}* fue *verificado* en Teravia.\n\nYa puedes publicar tus productos y comenzar a recibir pedidos. ¡Mucho éxito!`
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
      ? `📅 *Evento pospuesto*\n\nHola, el evento *"${titulo}"* fue pospuesto. Te avisaremos la nueva fecha por Teravia.`
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

  // Disputas — reclamo nuevo: avisa al comercio y a los admins
  async disputaCreada({ disputa }) {
    const comercio = await prisma.comercio.findUnique({
      where: { id: disputa.comercioId },
      select: { usuarioId: true, nombre: true },
    });
    if (!comercio) return;

    await this.crearYEnviar({
      usuarioId: comercio.usuarioId,
      tipo: "DISPUTA_CREADA",
      titulo: "Tienes un reclamo nuevo",
      mensaje: "Un comprador reportó un problema con una compra. Tienes 48 horas para responder antes de que un administrador decida.",
      url: "/comerciante/disputas",
    });

    await notificarAdmins({
      tipo: "DISPUTA_CREADA_ADMIN",
      titulo: "Nuevo reclamo",
      mensaje: `Nuevo reclamo #${disputa.id} contra ${comercio.nombre}.`,
      url: "/admin/disputas",
    });
  },

  // Disputas — el comercio ya respondió: avisa al comprador
  async disputaRespondidaComercio({ disputa }) {
    await this.crearYEnviar({
      usuarioId: disputa.compradorId,
      tipo: "DISPUTA_RESPONDIDA",
      titulo: "El comercio respondió tu reclamo",
      mensaje: "El comercio ya dio su versión. Un administrador revisará tu caso.",
      url: "/mis-disputas",
    });
  },

  // Disputas — el admin ya resolvió: avisa a comprador y comercio
  async disputaResuelta({ disputa }) {
    const comercio = await prisma.comercio.findUnique({
      where: { id: disputa.comercioId },
      select: { usuarioId: true, nombre: true },
    });

    let mensajeComprador;
    if (disputa.estado === "RESUELTA_RECHAZADA") {
      mensajeComprador = "Tu reclamo fue revisado y no fue aprobado.";
      if (disputa.resolucion) mensajeComprador += ` ${disputa.resolucion}`;
    } else if (["RESUELTA_REEMBOLSO_TOTAL", "RESUELTA_REEMBOLSO_PARCIAL"].includes(disputa.estado)) {
      mensajeComprador = `Se aprobó tu reembolso por $${disputa.montoReembolsoAprobado}. Un administrador te transferirá el dinero manualmente en los próximos días — recibirás otra notificación cuando se confirme.`;
    }
    if (mensajeComprador) {
      await this.crearYEnviar({
        usuarioId: disputa.compradorId,
        tipo: "DISPUTA_RESUELTA",
        titulo: "Tu reclamo fue resuelto",
        mensaje: mensajeComprador,
        url: "/mis-disputas",
      });
    }

    if (comercio) {
      let mensajeComercio = `Tu reclamo #${disputa.id} fue resuelto.`;
      if (["RESUELTA_REEMBOLSO_TOTAL", "RESUELTA_REEMBOLSO_PARCIAL"].includes(disputa.estado)) {
        mensajeComercio += ` Se descontará $${disputa.montoDescuentoComercio} de tu próxima liquidación.`;
      }
      await this.crearYEnviar({
        usuarioId: comercio.usuarioId,
        tipo: "DISPUTA_RESUELTA",
        titulo: "Reclamo resuelto",
        mensaje: mensajeComercio,
        url: "/comerciante/disputas",
      });
    }
  },

  // Job de reintento de dispersiones — alerta al admin tras agotar los reintentos automáticos
  async dispersionFallidaAdmin({ pagoId, comercioNombre, intentos }) {
    await notificarAdmins({
      tipo: "DISPERSION_FALLIDA_ADMIN",
      titulo: "Dispersión de pago sin resolver",
      mensaje: `El pago #${pagoId} (comercio: ${comercioNombre || "desconocido"}) lleva ${intentos} intentos fallidos de dispersión. El comprador ya pagó — requiere intervención manual.`,
      url: "/admin/pagos",
      datos: { pagoId },
    });
  },

  // PQRSD — nuevo ticket dirigido a la plataforma (no a un comercio)
  async pqrsdCreado({ pqrsd }) {
    await notificarAdmins({
      tipo: "PQRSD_CREADO_ADMIN",
      titulo: `Nuevo ${pqrsd.tipo.toLowerCase()}`,
      mensaje: `${pqrsd.nombreContacto}: ${pqrsd.asunto}`,
      url: "/admin/pqrsd",
      datos: { pqrsdId: pqrsd.id },
    });
  },

  // Stock bajo (Fase 5.3) — avisa al comerciante cuando un producto cruza su stockMinimo
  async stockBajo({ comercioId, producto }) {
    const comercio = await prisma.comercio.findUnique({ where: { id: comercioId }, select: { usuarioId: true } });
    if (!comercio) return;
    await this.crearYEnviar({
      usuarioId: comercio.usuarioId,
      tipo: "STOCK_BAJO",
      titulo: "Stock bajo",
      mensaje: `"${producto.nombre}" quedó con ${producto.stock} unidad(es) — por debajo de tu mínimo configurado.`,
      url: "/comerciante/mis-productos",
    });
  },

  // PQRSD — el admin respondió: avisa al usuario (in-app si tiene cuenta, siempre por email)
  async pqrsdRespondido({ pqrsd }) {
    if (pqrsd.usuarioId) {
      await this.crearYEnviar({
        usuarioId: pqrsd.usuarioId,
        tipo: "PQRSD_RESPONDIDO",
        titulo: "Respondimos tu mensaje",
        mensaje: `Sobre "${pqrsd.asunto}": ${pqrsd.respuesta}`,
        url: "/mis-pqrsd",
      });
    }
    await dispararNotificacion(() =>
      enviarEmail({
        to: pqrsd.emailContacto,
        subject: `Respuesta a tu mensaje — ${pqrsd.asunto}`,
        html: `<p>Hola ${pqrsd.nombreContacto},</p><p>Sobre tu mensaje "<strong>${pqrsd.asunto}</strong>":</p><p>${pqrsd.respuesta}</p><p>— Equipo Teravia</p>`,
      }), "email PQRSD respondido");
  },

  // Empleo (Fase 6) — nueva oferta creada, requiere moderación admin
  async ofertaEmpleoCreada({ oferta }) {
    await notificarAdmins({
      tipo: "OFERTA_EMPLEO_CREADA_ADMIN",
      titulo: "Nueva oferta de empleo por moderar",
      mensaje: `"${oferta.titulo}" en ${oferta.municipio} espera revisión.`,
      url: "/admin/empleo",
      datos: { ofertaId: oferta.id },
    });
  },

  // Empleo — el admin aprobó/rechazó: avisa a quien publicó
  async ofertaEmpleoModerada({ oferta }) {
    const aprobada = oferta.estadoModeracion === "APROBADA";
    await this.crearYEnviar({
      usuarioId: oferta.publicadoPorId,
      tipo: "OFERTA_EMPLEO_MODERADA",
      titulo: aprobada ? "Tu oferta de empleo fue aprobada" : "Tu oferta de empleo no fue aprobada",
      mensaje: aprobada
        ? `"${oferta.titulo}" ya está visible para postulantes.`
        : `"${oferta.titulo}" no fue aprobada.${oferta.motivoRechazoModeracion ? ` Motivo: ${oferta.motivoRechazoModeracion}` : ""}`,
      url: "/empleo/mis-ofertas",
    });
  },

  // Empleo — nueva postulación recibida: avisa a quien publicó
  async nuevaPostulacionEmpleo({ oferta }) {
    await this.crearYEnviar({
      usuarioId: oferta.publicadoPorId,
      tipo: "NUEVA_POSTULACION_EMPLEO",
      titulo: "Nueva postulación",
      mensaje: `Alguien se postuló a "${oferta.titulo}".`,
      url: "/empleo/mis-ofertas",
    });
  },

  // Empleo — se llenaron las vacantes y la oferta se cerró sola: avisa a quien publicó
  async ofertaEmpleoVacantesLlenas({ oferta }) {
    await this.crearYEnviar({
      usuarioId: oferta.publicadoPorId,
      tipo: "OFERTA_EMPLEO_VACANTES_LLENAS",
      titulo: "Tu oferta se cerró automáticamente",
      mensaje: `"${oferta.titulo}" ya cubrió sus vacantes, así que se cerró para nuevas postulaciones.`,
      url: "/empleo/mis-ofertas",
    });
  },

  // Empleo — cambio de estado de postulación: avisa al postulante
  async postulacionEmpleoActualizada({ postulacion, postulanteId }) {
    const ESTADO_MSG = {
      PRESELECCIONADO: "Fuiste preseleccionado",
      RECHAZADA: "Tu postulación no fue seleccionada",
      CONTRATADO: "¡Fuiste contratado!",
    };
    const mensaje = ESTADO_MSG[postulacion.estado];
    if (!mensaje) return;
    await this.crearYEnviar({
      usuarioId: postulanteId,
      tipo: "POSTULACION_EMPLEO_ACTUALIZADA",
      titulo: mensaje,
      mensaje: "Revisa el detalle en tus postulaciones.",
      url: "/empleo/mis-postulaciones",
    });
  },

  // Empleo — nueva denuncia de una oferta: avisa a los admins
  async denunciaOfertaEmpleoCreada({ denuncia, oferta }) {
    await notificarAdmins({
      tipo: "DENUNCIA_OFERTA_EMPLEO_CREADA_ADMIN",
      titulo: "Nueva denuncia de oferta de empleo",
      mensaje: `"${oferta.titulo}" fue denunciada. Motivo: ${denuncia.motivo}.`,
      url: "/admin/empleo",
      datos: { ofertaId: oferta.id, denunciaId: denuncia.id },
    });
  },

  // Empleo — el admin bloqueó la oferta tras validar una denuncia: avisa a quien publicó.
  // Distinto del mensaje de "no aprobada" de moderación inicial (ofertaEmpleoModerada) —
  // aquí la oferta ya estaba publicada y se retira por una denuncia validada.
  async ofertaEmpleoBloqueadaPorDenuncia({ oferta, motivo }) {
    await this.crearYEnviar({
      usuarioId: oferta.publicadoPorId,
      tipo: "OFERTA_EMPLEO_BLOQUEADA_DENUNCIA",
      titulo: "Tu oferta de empleo fue retirada",
      mensaje: `"${oferta.titulo}" fue retirada tras revisar una denuncia recibida.${motivo ? ` Motivo: ${motivo}` : ""}`,
      url: "/empleo/mis-ofertas",
    });
  },

  // Empleo — el admin bloqueó la cuenta completa tras validar una denuncia.
  // Nota: si la cuenta ya quedó activo=false, el usuario no podrá ver esta
  // notificación in-app (el middleware `autenticar` lo bloquea) — se crea
  // igual en la BD por completitud/auditoría, pero no es el canal efectivo.
  async cuentaBloqueadaPorDenuncia({ usuarioId, motivo }) {
    await this.crearYEnviar({
      usuarioId,
      tipo: "CUENTA_BLOQUEADA_DENUNCIA",
      titulo: "Tu cuenta fue bloqueada",
      mensaje: `Tu cuenta fue bloqueada tras revisar una denuncia sobre una de tus ofertas de empleo.${motivo ? ` Motivo: ${motivo}` : ""}`,
      url: "/",
    });
  },

  // AfroMedia — nueva solicitud de publicidad (incluye Video Historia): avisa a los admins
  async solicitudPublicidadCreada({ solicitud, comercioNombre }) {
    await notificarAdmins({
      tipo: "SOLICITUD_PUBLICIDAD_CREADA_ADMIN",
      titulo: "Nueva solicitud de publicidad",
      mensaje: `${comercioNombre || "Un comercio"} solicitó "${solicitud.paquete}"${solicitud.objetivo ? ` — ${solicitud.objetivo}` : ""}.`,
      url: "/admin/afromedia",
      datos: { solicitudId: solicitud.id },
    });
  },

  // Alianzas comerciales — nueva alianza pendiente de aprobación: avisa a los admins
  async alianzaCreada({ alianza }) {
    await notificarAdmins({
      tipo: "ALIANZA_CREADA_ADMIN",
      titulo: "Nueva alianza comercial pendiente",
      mensaje: `"${alianza.nombre}" (código ${alianza.codigoCompartido}) espera aprobación.`,
      url: "/admin/alianzas",
      datos: { alianzaId: alianza.id },
    });
  },
};

module.exports = NotificacionService;
