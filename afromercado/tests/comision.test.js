// Pruebas unitarias del cálculo de comisión
// Ejecutar con: node tests/comision.test.js
const { calcularDesglose, redondear } = require("../src/utils/comision");

let pasadas = 0;
let fallidas = 0;

function esperar(descripcion, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) {
    pasadas++;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallidas++;
    console.log(`  ✗ ${descripcion}`);
    console.log(`      esperado: ${JSON.stringify(esperado)}`);
    console.log(`      recibido: ${JSON.stringify(real)}`);
  }
}

function esperarError(descripcion, fn) {
  try {
    fn();
    fallidas++;
    console.log(`  ✗ ${descripcion} (no lanzó error)`);
  } catch (e) {
    pasadas++;
    console.log(`  ✓ ${descripcion}`);
  }
}

console.log("\nPruebas: cálculo de comisión\n");

// Caso real: borojó $8.000 x 3 = $24.000
esperar("Pedido de $24.000 con 10% de comisión",
  calcularDesglose(24000),
  { subtotal: 24000, comision: 2400, total: 24000, montoComerciante: 21600 });

// Caso del plátano: racimo a $25.000
esperar("Pedido de $25.000 con 10%",
  calcularDesglose(25000),
  { subtotal: 25000, comision: 2500, total: 25000, montoComerciante: 22500 });

// Valores con decimales (evitar errores de punto flotante)
esperar("Pedido de $18.999 redondea bien",
  calcularDesglose(18999),
  { subtotal: 18999, comision: 1899.9, total: 18999, montoComerciante: 17099.1 });

// Subtotal cero
esperar("Pedido de $0",
  calcularDesglose(0),
  { subtotal: 0, comision: 0, total: 0, montoComerciante: 0 });

// Comisión personalizada (5% para comunidades indígenas en el futuro)
esperar("Comisión del 5%",
  calcularDesglose(100000, 0.05),
  { subtotal: 100000, comision: 5000, total: 100000, montoComerciante: 95000 });

// Validaciones de error
esperarError("Rechaza subtotal negativo", () => calcularDesglose(-100));
esperarError("Rechaza texto como subtotal", () => calcularDesglose("abc"));
esperarError("Rechaza comisión mayor a 1", () => calcularDesglose(1000, 1.5));

// Función redondear
esperar("Redondea 1899.9000001 a 1899.9", redondear(1899.9000001), 1899.9);

console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
process.exit(fallidas > 0 ? 1 : 0);
