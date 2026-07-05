// ============================================================
//  Job: reintenta la emisión de facturas electrónicas en estado
//  ERROR con backoff simple. Corre al inicio y cada 10 minutos.
// ============================================================
const FacturacionService = require('../services/facturacion.service')

function iniciarJob() {
  FacturacionService.reintentarPendientes().catch(e => console.error('[JOB-FACTURACION]', e.message))
  setInterval(() => {
    FacturacionService.reintentarPendientes().catch(e => console.error('[JOB-FACTURACION]', e.message))
  }, 10 * 60 * 1000)
}

module.exports = { iniciarJob }
