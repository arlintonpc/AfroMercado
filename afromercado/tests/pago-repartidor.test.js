const assert = require("assert");
const { calcularPagoEntrega } = require("../src/services/pago-repartidor.service");

const entrega = {
  subPedido: {
    pedido: { costoEnvio: 12000 },
  },
};

console.log("\nPruebas: pago al repartidor\n");

assert.strictEqual(calcularPagoEntrega(entrega, "fijo", 5000), 5000);
console.log("  ✓ Calcula pago fijo");

assert.strictEqual(calcularPagoEntrega(entrega, "porcentaje_envio", 70), 8400);
console.log("  ✓ Calcula porcentaje del costo de envío");

const entregaMulticomercio = {
  subPedido: {
    pedido: { costoEnvio: 12000, _count: { subPedidos: 2 } },
  },
};
assert.strictEqual(calcularPagoEntrega(entregaMulticomercio, "porcentaje_envio", 70), 4200);
console.log("  ✓ Distribuye el pago porcentual entre comercios");

assert.strictEqual(
  calcularPagoEntrega({ ...entrega, pagoRepartidor: 6100 }, "fijo", 5000),
  6100,
);
console.log("  ✓ Respeta el pago histórico congelado");

assert.strictEqual(calcularPagoEntrega({}, "porcentaje_envio", 70), 0);
console.log("  ✓ Tolera entregas sin costo de envío");

console.log("\nResultado: 5 pasadas, 0 fallidas\n");
