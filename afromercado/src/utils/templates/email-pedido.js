const { base } = require("./email-base");

function pedidoCreado({ nombreComprador, pedidoId, total, productosTexto, expiresAt }) {
  const hora = expiresAt ? new Date(expiresAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "30 minutos";
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">Hola ${nombreComprador},</h2>
    <p style="color:#555;line-height:1.6;">Tu pedido en AfroMercado quedó registrado. Tienes hasta las <strong>${hora}</strong> para completar el pago.</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong style="color:#2D6A4F;">Pedido #</strong></td><td style="text-align:right;font-weight:700;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;"><strong>Total</strong></td><td style="text-align:right;padding-top:8px;">${total}</td></tr>
    </table>
    <p style="color:#555;"><strong>Productos:</strong><br>${productosTexto}</p>
    <p style="color:#555;line-height:1.6;">Una vez realices el pago, sube el comprobante en la aplicación y nuestro equipo lo verificará en minutos.</p>
    <p style="color:#888;font-size:13px;">Si no puedes pagar ahora, el pedido se cancelará automáticamente sin cargo.</p>`;
  return base(contenido, `Pedido #${pedidoId} recibido — AfroMercado`);
}

function pedidoComercianteNuevo({ nombreComerciante, pedidoId, productosTexto, montoNeto }) {
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">¡Llegó un pedido, ${nombreComerciante}!</h2>
    <p style="color:#555;line-height:1.6;">Tienes un nuevo pedido en tu tienda. El pago está en verificación — te avisamos cuando esté confirmado para que lo prepares.</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong style="color:#2D6A4F;">Pedido #</strong></td><td style="text-align:right;font-weight:700;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;"><strong>Tu ganancia neta</strong></td><td style="text-align:right;padding-top:8px;font-weight:700;color:#2D6A4F;">${montoNeto}</td></tr>
    </table>
    <p style="color:#555;"><strong>Productos pedidos:</strong><br>${productosTexto}</p>`;
  return base(contenido, `Nuevo pedido #${pedidoId} en tu tienda — AfroMercado`);
}

module.exports = { pedidoCreado, pedidoComercianteNuevo };
