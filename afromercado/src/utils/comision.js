// ============================================================
//  Cálculo de comisión de AfroMercado
//  Lógica de negocio central — probada con tests unitarios
// ============================================================
const config = require("../config");

/**
 * Calcula el desglose económico de un pedido.
 * @param {number} subtotal - suma de los productos (lo que reciben los comerciantes antes de comisión)
 * @param {number} [porcentaje] - comisión (por defecto la de config, 0.10)
 * @returns {{ subtotal:number, comision:number, total:number, montoComerciante:number }}
 */
function calcularDesglose(subtotal, porcentaje = config.comisionPorcentaje) {
  if (typeof subtotal !== "number" || isNaN(subtotal) || subtotal < 0) {
    throw new Error("El subtotal debe ser un número mayor o igual a cero");
  }
  if (porcentaje < 0 || porcentaje > 1) {
    throw new Error("El porcentaje de comisión debe estar entre 0 y 1");
  }

  const comision = redondear(subtotal * porcentaje);
  const total = redondear(subtotal); // el comprador paga el subtotal; la comisión sale de ahí
  const montoComerciante = redondear(subtotal - comision);

  return { subtotal: redondear(subtotal), comision, total, montoComerciante };
}

/**
 * Igual que calcularDesglose(), pero además calcula el IVA cuando el comercio
 * lo tiene activo. El IVA se suma al comprador — no sale de la comisión ni
 * del monto del comerciante (montoComerciante no cambia respecto a calcularDesglose).
 * @param {number} subtotal
 * @param {{ivaActivo?: boolean, ivaPorcentaje?: number|string}} [configFiscal] - si falta o ivaActivo es false, iva=0
 * @param {number} [porcentajeComision]
 * @returns {{ subtotal:number, comision:number, total:number, montoComerciante:number, iva:number, totalConIva:number }}
 */
function calcularDesgloseConIva(subtotal, configFiscal = null, porcentajeComision = config.comisionPorcentaje) {
  const base = calcularDesglose(subtotal, porcentajeComision);
  if (!configFiscal || !configFiscal.ivaActivo) {
    return { ...base, iva: 0, totalConIva: base.total };
  }
  const tasaIva = Number(configFiscal.ivaPorcentaje) / 100;
  const iva = redondear(subtotal * tasaIva);
  return { ...base, iva, totalConIva: redondear(base.total + iva) };
}

// Redondea a 2 decimales evitando errores de punto flotante
function redondear(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { calcularDesglose, calcularDesgloseConIva, redondear };
