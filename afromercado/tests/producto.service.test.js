// Pruebas unitarias del servicio de Productos
// Ejecutar con: node tests/producto.service.test.js

// ── Mocks ────────────────────────────────────────────────────────────────────
// Sobreescribimos los métodos de los repositorios ANTES de requerir el servicio
// para que éste nunca toque Prisma ni la base de datos real.

const ComercioRepository = require("../src/repositories/comercio.repository");
const ProductoRepository = require("../src/repositories/producto.repository");

// Valores por defecto reutilizables en los tests
const comercioFake = {
  id: "comercio-123",
  nombre: "Tienda AfroTest",
  activo: true,
  verificado: true,
  estadoRegistro: "APROBADO",
  fotoDocumentoFrenteUrl: "https://docs/frente.jpg",
  fotoDocumentoReversoUrl: "https://docs/reverso.jpg",
  cuentaDispersion: { estado: "VERIFICADA", proveedor: "SANDBOX" },
};
const productoFake = { id: "prod-999", comercioId: "comercio-123", nombre: "Borojó", activo: true };

// Estado mutable de los mocks (se puede sobreescribir por test)
let mockComercio = comercioFake;
let mockProducto = productoFake;
let productoCreado = null;
let productoActualizado = null;

ComercioRepository.buscarPorUsuarioId = async () => mockComercio;
ComercioRepository.buscarPorUsuarioIdConCuenta = async () => mockComercio;
ProductoRepository.buscarPorId       = async () => mockProducto;
ProductoRepository.crear             = async (data) => { productoCreado = data; return { id: "prod-nuevo", ...data }; };
ProductoRepository.actualizar        = async (id, data) => { productoActualizado = data; return { id, ...data }; };

// Ahora sí cargamos el servicio (ya ve los mocks en memoria)
const ProductoService = require("../src/services/producto.service");
const { ErrorValidacion, ErrorNoAutorizado, ErrorNoEncontrado } = require("../src/utils/errores");

// ── Utilidades de reporte ─────────────────────────────────────────────────────
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

async function esperarRejection(descripcion, promesa, TipoError) {
  try {
    await promesa;
    fallidas++;
    console.log(`  ✗ ${descripcion} (no lanzó error)`);
  } catch (e) {
    if (e instanceof TipoError) {
      pasadas++;
      console.log(`  ✓ ${descripcion}`);
    } else {
      fallidas++;
      console.log(`  ✗ ${descripcion} (lanzó ${e.constructor.name}, esperaba ${TipoError.name}: ${e.message})`);
    }
  }
}

// ── Datos válidos base ────────────────────────────────────────────────────────
const datosValidos = {
  nombre: "Borojó fresco",
  precio: 8000,
  unidad: "KG",
  stock: 50,
  diasAlistamientoMin: 1,
  diasAlistamientoMax: 3,
  alcance: "LOCAL",
};

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — crear()
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPruebas: ProductoService.crear()\n");

// Antes de cada test de "crear" aseguramos que el comercio exista
async function runCrearTests() {

  // 1. Rechaza nombre vacío
  mockComercio = comercioFake;
  await esperarRejection(
    "Rechaza nombre vacío",
    ProductoService.crear("u1", { ...datosValidos, nombre: "" }),
    ErrorValidacion
  );

  // 2. Rechaza precio ausente
  mockComercio = comercioFake;
  await esperarRejection(
    "Rechaza precio ausente",
    ProductoService.crear("u1", { ...datosValidos, precio: undefined }),
    ErrorValidacion
  );

  // 3. Rechaza unidad ausente
  mockComercio = comercioFake;
  await esperarRejection(
    "Rechaza unidad ausente",
    ProductoService.crear("u1", { ...datosValidos, unidad: undefined }),
    ErrorValidacion
  );

  // 4. Rechaza precio <= 0
  mockComercio = comercioFake;
  await esperarRejection(
    "Rechaza precio <= 0",
    ProductoService.crear("u1", { ...datosValidos, precio: 0 }),
    ErrorValidacion
  );

  // 5. Rechaza unidad inválida ("TONELADA")
  mockComercio = comercioFake;
  await esperarRejection(
    'Rechaza unidad inválida ("TONELADA")',
    ProductoService.crear("u1", { ...datosValidos, unidad: "TONELADA" }),
    ErrorValidacion
  );

  // 6. Rechaza alcance inválido ("GLOBAL")
  mockComercio = comercioFake;
  await esperarRejection(
    'Rechaza alcance inválido ("GLOBAL")',
    ProductoService.crear("u1", { ...datosValidos, alcance: "GLOBAL" }),
    ErrorValidacion
  );

  // 7. Rechaza diasAlistamientoMax < diasAlistamientoMin
  mockComercio = comercioFake;
  await esperarRejection(
    "Rechaza diasAlistamientoMax < diasAlistamientoMin",
    ProductoService.crear("u1", { ...datosValidos, diasAlistamientoMin: 5, diasAlistamientoMax: 2 }),
    ErrorValidacion
  );

  // 8. Rechaza si usuario no tiene comercio (mock retorna null)
  mockComercio = null;
  await esperarRejection(
    "Rechaza si usuario no tiene comercio",
    ProductoService.crear("u-sin-comercio", datosValidos),
    ErrorValidacion
  );

  // 9. Rechaza si el comercio aun no esta aprobado/documentado para vender
  mockComercio = { ...comercioFake, estadoRegistro: "PENDIENTE_REVISION", verificado: false };
  await esperarRejection(
    "Rechaza si comercio no esta aprobado",
    ProductoService.crear("u-pendiente", datosValidos),
    ErrorValidacion
  );

  // 10. Acepta datos válidos y llama a ProductoRepository.crear con los campos correctos
  mockComercio = comercioFake;
  productoCreado = null;
  let resultado;
  try {
    resultado = await ProductoService.crear("u1", datosValidos);
  } catch (e) {
    resultado = null;
  }
  esperar(
    "Acepta datos válidos y retorna el producto creado",
    resultado !== null && resultado.nombre === datosValidos.nombre.trim() && resultado.comercioId === comercioFake.id,
    true
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — actualizar()
// ─────────────────────────────────────────────────────────────────────────────
async function runActualizarTests() {
  console.log("\nPruebas: ProductoService.actualizar()\n");

  // 1. Rechaza precio <= 0
  mockComercio = comercioFake;
  mockProducto = productoFake; // mismo comercioId → autorizado
  await esperarRejection(
    "Rechaza precio <= 0",
    ProductoService.actualizar("u1", "prod-999", { precio: -500 }),
    ErrorValidacion
  );

  // 2. Rechaza alcance inválido
  mockComercio = comercioFake;
  mockProducto = productoFake;
  await esperarRejection(
    'Rechaza alcance inválido ("MUNDIAL")',
    ProductoService.actualizar("u1", "prod-999", { alcance: "MUNDIAL" }),
    ErrorValidacion
  );

  // 3. Rechaza producto de otro comercio
  mockComercio = { id: "comercio-OTRO", nombre: "Otro comercio" };
  mockProducto = productoFake; // producto pertenece a "comercio-123", no a "comercio-OTRO"
  await esperarRejection(
    "Rechaza actualizar producto de otro comercio",
    ProductoService.actualizar("u-otro", "prod-999", { nombre: "Intento hackeo" }),
    ErrorNoAutorizado
  );
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runCrearTests();
    await runActualizarTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
