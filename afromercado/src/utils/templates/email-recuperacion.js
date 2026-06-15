const { base } = require("./email-base");

function codigoRecuperacion({ nombre, codigo }) {
  const contenido = `
    <h2 style="color:#1A1A1A;font-size:20px;margin-top:0;">Recuperar contraseña</h2>
    <p style="color:#555;line-height:1.6;">Hola ${nombre}, recibimos una solicitud para restablecer la contraseña de tu cuenta en AfroMercado.</p>
    <div style="text-align:center;margin:32px 0;">
      <div style="display:inline-block;background:#2D6A4F;color:#ffffff;font-size:36px;font-weight:700;letter-spacing:8px;padding:20px 40px;border-radius:12px;">${codigo}</div>
    </div>
    <p style="color:#555;line-height:1.6;text-align:center;">Este código es válido por <strong>10 minutos</strong> y solo puede usarse una vez.</p>
    <p style="color:#C0392B;font-size:13px;text-align:center;">⚠️ Si no solicitaste este código, ignora este mensaje. Tu contraseña no cambiará.</p>`;
  return base(contenido, "Código de recuperación — AfroMercado");
}

module.exports = { codigoRecuperacion };
