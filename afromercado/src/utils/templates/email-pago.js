const { base } = require("./email-base");

function comprobanteSubido({ pedidoId, nombreComprador, monto }) {
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">⚡ Nuevo comprobante por verificar</h2>
    <p style="color:#555;">Hay un pago pendiente de revisión en el panel de administración.</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong>Pedido #</strong></td><td style="text-align:right;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;"><strong>Comprador</strong></td><td style="text-align:right;padding-top:8px;">${nombreComprador}</td></tr>
      <tr><td style="padding-top:8px;"><strong>Monto</strong></td><td style="text-align:right;padding-top:8px;font-weight:700;">${monto}</td></tr>
    </table>
    <p style="color:#555;">Accede al panel de administración para aprobar o rechazar el pago.</p>`;
  return base(contenido, `[VERIFICAR] Comprobante pedido #${pedidoId} — AfroMercado`);
}

function pagoAprobadoComprador({ nombreComprador, pedidoId }) {
  const contenido = `
    <h2 style="color:#2D6A4F;font-size:20px;margin-top:0;">✅ ¡Pago confirmado!</h2>
    <p style="color:#555;line-height:1.6;">Hola ${nombreComprador}, tu pago del pedido <strong>#${pedidoId}</strong> fue verificado y confirmado exitosamente.</p>
    <p style="color:#555;line-height:1.6;">Los comerciantes ya están preparando tus productos. Te notificaremos cuando estén en camino.</p>
    <p style="color:#888;font-size:13px;">¡Gracias por apoyar a los comerciantes locales! 🌿</p>`;
  return base(contenido, `Pago confirmado — Pedido #${pedidoId} en preparación`);
}

function pagoAprobadoComerciante({ nombreComerciante, pedidoId, productosTexto, montoNeto }) {
  const contenido = `
    <h2 style="color:#2D6A4F;font-size:20px;margin-top:0;">🟢 ¡El pago fue confirmado!</h2>
    <p style="color:#555;line-height:1.6;">Hola ${nombreComerciante}, el pago del pedido <strong>#${pedidoId}</strong> fue verificado. ¡Ya puedes empezar a prepararlo!</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong>Pedido #</strong></td><td style="text-align:right;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;"><strong>Tu pago neto</strong></td><td style="text-align:right;padding-top:8px;font-weight:700;color:#2D6A4F;">${montoNeto}</td></tr>
    </table>
    <p style="color:#555;"><strong>Productos a preparar:</strong><br>${productosTexto}</p>`;
  return base(contenido, `¡Pago confirmado! Pedido #${pedidoId} listo para preparar`);
}

function pagoRechazado({ nombreComprador, pedidoId, motivo }) {
  const contenido = `
    <h2 style="color:#C0392B;font-size:20px;margin-top:0;">Problema con tu pago</h2>
    <p style="color:#555;line-height:1.6;">Hola ${nombreComprador}, revisamos el comprobante del pedido <strong>#${pedidoId}</strong> y encontramos un problema.</p>
    ${motivo ? `<p style="color:#555;background:#fff3f3;padding:12px;border-radius:8px;border-left:3px solid #C0392B;"><strong>Motivo:</strong> ${motivo}</p>` : ""}
    <p style="color:#555;line-height:1.6;">Puedes subir un nuevo comprobante en la aplicación. El stock sigue reservado por un tiempo.</p>
    <p style="color:#888;font-size:13px;">Si necesitas ayuda, responde a este correo o escríbenos por WhatsApp.</p>`;
  return base(contenido, `Problema con tu pago — Pedido #${pedidoId}`);
}

module.exports = { comprobanteSubido, pagoAprobadoComprador, pagoAprobadoComerciante, pagoRechazado };
