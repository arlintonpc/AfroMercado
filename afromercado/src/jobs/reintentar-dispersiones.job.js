// ============================================================
//  Job: recupera dispersiones pendientes, fallidas o reclamadas
//  por un proceso que se interrumpio antes de enviarlas.
//  Corre al inicio y cada 10 minutos.
// ============================================================
const prisma = require('../config/prisma')
const PagoDigitalService = require('../services/pago-digital.service')
const NotificacionService = require('../services/notificacion.service')

const MAX_INTENTOS = 5

async function reintentarDispersionesFallidas() {
  const ahora = new Date()
  const pendientes = await prisma.pagoDispersion.findMany({
    where: {
      pago: { estado: 'CONFIRMADO' },
      intentosFallidos: { lt: MAX_INTENTOS },
      OR: [
        {
          estado: 'PENDIENTE',
          OR: [{ proximoReintentoAt: null }, { proximoReintentoAt: { lte: ahora } }],
        },
        {
          estado: 'FALLIDA',
          OR: [{ proximoReintentoAt: null }, { proximoReintentoAt: { lte: ahora } }],
        },
      ],
    },
    select: { id: true, pagoId: true },
    distinct: ['pagoId'],
  })

  if (pendientes.length === 0) return

  for (const disp of pendientes) {
    try {
      await PagoDigitalService.ejecutarDispersiones(disp.pagoId)
      console.log(`[JOB-DISPERSION] Pago #${disp.pagoId} — dispersión reintentada con éxito`)
    } catch (e) {
      const fallidas = await prisma.pagoDispersion.findMany({
        where: {
          pagoId: disp.pagoId,
          OR: [
            { estado: 'FALLIDA' },
            { providerStatus: 'ENVIO_INCIERTO' },
          ],
        },
        select: {
          intentosFallidos: true,
          providerStatus: true,
        },
      })
      const intentos = Math.max(0, ...fallidas.map(item => item.intentosFallidos))
      const envioIncierto = fallidas.some(item => item.providerStatus === 'ENVIO_INCIERTO')
      console.error(`[JOB-DISPERSION] Pago #${disp.pagoId} — reintento ${intentos}/${MAX_INTENTOS} fallido: ${e.message}`)

      if (intentos >= MAX_INTENTOS || envioIncierto) {
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

module.exports = { iniciarJob, reintentarDispersionesFallidas }
