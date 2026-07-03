// ============================================================
//  Job: Recordatorio de tour — una vez al día busca reservas de
//  tour CONFIRMADA cuya fechaTour sea "mañana" y notifica al
//  cliente (in-app + push + WhatsApp si tiene teléfono).
//  Corre al inicio y luego cada 24 horas.
// ============================================================
const prisma = require('../config/prisma')
const sseManager = require('../utils/sse-manager')
const { enviarPushAUsuario } = require('../utils/push')
const { enviarMensajeWA } = require('../utils/whatsapp')

const TITULO = '🗺️ ¡Tu tour es mañana!'
const MENSAJE = '¡Tu tour es mañana! 🗺️ No olvides confirmar los detalles con el operador.'

async function notifRecordatorioTour(reserva) {
  const usuarioId = reserva.clienteId
  if (!usuarioId) return
  try {
    const url = '/tours/mis-reservas'
    await prisma.notificacion.create({
      data: { usuarioId, tipo: 'GENERAL', titulo: TITULO, mensaje: MENSAJE, url },
    })
    sseManager.enviar(usuarioId, 'notificacion', { tipo: 'TOUR', titulo: TITULO, mensaje: MENSAJE, url })
    await enviarPushAUsuario(prisma, usuarioId, { titulo: TITULO, cuerpo: MENSAJE, url, icono: '/icon-192.svg' })

    const telefono = reserva.telefonoContacto || reserva.cliente?.telefono
    if (telefono) {
      await enviarMensajeWA(telefono,
        `🗺️ *Recordatorio — AfroMercado*\n\n` +
        `Hola ${reserva.nombreContacto || reserva.cliente?.nombre || ''}, tu tour *${reserva.configTour?.nombre || ''}* es *mañana*.\n\n` +
        `No olvides confirmar los detalles con el operador. 🌿`
      )
    }
  } catch (e) {
    console.error('[JOB-TOUR-NOTIF]', e.message)
  }
}

async function enviarRecordatoriosTourManana() {
  const ahora = new Date()
  const inicioManana = new Date(ahora)
  inicioManana.setDate(inicioManana.getDate() + 1)
  inicioManana.setHours(0, 0, 0, 0)
  const finManana = new Date(inicioManana)
  finManana.setHours(23, 59, 59, 999)

  const reservas = await prisma.reservaTour.findMany({
    where: {
      estado: 'CONFIRMADA',
      fechaTour: { gte: inicioManana, lte: finManana },
    },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true } },
      configTour: { select: { nombre: true } },
    },
  })

  if (reservas.length === 0) return

  // Deduplicar: no reenviar si ya se notificó este recordatorio para la reserva
  let enviados = 0
  for (const reserva of reservas) {
    const yaEnviado = await prisma.notificacion.findFirst({
      where: {
        usuarioId: reserva.clienteId,
        titulo: TITULO,
        url: '/tours/mis-reservas',
        createdAt: { gte: new Date(ahora.getTime() - 20 * 60 * 60 * 1000) },
      },
    })
    if (yaEnviado) continue

    await notifRecordatorioTour(reserva)
    enviados++
  }

  if (enviados > 0) console.log(`[JOB] Recordatorio enviado a ${enviados} reserva(s) de tour para mañana`)
}

function iniciarJob() {
  // Corre inmediatamente al arrancar el servidor
  enviarRecordatoriosTourManana().catch(e => console.error('[JOB-TOUR]', e.message))
  // Luego una vez al día
  setInterval(() => {
    enviarRecordatoriosTourManana().catch(e => console.error('[JOB-TOUR]', e.message))
  }, 24 * 60 * 60 * 1000)
}

module.exports = { iniciarJob }
