// ============================================================
//  Job: Expira reservas de hotel PENDIENTE cuyo tiempo límite
//  haya vencido según horasLimiteConfirm de ConfigHotel.
//  Corre al inicio y cada 5 minutos.
// ============================================================
const prisma = require('../config/prisma')
const sseManager = require('../utils/sse-manager')
const { enviarPushAUsuario } = require('../utils/push')

async function notifCancelacion(usuarioId, codigo) {
  if (!usuarioId) return
  try {
    const titulo = '❌ Reserva cancelada automáticamente'
    const cuerpo = `Tu reserva ${codigo} venció sin confirmación del hotel y fue cancelada.`
    const url    = '/hoteles/mis-reservas'
    await prisma.notificacion.create({
      data: { usuarioId, tipo: 'GENERAL', titulo, mensaje: cuerpo, url },
    })
    sseManager.enviar(usuarioId, 'notificacion', { tipo: 'HOTEL', titulo, mensaje: cuerpo, url })
    await enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono: '/icon-192.svg' })
  } catch (e) {
    console.error('[JOB-HOTEL-NOTIF]', e.message)
  }
}

async function expirarReservasHotelPendientes() {
  const pendientes = await prisma.reservaHotel.findMany({
    where: { estado: 'PENDIENTE' },
    include: {
      configHotel: { select: { horasLimiteConfirm: true } },
    },
  })

  const ahora = new Date()
  const expiradas = pendientes.filter(r => {
    const limiteMs = (r.configHotel?.horasLimiteConfirm ?? 2) * 60 * 60 * 1000
    return (ahora - new Date(r.creadoAt)) > limiteMs
  })

  if (expiradas.length === 0) return

  await prisma.reservaHotel.updateMany({
    where: { id: { in: expiradas.map(r => r.id) } },
    data: { estado: 'CANCELADA', updatedAt: new Date() },
  })

  console.log(`[JOB] Expiradas ${expiradas.length} reserva(s) de hotel`)

  // Notificar a cada cliente afectado (fire-and-forget, no bloquea el job)
  setImmediate(() => {
    for (const r of expiradas) {
      notifCancelacion(r.clienteId, r.codigo).catch(e =>
        console.error('[JOB-HOTEL-NOTIF]', e.message)
      )
    }
  })
}

function iniciarJob() {
  // Corre inmediatamente al arrancar el servidor
  expirarReservasHotelPendientes().catch(e => console.error('[JOB-HOTEL]', e.message))
  // Luego cada 5 minutos
  setInterval(() => {
    expirarReservasHotelPendientes().catch(e => console.error('[JOB-HOTEL]', e.message))
  }, 5 * 60 * 1000)
}

module.exports = { iniciarJob }
