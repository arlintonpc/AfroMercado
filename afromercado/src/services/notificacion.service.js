const { enviarEmail } = require("../utils/email");
const { enviarMensajeWA } = require("../utils/whatsapp");
const emailPedido = require("../utils/templates/email-pedido");
const emailPago = require("../utils/templates/email-pago");

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

const NotificacionService = {
  async checkoutCompletado({ pedido, comprador, comerciantes }) {
    const pedidoId = pedido.id;
    const totalFormateado = formatearPrecio(pedido.total);
    const productosTexto = (pedido.subPedidos || [])
      .flatMap((sp) => sp.items || [])
      .map((it) => `• ${it.cantidad}x ${it.producto?.nombre || "Producto"}`)
      .join("\n");

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
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const monto = formatearPrecio(pedido.pagos?.[0]?.monto || pedido.total);
    await dispararNotificacion(() =>
      enviarEmail({
        to: adminEmail,
        subject: `[VERIFICAR] Comprobante pedido #${pedido.id} — AfroMercado`,
        html: emailPago.comprobanteSubido({
          pedidoId: pedido.id,
          nombreComprador: comprador?.nombre || "Comprador",
          monto,
        }),
      }), "email admin comprobante");
  },

  async pagoAprobado({ pedido, comprador, comerciantes }) {
    const pedidoId = pedido.id;

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

  async pagoRechazado({ pedido, comprador, motivo }) {
    const pedidoId = pedido.id;

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
};

module.exports = NotificacionService;
