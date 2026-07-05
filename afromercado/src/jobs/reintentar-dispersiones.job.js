// ============================================================
//  Job: reintenta dispersiones de pago en estado FALLIDA con
//  backoff simple. Si un pago ya fue CONFIRMADO (el comprador
//  pagó) pero ejecutarDispersiones() falló, antes no existía
//  ningún mecanismo que lo reintentara — el único rastro era
//  una nota de texto libre en Pago.notas.
//  Corre al inicio y cada 10 minutos.
// ============================================================
const prisma = require('../config/prisma')
const PagoDigitalService = require('../services/pago-digital.service')
const NotificacionService = require('../services/notificacion.service')

const MAX_INTENTOS = 5
const BACKOFF_MINUTOS = [5, 15, 30, 60, 120] // por intento (1ro..5to)

function proximoBackoffMinutos(intentosFallidos) {
  return BACKOFF_MINUTOS[Math.min(intentosFallidos, BACKOFF_MINUTOS.length - 1)]
}

async function reintentarDispersionesFallidas() {
  const ahora = new Date()
  const pendientes = await prisma.pagoDispersion.findMany({
    where: {
      estado: 'FALLIDA',
      intentosFallidos: { lt: MAX_INTENTOS },
      OR: [{ proximoReintentoAt: null }, { proximoReintentoAt: { lte: ahora } }],
    },
    select: { id: true, pagoId: true, intentosFallidos: true },
    distinct: ['pagoId'],
  })

  if (pendientes.length === 0) return

  for (const disp of pendientes) {
    try {
      await PagoDigitalService.ejecutarDispersiones(disp.pagoId)
      console.log(`[JOB-DISPERSION] Pago #${disp.pagoId} — dispersión reintentada con éxito`)
    } catch (e) {
      const intentos = disp.intentosFallidos + 1
      const minutos = proximoBackoffMinutos(disp.intentosFallidos)
      await prisma.pagoDispersion.updateMany({
        where: { pagoId: disp.pagoId, estado: 'FALLIDA' },
        data: {
          intentosFallidos: intentos,
          proximoReintentoAt: new Date(ahora.getTime() + minutos * 60 * 1000),
        },
      })
      console.error(`[JOB-DISPERSION] Pago #${disp.pagoId} — reintento ${intentos}/${MAX_INTENTOS} fallido: ${e.message}`)

      if (intentos >= MAX_INTENTOS) {
        const pago = await prisma.pago.findUnique({
          where: { id: disp.pagoId },
          include: { pedido: { include: { subPedidos: { include: { comercio: { select: { nombre: true } } }, take: 1 } } } },
        }).catch(() => null)
        const comercioNombre = pago?.pedido?.subPedidos?.[0]?.comercio?.nombre
        NotificacionService.dispersionFallidaAdmin({ pagoId: disp.pagoId, comercioNombre, intentos }).catch(err =>
          console.error('[JOB-DISPERSION-NOTIF]', err.message)
        )
      }
    }
  }
}

function iniciarJob() {
  reintentarDispersionesFallidas().catch(e => console.error('[JOB-DISPERSION]', e.message))
  setInterval(() => {
    reintentarDispersionesFallidas().catch(e => console.error('[JOB-DISPERSION]', e.message))
  }, 10 * 60 * 1000)
}

module.exports = { iniciarJob }
