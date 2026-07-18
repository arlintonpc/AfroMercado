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
    let costoEnvio = 0;
    let cantidadSubPedidos = 1;
    if (entrega.subPedido) {
      const pedido = entrega.subPedido.pedido;
      costoEnvio = Number(pedido?.costoEnvio ?? 0);
      cantidadSubPedidos = Math.max(
        1,
        Number(pedido?._count?.subPedidos ?? pedido?.subPedidos?.length ?? 1),
      );
    } else if (entrega.pedidoExpress) {
      // Un PedidoExpress es siempre de un solo comercio — no hay costo de
      // envío que repartir entre varios subpedidos como en Marketplace.
      costoEnvio = Number(entrega.pedidoExpress.costoEnvio ?? 0);
    }
    return Math.round((costoEnvio * (valor / 100)) / cantidadSubPedidos);
  }
  return Math.round(valor);
}

module.exports = { obtenerConfiguracionPago, calcularPagoEntrega };
