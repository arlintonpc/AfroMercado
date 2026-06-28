const Reglas = require("../config/reglas");

async function obtenerConfiguracionPago() {
  const [modo, valor] = await Promise.all([
    Reglas.obtener("repartidor_pago_modo"),
    Reglas.numero("repartidor_pago_valor"),
  ]);
  return { modo, valor };
}

function calcularPagoEntrega(entrega, modo, valor) {
  if (entrega.pagoRepartidor !== null && entrega.pagoRepartidor !== undefined) {
    return Number(entrega.pagoRepartidor);
  }

  if (modo === "porcentaje_envio") {
    const pedido = entrega.subPedido?.pedido;
    const costoEnvio = Number(pedido?.costoEnvio ?? 0);
    const cantidadSubPedidos = Math.max(
      1,
      Number(pedido?._count?.subPedidos ?? pedido?.subPedidos?.length ?? 1),
    );
    return Math.round((costoEnvio * (valor / 100)) / cantidadSubPedidos);
  }
  return Math.round(valor);
}

module.exports = { obtenerConfiguracionPago, calcularPagoEntrega };
