// ============================================================
//  Asistente de IA sobre WhatsApp — piloto de solo lectura.
//  Responde FAQ y, si el número coincide con un Usuario, incluye
//  el estado de sus pedidos recientes. No toma acciones.
//
//  Si ANTHROPIC_API_KEY no está definida, queda deshabilitado
//  (WhatsApp sigue funcionando normal para notificaciones salientes).
// ============================================================
const prisma = require("../config/prisma");
const PedidoRepository = require("../repositories/pedido.repository");

const MODELO = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 400;

const LIMITE_POR_REMITENTE_MS = 4000;
const LIMITE_GLOBAL_POR_MINUTO = 20;
const HISTORIAL_TOPE_MENSAJES = 8;
const HISTORIAL_TTL_MS = 30 * 60 * 1000;

const ultimoProcesadoPorJid = new Map(); // jid -> timestamp
const historialPorJid = new Map();       // jid -> { mensajes: [{role,content}], ultimaActividad }
let respuestasGlobalesVentana = [];      // timestamps de respuestas de IA en la última ventana

const SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Teravia, un marketplace y plataforma de servicios de Colombia (nació en el Chocó, comunidades afrocolombianas).
Teravia conecta: Tienda (productos físicos), Sabores (comida a domicilio), Hoteles, Tours, Transporte, Cultura (agenda y patrimonio), Empleo (incluye Servicios Profesionales), Bienes Raíces y Agro.

Reglas estrictas:
- Responde siempre en español, en tono breve y cercano, como un mensaje de WhatsApp (sin encabezados ni markdown, máximo 4-5 líneas).
- NUNCA inventes datos de pedidos, reservas o cuentas. Si no tienes esa información en el contexto que te doy, dilo claramente y sugiere revisar la app.
- No puedes tomar acciones (cancelar, confirmar, pagar, publicar, postularse). Si te lo piden, explica que debe hacerlo desde la app y, si es urgente, contactar soporte humano.
- Si no sabes algo con certeza, dilo — no lo inventes.`;

function podarHistorial() {
  const ahora = Date.now();
  for (const [jid, entrada] of historialPorJid) {
    if (ahora - entrada.ultimaActividad > HISTORIAL_TTL_MS) historialPorJid.delete(jid);
  }
}

function limiteGlobalSuperado() {
  const ahora = Date.now();
  respuestasGlobalesVentana = respuestasGlobalesVentana.filter((t) => ahora - t < 60000);
  return respuestasGlobalesVentana.length >= LIMITE_GLOBAL_POR_MINUTO;
}

function extraerNumeroLocal(remoteJid) {
  const digitos = String(remoteJid || "").replace(/\D/g, "");
  if (digitos.startsWith("57") && digitos.length > 10) return digitos.slice(-10);
  return digitos.slice(-10);
}

const ESTADO_PEDIDO_LABEL = {
  PENDIENTE_PAGO: "pendiente de pago",
  VERIFICANDO_PAGO: "verificando pago",
  PAGO_FALLIDO: "pago fallido",
  CONFIRMADO: "confirmado",
  CANCELADO: "cancelado",
  EXPIRADO: "expirado",
  ENTREGADO: "entregado",
};

async function construirContextoUsuario(remoteJid) {
  const numeroLocal = extraerNumeroLocal(remoteJid);
  if (numeroLocal.length < 7) return null;

  const usuario = await prisma.usuario.findFirst({
    where: { telefono: { endsWith: numeroLocal }, deletedAt: null },
    select: { id: true, nombre: true },
  });
  if (!usuario) return null;

  let resumenPedidos = "Sin pedidos registrados.";
  try {
    const pedidos = await PedidoRepository.listarPorComprador(usuario.id);
    if (pedidos.length > 0) {
      resumenPedidos = pedidos
        .slice(0, 2)
        .map((p) => {
          const estado = ESTADO_PEDIDO_LABEL[p.estado] || p.estado;
          const fecha = new Date(p.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
          return `${p.codigo}: ${estado}, total $${Math.round(p.total).toLocaleString("es-CO")}, del ${fecha}`;
        })
        .join(" | ");
    }
  } catch {
    resumenPedidos = "No se pudo consultar el estado de sus pedidos en este momento.";
  }

  return `El remitente es ${usuario.nombre}, usuario registrado en Teravia. Sus pedidos más recientes: ${resumenPedidos}`;
}

async function llamarModelo(mensajes, contextoUsuario) {
  const systemFinal = contextoUsuario
    ? `${SYSTEM_PROMPT}\n\nContexto del remitente (solo para tu referencia, no lo repitas textual): ${contextoUsuario}`
    : `${SYSTEM_PROMPT}\n\nEl remitente no tiene una cuenta identificada en Teravia — no asumas datos personales suyos.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: systemFinal,
      messages: mensajes,
    }),
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${texto.slice(0, 200)}`);
  }

  const data = await res.json();
  const bloque = (data.content || []).find((b) => b.type === "text");
  return bloque?.text?.trim() || null;
}

async function generarRespuestaAsistente(remoteJid, textoEntrante) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!textoEntrante || !textoEntrante.trim()) return null;
  if (textoEntrante.length > 2000) return null;

  const ahora = Date.now();
  const ultimo = ultimoProcesadoPorJid.get(remoteJid) || 0;
  if (ahora - ultimo < LIMITE_POR_REMITENTE_MS) return null;
  ultimoProcesadoPorJid.set(remoteJid, ahora);

  if (limiteGlobalSuperado()) return null;

  podarHistorial();
  const entrada = historialPorJid.get(remoteJid) || { mensajes: [], ultimaActividad: ahora };
  entrada.mensajes.push({ role: "user", content: textoEntrante.trim() });
  entrada.mensajes = entrada.mensajes.slice(-HISTORIAL_TOPE_MENSAJES);
  entrada.ultimaActividad = ahora;

  try {
    const contextoUsuario = await construirContextoUsuario(remoteJid);
    const respuesta = await llamarModelo(entrada.mensajes, contextoUsuario);
    if (!respuesta) return null;

    entrada.mensajes.push({ role: "assistant", content: respuesta });
    entrada.mensajes = entrada.mensajes.slice(-HISTORIAL_TOPE_MENSAJES);
    historialPorJid.set(remoteJid, entrada);
    respuestasGlobalesVentana.push(Date.now());

    return respuesta;
  } catch (err) {
    console.error("[AsistenteWA] Error generando respuesta:", err.message);
    return null;
  }
}

module.exports = { generarRespuestaAsistente };
