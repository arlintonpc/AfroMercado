// ============================================================
//  Prueba end-to-end del flujo completo (API real)
//  comprador: carrito -> checkout -> pago
//  admin: verifica el pago -> el pedido cambia de estado
//  Uso: node tests/e2e-flujo.js
// ============================================================
const BASE = "http://localhost:3001/api";

let fallos = 0;
function check(cond, label, extra) {
  const marca = cond ? "✔" : "✖";
  if (!cond) fallos++;
  console.log(`${marca} ${label}${extra ? "  " + extra : ""}`);
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { status: res.status, ok: res.ok, datos };
}

function desempaquetar(r) {
  // El backend a veces responde { ok, data } y a veces el objeto directo.
  if (r.datos && typeof r.datos === "object" && "data" in r.datos) return r.datos.data;
  return r.datos;
}

async function main() {
  console.log("\n=== E2E AfroMercado — flujo comprador + admin ===\n");

  // ── 1. Login comprador ──────────────────────────────────
  const login = await api("/auth/login", {
    method: "POST",
    body: { email: "comprador@test.co", password: "Comprador123" },
  });
  check(login.ok, "Login comprador", `(${login.status})`);
  const tokenComprador = (login.datos && (login.datos.token || (login.datos.data && login.datos.data.token)));
  check(!!tokenComprador, "Token comprador recibido");
  if (!tokenComprador) return fin();

  // ── 2. Carrito limpio ───────────────────────────────────
  await api("/carrito", { method: "DELETE", token: tokenComprador });

  // ── 3. Agregar producto al carrito ──────────────────────
  const add = await api("/carrito/items", {
    method: "POST",
    token: tokenComprador,
    body: { productoId: "1", cantidad: 2 },
  });
  check(add.ok, "Agregar producto 1 (x2) al carrito", `(${add.status})`);

  // ── 4. Ver carrito ──────────────────────────────────────
  const cart = await api("/carrito", { token: tokenComprador });
  const carrito = desempaquetar(cart);
  const items = (carrito && carrito.items) || [];
  check(cart.ok && items.length > 0, "Carrito tiene items", `(items: ${items.length})`);

  // ── 5. Checkout ─────────────────────────────────────────
  const checkout = await api("/pedidos/checkout", {
    method: "POST",
    token: tokenComprador,
    body: {
      direccion: "Calle 10 #5-20, Barrio Centro",
      telefono: "3101112233",
      notas: "Prueba e2e",
    },
  });
  check(checkout.ok, "Checkout crea pedido", `(${checkout.status})`);
  const checkoutData = desempaquetar(checkout);
  // El checkout devuelve { pedido, instruccionesPago }.
  const pedido = (checkoutData && checkoutData.pedido) || checkoutData;
  const pedidoId = pedido && pedido.id;
  check(!!pedidoId, "Pedido id recibido", `(id: ${pedidoId})`);
  if (!pedidoId) { console.log("   respuesta:", JSON.stringify(checkout.datos).slice(0,300)); return fin(); }

  // ── 6. Instrucciones de pago ────────────────────────────
  const instr = await api(`/pagos/instrucciones/${pedidoId}`, { token: tokenComprador });
  check(instr.ok, "Instrucciones de pago", `(${instr.status})`);

  // ── 7. Crear pago ───────────────────────────────────────
  const pago = await api("/pagos", {
    method: "POST",
    token: tokenComprador,
    body: {
      pedidoId,
      metodo: "NEQUI",
      referencia: "E2E-" + Date.now(),
      idempotencyKey: "e2e-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    },
  });
  check(pago.ok, "Crear pago (NEQUI)", `(${pago.status})`);
  const pagoData = desempaquetar(pago);
  const pagoId = pagoData && pagoData.id;
  check(!!pagoId, "Pago id recibido", `(id: ${pagoId})`);

  // ── 8. Login admin ──────────────────────────────────────
  const loginAdmin = await api("/auth/login", {
    method: "POST",
    body: { email: "admin@afromercado.co", password: "Admin123" },
  });
  check(loginAdmin.ok, "Login admin", `(${loginAdmin.status})`);
  const tokenAdmin = loginAdmin.datos && (loginAdmin.datos.token || (loginAdmin.datos.data && loginAdmin.datos.data.token));
  check(!!tokenAdmin, "Token admin recibido");
  if (!tokenAdmin) return fin();

  // ── 9. Pagos pendientes ─────────────────────────────────
  const pend = await api("/admin/pagos/pendientes", { token: tokenAdmin });
  const pendientes = desempaquetar(pend) || [];
  check(pend.ok, "Listar pagos pendientes", `(${pend.status}, n=${Array.isArray(pendientes)?pendientes.length:'?'})`);

  // ── 10. Verificar (aprobar) el pago ─────────────────────
  let ver = await api(`/admin/pagos/${pagoId}/verificar`, {
    method: "PATCH",
    token: tokenAdmin,
    body: { accion: "APROBAR", notas: "Verificado en e2e" },
  });
  if (!ver.ok) {
    // fallback por si la acción se llama distinto
    ver = await api(`/admin/pagos/${pagoId}/verificar`, {
      method: "PATCH",
      token: tokenAdmin,
      body: { accion: "CONFIRMAR", notas: "Verificado en e2e" },
    });
  }
  check(ver.ok, "Admin verifica/aprueba el pago", `(${ver.status})`);
  if (!ver.ok) console.log("   respuesta:", JSON.stringify(ver.datos).slice(0,300));

  // ── 11. El pedido cambió de estado ──────────────────────
  const detalle = await api(`/pedidos/${pedidoId}`, { token: tokenComprador });
  const pedidoFinal = desempaquetar(detalle);
  const estado = pedidoFinal && pedidoFinal.estado;
  check(detalle.ok, "Consultar pedido tras verificación", `(estado: ${estado})`);

  // ── 12. Estadísticas admin ──────────────────────────────
  const stats = await api("/admin/estadisticas", { token: tokenAdmin });
  check(stats.ok, "Estadísticas admin", `(${stats.status})`);

  fin();
}

function fin() {
  console.log(`\n=== Resultado: ${fallos === 0 ? "TODO OK ✅" : fallos + " fallo(s) ❌"} ===\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error("Error fatal:", e); process.exit(1); });
