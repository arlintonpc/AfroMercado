const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const ConfigRepository = require("../repositories/config.repository");

const LOG_FILE = path.join(__dirname, "../../config/email-debug.log");

function logEmail(msg) {
  const linea = `[${new Date().toISOString()}] [EMAIL] ${msg}\n`;
  process.stdout.write(linea);
  fs.appendFile(LOG_FILE, linea, () => {});
}

async function obtenerConfigSmtp() {
  const [host, port, user, pass, secure] = await Promise.all([
    ConfigRepository.obtener("smtpHost"),
    ConfigRepository.obtener("smtpPort"),
    ConfigRepository.obtener("smtpUser"),
    ConfigRepository.obtener("smtpPass"),
    ConfigRepository.obtener("smtpSecure"),
  ]);
  return {
    host: host || process.env.SMTP_HOST || null,
    port: parseInt(port || process.env.SMTP_PORT || "587", 10),
    user: user || process.env.SMTP_USER || null,
    pass: pass || process.env.SMTP_PASS || null,
    secure: (secure ?? process.env.SMTP_SECURE ?? "false") === "true",
  };
}

async function estaConfigurado() {
  const cfg = await obtenerConfigSmtp();
  return !!(cfg.host && cfg.user && cfg.pass);
}

function obtenerFrom(smtpUser) {
  return (
    process.env.EMAIL_FROM ||
    (smtpUser ? `Teravia <${smtpUser}>` : "Teravia <notificaciones@afromercado.co>")
  );
}

async function enviarEmail({ to, subject, html, text }) {
  const cfg = await obtenerConfigSmtp();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    logEmail(`SMTP no configurado — email no enviado a: ${to}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const from = obtenerFrom(cfg.user);
  try {
    await transporter.sendMail({ from, to, subject, html: html || `<p>${text}</p>` });
    logEmail(`✓ Email enviado a ${to} — "${subject}"`);
  } catch (err) {
    logEmail(`✗ Error al enviar a ${to} — ${err.message}`);
    throw err;
  }
}

module.exports = { enviarEmail, estaConfigurado, obtenerFrom, obtenerConfigSmtp };
