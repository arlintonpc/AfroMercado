// ============================================================
//  E2E del comprobante de pago (multipart) + visibilidad admin
//  comprador: checkout -> pago -> subir comprobante (imagen)
//  admin: el pago aparece en pendientes y el comprobante se sirve
//  Uso: node tests/e2e-comprobante.js
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
function data(r) {
  if (r.datos && typeof r.datos === "object" && "data" in r.datos) return r.datos.data;
  return r.datos;
}
function tok(r) { return r.datos && (r.datos.token || (r.datos.data && r.datos.data.token)); }

// PNG transparente 1x1
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main() {
  console.log("\n=== E2E AfroMercado — comprobante de pago ===\n");

  // Comprador prepara un pedido con pago
  const lc = await api("/auth/login", { method: "POST", body: { email: "comprador@test.co", password: "Comprador123" } });
  const token = tok(lc);
  check(!!token, "Login comprador");
  if (!token) return fin();

  await api("/carrito", { method: "DELETE", token });
  await api("/carrito/items", { method: "POST", token, body: { productoId: "3", cantidad: 1 } });
  const co = await api("/pedidos/checkout", { method: "POST", token, body: { direccion: "Cra 1 #2-3", telefono: "3001234567" } });
  const cod = data(co);
  const pedido = (cod && cod.pedido) || cod;
  check(co.ok && pedido && pedido.id, "Checkout", `(pedido ${pedido && pedido.id})`);

  const pg = await api("/pagos", {
    method: "POST", token,
    body: { pedidoId: pedido.id, metodo: "NEQUI", referencia: "COMP-" + Date.now(), idempotencyKey: "comp-" + Date.now() },
  });
  const pago = data(pg);
  check(pg.ok && pago && pago.id, "Crear pago", `(pago ${pago && pago.id})`);
  if (!pago || !pago.id) return fin();

  // Subir comprobante (multipart)
  const fd = new FormData();
  const buf = Buffer.from(PNG_B64, "base64");
  fd.append("comprobante", new Blob([buf], { type: "image/png" }), "comprobante.png");
  const up = await fetch(`${BASE}/pagos/${pago.id}/comprobante`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const upText = await up.text();
  check(up.ok, "Subir comprobante (multipart)", `(${up.status})`);
  if (!up.ok) console.log("   resp:", upText.slice(0, 200));

  // Admin ve el pago en pendientes y puede servir el comprobante
  const la = await api("/auth/login", { method: "POST", body: { email: "admin@afromercado.co", password: "Admin123" } });
  const tokenAdmin = tok(la);
  check(!!tokenAdmin, "Login admin");

  const pend = await api("/admin/pagos/pendientes", { token: tokenAdmin });
  const lista = data(pend);
  const encontrado = Array.isArray(lista) && lista.some((x) => String(x.id) === String(pago.id));
  check(pend.ok && encontrado, "Pago aparece en pendientes del admin", `(n=${Array.isArray(lista) ? lista.length : "?"})`);

  const img = await fetch(`${BASE}/admin/pagos/${pago.id}/comprobante`, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
  const ct = img.headers.get("content-type") || "";
  check(img.ok && ct.startsWith("image/"), "Admin descarga el comprobante", `(${img.status}, ${ct})`);

  fin();
}
function fin() {
  console.log(`\n=== Resultado: ${fallos === 0 ? "TODO OK ✅" : fallos + " fallo(s) ❌"} ===\n`);
  process.exit(fallos === 0 ? 0 : 1);
}
main().catch((e) => { console.error("Error fatal:", e); process.exit(1); });
