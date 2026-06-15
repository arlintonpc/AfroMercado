const EventEmitter = require("events");
const path = require("path");
const fs = require("fs");
const qrcode = require("qrcode");

const LOG_FILE = path.join(__dirname, "..", "..", "config", "whatsapp-debug.log");

function waLog(...args) {
  const msg = args.join(" ");
  const linea = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(LOG_FILE, linea); } catch {}
}

// Estados: DESCONECTADO → INICIANDO → ESCANEANDO_QR → CONECTADO
let estadoWA = "DESCONECTADO";
let qrDataUrl = null;
let socketWA = null;
let socketActualId = 0;      // ID del socket activo — los sockets viejos se ignoran
let conectando = false;       // mutex simple para evitar arranques concurrentes
const emitter = new EventEmitter();

const SESSION_DIR = path.join(__dirname, "..", "..", "config", "whatsapp-session");

function limpiarSesion() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.readdirSync(SESSION_DIR).forEach((f) =>
        fs.unlinkSync(path.join(SESSION_DIR, f))
      );
      waLog("[WA] Archivos de sesión eliminados");
    }
  } catch (e) {
    waLog("[WA] Error limpiando sesión:", e.message);
  }
}

function cerrarSocketAnterior() {
  if (socketWA) {
    try { socketWA.ws?.close(); } catch {}
    socketWA = null;
  }
}

async function iniciarWhatsApp() {
  // Bloquear arranques concurrentes
  if (conectando) {
    waLog("[WA] Conexión ya en progreso — ignorando llamada duplicada");
    return;
  }
  if (estadoWA === "CONECTADO") {
    waLog("[WA] Ya conectado — no es necesario reiniciar");
    return;
  }

  conectando = true;
  estadoWA = "INICIANDO";
  const miId = ++socketActualId;   // ID único para este intento
  waLog("[WA] Iniciando conexión WhatsApp… (id=" + miId + ")");

  // Cerrar cualquier socket previo para evitar conflictos 440
  cerrarSocketAnterior();

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = require("@whiskeysockets/baileys");

    fs.mkdirSync(SESSION_DIR, { recursive: true });

    // Detectar y eliminar creds.json vacío (0 bytes) antes de cargar
    const credsPath = path.join(SESSION_DIR, "creds.json");
    if (fs.existsSync(credsPath) && fs.statSync(credsPath).size === 0) {
      waLog("[WA] creds.json vacío detectado — eliminando");
      fs.unlinkSync(credsPath);
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) version = latest.version;
      waLog("[WA] Versión WA:", version.join("."));
    } catch {
      waLog("[WA] Usando versión WA por defecto:", version.join("."));
    }

    // Si este intento ya fue superado por uno más nuevo, abortar
    if (miId !== socketActualId) {
      waLog("[WA] Intento id=" + miId + " cancelado — hay uno más reciente");
      conectando = false;
      estadoWA = "DESCONECTADO";
      return;
    }

    const { Browsers } = require("@whiskeysockets/baileys");
    socketWA = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: require("pino")({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      getMessage: async () => undefined,
    });

    conectando = false;   // Liberar mutex — el socket ya está corriendo

    socketWA.ev.on("creds.update", async () => {
      // Solo guardar credenciales si este socket sigue siendo el activo
      if (miId !== socketActualId) return;
      try { await saveCreds(); } catch (e) {
        waLog("[WA] Error guardando credenciales:", e.message);
      }
    });

    socketWA.ev.on("connection.update", async (update) => {
      // Ignorar eventos de sockets viejos que siguen corriendo
      if (miId !== socketActualId) {
        return;
      }

      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          estadoWA = "ESCANEANDO_QR";
          try {
            qrDataUrl = await qrcode.toDataURL(qr, { width: 512, margin: 2 });
            emitter.emit("qr", qrDataUrl);
            waLog("[WA] QR listo para escanear");
          } catch (e) {
            waLog("[WA] Error generando QR:", e.message);
          }
        }

        if (connection === "open") {
          estadoWA = "CONECTADO";
          qrDataUrl = null;
          waLog("[WA] ✅ WhatsApp conectado y activo");
          emitter.emit("conectado");
        }

        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message ?? "sin mensaje";
          waLog("[WA] Conexión cerrada. Código:", statusCode, "| Mensaje:", errorMsg);

          estadoWA = "DESCONECTADO";
          qrDataUrl = null;
          socketWA = null;

          if (statusCode === DisconnectReason.loggedOut && errorMsg.includes("Logged Out")) {
            waLog("[WA] Sesión cerrada manualmente desde el celular — escanea el QR nuevamente");
            limpiarSesion();
          } else if (statusCode === 401) {
            // 401 Connection Failure: WhatsApp rechazó el emparejamiento.
            // Limpiar sesión para permitir un QR fresco en el próximo intento.
            waLog("[WA] Fallo de conexión (401) — limpiando sesión para nuevo intento");
            limpiarSesion();
          } else if (statusCode === 440) {
            // Conflicto: otra instancia usó las mismas credenciales.
            // NO reconectar con las mismas creds — eso crea un bucle infinito de 440.
            waLog("[WA] Conflicto de sesión (440) — limpiando credenciales. Reconecta manualmente.");
            limpiarSesion();
          } else if (statusCode === 408) {
            waLog("[WA] QR expirado — generando uno nuevo en 5 segundos…");
            setTimeout(() => {
              conectando = false;
              iniciarWhatsApp();
            }, 5000);
          } else {
            waLog("[WA] Reconectando en 8 segundos…");
            setTimeout(() => {
              conectando = false;
              iniciarWhatsApp();
            }, 8000);
          }
        }
      } catch (err) {
        waLog("[WA] Error en connection.update:", err.message);
      }
    });

    socketWA.ev.on("messages.upsert", () => {});
    socketWA.ev.on("messages.update", () => {});
    socketWA.ev.on("contacts.upsert", () => {});
    socketWA.ev.on("chats.upsert", () => {});

  } catch (err) {
    waLog("[WA] Error al iniciar:", err.message);
    estadoWA = "DESCONECTADO";
    conectando = false;
  }
}

function obtenerEstadoWA() {
  return { estado: estadoWA, qrDataUrl };
}

async function enviarMensajeWA(telefono, texto) {
  if (estadoWA !== "CONECTADO" || !socketWA) {
    waLog("[WA] No conectado — mensaje no enviado a:", telefono);
    return;
  }

  let numero = String(telefono).replace(/\D/g, "");
  if (numero.startsWith("0")) numero = numero.slice(1);
  if (!numero.startsWith("57")) numero = "57" + numero;
  const jid = `${numero}@s.whatsapp.net`;

  try {
    await socketWA.sendMessage(jid, { text: texto });
    waLog("[WA] ✓ Mensaje enviado a", numero);
  } catch (err) {
    waLog("[WA] Error enviando a", telefono, "—", err.message);
    throw err;
  }
}

async function cerrarConexion() {
  cerrarSocketAnterior();
  estadoWA = "DESCONECTADO";
  qrDataUrl = null;
  conectando = false;
  waLog("[WA] Conexión cerrada limpiamente por señal del sistema");
}

module.exports = { iniciarWhatsApp, obtenerEstadoWA, enviarMensajeWA, cerrarConexion, emitter };
