// ============================================================
//  E2E del flujo comerciante (API real)
//  login -> mi-comercio -> listar productos -> publicar producto
//  Uso: node tests/e2e-comerciante.js
// ============================================================
const BASE = "http://localhost:3001/api";
let fallos = 0;
function check(cond, label, extra) {
  console.log(`${cond ? "✔" : "✖"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fallos++;
}
async function api(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, ok: res.ok, datos: d };
}

async function main() {
  console.log("\n=== E2E AfroMercado — flujo comerciante ===\n");

  const login = await api("/auth/login", {
    method: "POST",
    body: { email: "baudo@afromercado.co", password: "Comercio123" },
  });
  check(login.ok, "Login comerciante", `(${login.status})`);
  const token = login.datos && (login.datos.token || (login.datos.data && login.datos.data.token));
  check(!!token, "Token recibido");
  if (!token) return fin();

  const mic = await api("/comercios/mi-comercio", { token });
  const comercio = mic.datos && (mic.datos.comercio || (mic.datos.data && mic.datos.data.comercio) || mic.datos.data);
  check(mic.ok && !!comercio, "GET mi-comercio", `(${mic.status}, ${comercio && comercio.nombre})`);

  const lista = await api("/productos/mis/productos", { token });
  const prods = lista.datos && (lista.datos.productos || (lista.datos.data && lista.datos.data.productos) || lista.datos.data);
  check(lista.ok && Array.isArray(prods), "GET mis productos", `(${lista.status}, n=${Array.isArray(prods) ? prods.length : "?"})`);

  const crear = await api("/productos", {
    token, method: "POST",
    body: {
      nombre: "Producto E2E " + Date.now(),
      descripcion: "Creado por prueba e2e comerciante",
      precio: 12345,
      unidad: "KG",
      stock: 10,
      diasAlistamientoMin: 1,
      diasAlistamientoMax: 3,
      alcance: "NACIONAL",
    },
  });
  const prodCreado = crear.datos && (crear.datos.producto || (crear.datos.data && crear.datos.data.producto) || crear.datos.data);
  check(crear.ok && !!prodCreado, "POST publicar producto", `(${crear.status}, id=${prodCreado && prodCreado.id})`);

  fin();
}
function fin() {
  console.log(`\n=== Resultado: ${fallos === 0 ? "TODO OK ✅" : fallos + " fallo(s) ❌"} ===\n`);
  process.exit(fallos === 0 ? 0 : 1);
}
main().catch((e) => { console.error("Error fatal:", e); process.exit(1); });
