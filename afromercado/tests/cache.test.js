// Pruebas unitarias para el servicio de caché en memoria (cache.js)
// Ejecutar con: node tests/cache.test.js

const cache = require('../src/utils/cache');

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

async function runCacheTests() {
  console.log("\nPruebas: MemoryCache (cache.js)\n");

  cache.clear();

  let llamadasBD = 0;
  async function fetcherMock() {
    llamadasBD++;
    return [{ id: 1, nombre: "Chontaduro de la Selva" }];
  }

  // 1. Primera llamada: Cache Miss -> consulta BD
  const res1 = await cache.getOrSet("productos:listado:chocó", 5000, fetcherMock);
  esperar("Primera llamada (Cache Miss): consulta la BD y retorna datos", res1, [{ id: 1, nombre: "Chontaduro de la Selva" }]);
  esperar("Primera llamada: contador de llamadas a BD es 1", llamadasBD, 1);

  // 2. Segunda llamada con la misma clave: Cache Hit -> NO consulta BD
  const res2 = await cache.getOrSet("productos:listado:chocó", 5000, fetcherMock);
  esperar("Segunda llamada (Cache Hit): retorna datos cacheados", res2, [{ id: 1, nombre: "Chontaduro de la Selva" }]);
  esperar("Segunda llamada: contador de llamadas a BD se mantiene en 1", llamadasBD, 1);

  // 3. Invalidación por prefijo
  cache.invalidatePrefix("productos:");
  const res3 = await cache.getOrSet("productos:listado:chocó", 5000, fetcherMock);
  esperar("Llamada tras invalidar prefijo (Cache Miss): vuelve a consultar la BD", res3, [{ id: 1, nombre: "Chontaduro de la Selva" }]);
  esperar("Llamada tras invalidar: contador de llamadas a BD sube a 2", llamadasBD, 2);

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
}

runCacheTests();
