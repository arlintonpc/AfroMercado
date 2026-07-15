const { base } = require("./email-base");

function pedidoCreado({ nombreComprador, pedidoId, total, productosTexto, expiresAt }) {
  const hora = expiresAt ? new Date(expiresAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "30 minutos";
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">Hola ${nombreComprador},</h2>
    <p style="color:#555;line-height:1.6;">Tu pedido en Teravia quedó registrado. Tienes hasta las <strong>${hora}</strong> para completar el pago.</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong style="color:#2D6A4F;">Pedido #</strong></td><td style="text-align:right;font-weight:700;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;"><strong>Total</strong></td><td style="text-align:right;padding-top:8px;">${total}</td></tr>
    </table>
    <p style="color:#555;"><strong>Productos:</strong><br>${productosTexto}</p>
    <p style="color:#555;line-height:1.6;">Una vez realices el pago, sube el comprobante en la aplicación y nuestro equipo lo verificará en minutos.</p>
    <p style="color:#888;font-size:13px;">Si no puedes pagar ahora, el pedido se cancelará automáticamente sin cargo.</p>`;
  return base(contenido, `Pedido #${pedidoId} recibido — Teravia`);
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
  return base(contenido, `Nuevo pedido #${pedidoId} en tu tienda — Teravia`);
}

function pedidoListo({ nombreComprador, pedidoId }) {
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">¡Tu pedido está listo, ${nombreComprador}!</h2>
    <p style="color:#555;line-height:1.6;">El productor ya preparó tu pedido <strong>#${pedidoId}</strong> y está listo para la entrega. En breve coordinarán contigo el envío.</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong style="color:#2D6A4F;">Pedido #</strong></td><td style="text-align:right;font-weight:700;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;">Estado</td><td style="text-align:right;padding-top:8px;font-weight:700;color:#2D6A4F;">Listo para entrega 📦</td></tr>
    </table>
    <p style="color:#555;line-height:1.6;">Puedes hacer seguimiento desde <strong>Mis pedidos</strong> en la app. ¡Gracias por apoyar a los productores locales! 🌿</p>`;
  return base(contenido, `Pedido #${pedidoId} listo para entrega — Teravia`);
}

function pedidoEntregado({ nombreComprador, pedidoId }) {
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">¡Pedido entregado, ${nombreComprador}!</h2>
    <p style="color:#555;line-height:1.6;">Tu pedido <strong>#${pedidoId}</strong> fue marcado como entregado. ¡Esperamos que todo haya llegado perfecto!</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;">
      <tr><td><strong style="color:#2D6A4F;">Pedido #</strong></td><td style="text-align:right;font-weight:700;">${pedidoId}</td></tr>
      <tr><td style="padding-top:8px;">Estado</td><td style="text-align:right;padding-top:8px;font-weight:700;color:#2D6A4F;">Entregado ✅</td></tr>
    </table>
    <p style="color:#555;line-height:1.6;">¿Quedaste satisfecho? Deja tu reseña en la app y ayuda a otros compradores a descubrir los mejores productos de Colombia. 🌿</p>`;
  return base(contenido, `Pedido #${pedidoId} entregado — Teravia`);
}

module.exports = { pedidoCreado, pedidoComercianteNuevo, pedidoListo, pedidoEntregado };
