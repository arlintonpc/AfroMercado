const { base } = require("./email-base");

function formatFecha(fecha) {
  return new Date(fecha).toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatPrecio(valor) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function reservaNueva({ nombreHotelero, nombreHuesped, habitacion, fechaEntrada, fechaSalida, noches, total }) {
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">🏨 Nueva solicitud de reserva, ${nombreHotelero}!</h2>
    <p style="color:#555;line-height:1.6;">Tienes una nueva reserva en tu hotel. Revísala y confírmala desde el panel de administración.</p>
    <table width="100%" style="background:#F8F5F0;border-radius:8px;padding:20px;margin:20px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;"><strong style="color:#2D6A4F;">Huésped</strong></td>
        <td style="text-align:right;padding:6px 0;font-weight:700;">${nombreHuesped}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-top:1px solid #e8e3da;"><strong>Habitación</strong></td>
        <td style="text-align:right;padding:6px 0;border-top:1px solid #e8e3da;">${habitacion}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-top:1px solid #e8e3da;"><strong>Entrada</strong></td>
        <td style="text-align:right;padding:6px 0;border-top:1px solid #e8e3da;">${formatFecha(fechaEntrada)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-top:1px solid #e8e3da;"><strong>Salida</strong></td>
        <td style="text-align:right;padding:6px 0;border-top:1px solid #e8e3da;">${formatFecha(fechaSalida)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-top:1px solid #e8e3da;"><strong>Noches</strong></td>
        <td style="text-align:right;padding:6px 0;border-top:1px solid #e8e3da;">${noches}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-top:1px solid #e8e3da;"><strong style="color:#2D6A4F;">Total</strong></td>
        <td style="text-align:right;padding:6px 0;border-top:1px solid #e8e3da;font-weight:700;color:#2D6A4F;">${formatPrecio(total)}</td>
      </tr>
    </table>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://afromercado.co/comerciante/hoteles"
         style="background:#2D6A4F;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
        Ver reserva →
      </a>
    </p>
    <p style="color:#888;font-size:13px;line-height:1.5;">Si tienes la confirmación automática activada, esta reserva ya fue confirmada. De lo contrario, recuerda confirmarla o rechazarla a tiempo.</p>`;
  return base(contenido, "Nueva reserva en tu hotel — AfroMercado");
}

module.exports = { reservaNueva };
