function base(contenido, titulo) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background-color:#F8F5F0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:#2D6A4F;padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🌿 AfroMercado</h1>
<p style="margin:4px 0 0;color:#52B788;font-size:13px;">Productos del Chocó con alma</p>
</td></tr>
<tr><td style="padding:32px;">${contenido}</td></tr>
<tr><td style="background:#F8F5F0;padding:16px 32px;text-align:center;border-top:1px solid #e8e3da;">
<p style="margin:0;color:#888;font-size:12px;">AfroMercado · Chocó, Colombia</p>
<p style="margin:4px 0 0;color:#888;font-size:12px;">Este mensaje es automático, por favor no respondas a este correo.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

module.exports = { base };
