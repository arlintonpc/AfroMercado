/**
 * notificaciones.js — Utilidades de notificación WhatsApp para AfroMercado
 * Las funciones NUNCA lanzan error — si falla la notificación, la operación principal continúa.
 */

const { enviarMensajeWA } = require("./whatsapp");

function formatFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const dia  = String(d.getDate()).padStart(2, "0");
  const mes  = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function formatHora(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatPesos(valor) {
  return Number(valor).toLocaleString("es-CO");
}

function labelMetodoPago(metodo) {
  const mapa = {
    EFECTIVO:   "Pagar al llegar",
    DEPOSITO:   "Depósito 30%",
    TRANSFERENCIA: "Total por transferencia",
    TOTAL:      "Total anticipado",
  };
  return mapa[metodo] || metodo || "Pagar al llegar";
}

/**
 * Notifica al hotelero cuando llega una nueva reserva.
 *
 * @param {object} opts
 * @param {string}  opts.hotelWhatsapp   — Teléfono WhatsApp del hotelero
 * @param {object}  opts.reserva         — Objeto reserva (incluye campos básicos)
 * @param {object}  opts.habitacion      — Objeto habitacionTipo (nombre, etc.)
 * @param {string}  opts.comercioNombre  — Nombre del hotel/comercio
 */
async function notificarReservaHotel({ hotelWhatsapp, reserva, habitacion, comercioNombre }) {
  const mensaje = [
    `🏨 *Nueva reserva — ${comercioNombre || "Hotel"}*`,
    "",
    `📋 Código: *${reserva.codigo}*`,
    `🛏️ Habitación: ${habitacion?.nombre || "—"}`,
    `📅 Entrada: ${formatFecha(reserva.fechaEntrada)} (check-in ${formatHora(reserva.fechaEntrada)})`,
    `📅 Salida: ${formatFecha(reserva.fechaSalida)} (check-out ${formatHora(reserva.fechaSalida)})`,
    `👤 Huésped: ${reserva.nombreHuesped || "—"}`,
    `📞 Teléfono: ${reserva.telefonoHuesped || "—"}`,
    `👥 Huéspedes: ${reserva.huespedes || 1}`,
    `💰 Total: $${formatPesos(reserva.total)}`,
    `💳 Método pago: ${labelMetodoPago(reserva.metodoPago)}`,
    "",
    "Ingresa a tu panel Teravia para confirmar.",
  ].join("\n");

  if (!hotelWhatsapp) {
    console.log("[WA-NOTIF] Hotelero sin WhatsApp registrado — mensaje no enviado:\n" + mensaje);
    return;
  }

  try {
    await enviarMensajeWA(hotelWhatsapp, mensaje);
  } catch (err) {
    // Loggear pero nunca propagar — la reserva no debe fallar por esto
    console.log("[WA-NOTIF] No se pudo enviar WhatsApp al hotelero:", err?.message || err);
    console.log("[WA-NOTIF] Mensaje que se habría enviado:\n" + mensaje);
  }
}

/**
 * Notifica al cliente con el código de su reserva.
 *
 * @param {object} opts
 * @param {string}  opts.telefonoCliente — Teléfono del huésped ingresado en la reserva
 * @param {object}  opts.reserva         — Objeto reserva
 * @param {object}  opts.habitacion      — Objeto habitacionTipo
 * @param {string}  opts.comercioNombre  — Nombre del hotel/comercio
 */
async function notificarClienteReserva({ telefonoCliente, reserva, habitacion, comercioNombre }) {
  const mensaje = [
    `✅ *Reserva confirmada — ${comercioNombre || "Hotel"}*`,
    "",
    `Tu código: *${reserva.codigo}*`,
    `🛏️ ${habitacion?.nombre || "—"}`,
    `📅 Entrada: ${formatFecha(reserva.fechaEntrada)}`,
    `📅 Salida: ${formatFecha(reserva.fechaSalida)}`,
    `💰 Total: $${formatPesos(reserva.total)}`,
    "",
    "Guarda este código para tu check-in.",
  ].join("\n");

  if (!telefonoCliente) {
    console.log("[WA-NOTIF] Cliente sin teléfono — mensaje no enviado:\n" + mensaje);
    return;
  }

  try {
    await enviarMensajeWA(telefonoCliente, mensaje);
  } catch (err) {
    console.log("[WA-NOTIF] No se pudo enviar WhatsApp al cliente:", err?.message || err);
    console.log("[WA-NOTIF] Mensaje que se habría enviado:\n" + mensaje);
  }
}

module.exports = { notificarReservaHotel, notificarClienteReserva };
