import { useState } from "react";

const DATA = {
  tablas: {
    titulo: "Tablas Principales",
    items: [
      { n: "usuarios", e: "👤", d: "Todos los tipos de usuario", c: ["id UUID PK", "nombre VARCHAR", "email VARCHAR", "rol ENUM"], f: "F1" },
      { n: "comercios", e: "🏪", d: "Tiendas y negocios", c: ["id UUID PK", "usuario_id FK", "nombre VARCHAR", "municipio VARCHAR"], f: "F1" },
      { n: "productos", e: "📦", d: "Catálogo de productos", c: ["id UUID PK", "comercio_id FK", "precio DECIMAL", "stock INT"], f: "F1" },
      { n: "pedidos", e: "🛒", d: "Órdenes de compra", c: ["id UUID PK", "comprador_id FK", "estado ENUM", "total DECIMAL"], f: "F1" },
      { n: "pagos", e: "💳", d: "Transacciones y split", c: ["id UUID PK", "pedido_id FK", "comision DECIMAL", "estado ENUM"], f: "F1" },
      { n: "rutas", e: "🗺️", d: "Corredores del Chocó", c: ["id UUID PK", "origen VARCHAR", "destinos JSONB", "medio ENUM"], f: "F2" },
      { n: "comunidades", e: "🌿", d: "Comunidades indígenas", c: ["id UUID PK", "territorio VARCHAR", "resguardo VARCHAR"], f: "F2" },
    ],
    nota: "PostgreSQL con UUID y JSONB para datos flexibles"
  },
  relaciones: {
    titulo: "Relaciones",
    items: [
      { a: "usuarios", rel: "1:N", b: "comercios", d: "Un usuario tiene varios comercios" },
      { a: "comercios", rel: "1:N", b: "productos", d: "Un comercio tiene muchos productos" },
      { a: "pedidos", rel: "N:M", b: "productos", d: "Pedido con varios productos" },
      { a: "pedidos", rel: "1:1", b: "pagos", d: "Cada pedido genera un pago" },
      { a: "comunidades", rel: "1:N", b: "usuarios", d: "Comunidad con varios miembros" },
      { a: "rutas", rel: "1:N", b: "pedidos", d: "Una ruta agrupa varios pedidos" },
    ],
    nota: "Patrón normalizado 3FN con JSONB para datos variables"
  },
  pagos: {
    titulo: "Modelo de Pagos",
    extra: "Comprador paga → AfroMercado descuenta 10% → transfiere a comerciante vía Wompi",
    extraLabel: "💰 Flujo del Dinero",
    items: [
      { n: "pagos", e: "💳", d: "Transacción del pedido", c: ["id UUID PK", "monto_total DECIMAL", "comision_afro DECIMAL", "estado ENUM"] },
      { n: "splits", e: "✂️", d: "Distribución por comerciante", c: ["id UUID PK", "pago_id FK", "comercio_id FK", "monto DECIMAL"] },
      { n: "splits_comunidad", e: "🌿", d: "Distribución colectiva", c: ["id UUID PK", "split_id FK", "miembro_id FK", "monto DECIMAL"] },
      { n: "retiros", e: "🏦", d: "Pagos a comerciantes", c: ["id UUID PK", "comercio_id FK", "metodo ENUM", "estado ENUM"] },
    ],
    nota: "Wompi Split Payouts para dispersión automática"
  },
  logistica: {
    titulo: "Módulo Logístico",
    extra: "Pedidos agrupados por corredor + ventana de tiempo de 4 horas",
    extraLabel: "📦 Agrupación Inteligente",
    items: [
      { n: "rutas", e: "🗺️", d: "Corredores fijos del Chocó", c: ["id UUID PK", "origen VARCHAR", "destinos JSONB", "frecuencia ENUM"] },
      { n: "lotes_entrega", e: "📦", d: "Agrupación por ruta", c: ["id UUID PK", "ruta_id FK", "fecha DATE", "ventana_tiempo TIME"] },
      { n: "entregas", e: "🚚", d: "Entrega individual", c: ["id UUID PK", "lote_id FK", "pedido_id FK", "estado ENUM"] },
      { n: "repartidores", e: "🧑", d: "Repartidores aliados", c: ["id UUID PK", "vehiculo ENUM", "municipio VARCHAR", "activo BOOL"] },
    ],
    nota: "El campo ventana_tiempo es clave para agrupar de forma inteligente"
  },
  seguridad: {
    titulo: "Seguridad y Roles",
    extra: "JWT con refresh token, expiración 24h, roles en payload cifrado",
    extraLabel: "🔑 Autenticación JWT",
    roles: [
      { n: "Comprador", e: "🛒", p: ["Ver catálogo", "Crear pedidos", "Dejar reseñas"], r: ["No ve datos de otros"] },
      { n: "Comerciante", e: "🏪", p: ["Gestionar productos", "Ver sus pedidos", "Ver métricas"], r: ["Solo ve sus datos"] },
      { n: "Comunidad Indígena", e: "🌿", p: ["Catálogo colectivo", "Ver ingresos", "Publicar contenido"], r: ["Requiere aprobación de líder"] },
      { n: "Repartidor", e: "🚚", p: ["Ver lotes", "Confirmar entregas", "Ver ganancias"], r: ["Solo pedidos asignados"] },
      { n: "Administrador", e: "⚙️", p: ["Acceso total", "Aprobar comercios", "Ver reportes"], r: ["Acciones críticas con 2FA"] },
    ],
    nota: "Cifrar números de cuenta, ubicaciones y datos personales"
  }
};

const MENU = [
  { id: "tablas", emoji: "📋", nombre: "Tablas Principales" },
  { id: "relaciones", emoji: "🔗", nombre: "Relaciones" },
  { id: "pagos", emoji: "💳", nombre: "Modelo de Pagos" },
  { id: "logistica", emoji: "🚚", nombre: "Módulo Logístico" },
  { id: "seguridad", emoji: "🔒", nombre: "Seguridad y Roles" },
];

export default function BaseDatos() {
  const [activa, setActiva] = useState("tablas");
  const d = DATA[activa];

  const card = { background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "12px", padding: "14px", marginBottom: "10px" };
  const label = { color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px 0", fontWeight: "700" };
  const faseColor = (f) => f === "F1" ? "#4a9a4a" : f === "F2" ? "#9a9a4a" : "#9a6a4a";

  return (
    <div style={{ fontFamily: "sans-serif", background: "#0f1a0f", minHeight: "100vh", padding: "16px", color: "#f0ede6" }}>

      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "32px" }}>🗄️</div>
        <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#c8a96e", margin: "4px 0" }}>AfroMercado</h1>
        <p style={{ color: "#8db88d", fontSize: "12px", margin: 0 }}>Arquitectura · Base de Datos</p>
      </div>

      {/* Menú horizontal */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "16px" }}>
        {MENU.map(m => (
          <button key={m.id} onClick={() => setActiva(m.id)} style={{
            background: activa === m.id ? "#c8a96e" : "#1a2e1a",
            border: activa === m.id ? "none" : "1px solid #2d4a2d",
            borderRadius: "10px", padding: "8px 12px",
            color: activa === m.id ? "#0f1a0f" : "#b0c9b0",
            fontSize: "12px", fontWeight: "700", cursor: "pointer"
          }}>
            {m.emoji} {m.nombre}
          </button>
        ))}
      </div>

      {/* Título sección */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "20px" }}>{MENU.find(m => m.id === activa).emoji}</span>
        <h3 style={{ color: "#c8a96e", margin: 0, fontSize: "15px" }}>{d.titulo}</h3>
      </div>

      {/* Extra (flujo/agrupación/auth) */}
      {d.extra && (
        <div style={{ ...card, background: "#0f2a0f", borderColor: "#1d5a1d" }}>
          <p style={label}>{d.extraLabel}</p>
          <p style={{ color: "#8db85d", fontSize: "13px", margin: 0, fontWeight: "700" }}>{d.extra}</p>
        </div>
      )}

      {/* Tablas con campos (no relaciones) */}
      {activa !== "relaciones" && d.items && d.items.map((item, i) => (
        <div key={i} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "18px" }}>{item.e}</span>
              <div>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "13px", fontFamily: "monospace" }}>{item.n}</h4>
                <p style={{ color: "#8db88d", margin: 0, fontSize: "11px" }}>{item.d}</p>
              </div>
            </div>
            {item.f && <span style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "5px", padding: "2px 7px", fontSize: "10px", color: faseColor(item.f) }}>{item.f}</span>}
          </div>
          <div style={{ background: "#0f1a0f", borderRadius: "7px", padding: "8px" }}>
            {item.c.map((campo, j) => (
              <p key={j} style={{ color: "#b0c9b0", fontSize: "11px", margin: "0 0 2px 0", fontFamily: "monospace" }}>
                <span style={{ color: "#c8a96e" }}>→</span> {campo}
              </p>
            ))}
          </div>
        </div>
      ))}

      {/* Relaciones */}
      {activa === "relaciones" && d.items.map((r, i) => (
        <div key={i} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
            <span style={{ color: "#f0ede6", fontFamily: "monospace", fontSize: "12px", fontWeight: "700" }}>{r.a}</span>
            <span style={{ background: "#0f2a0f", border: "1px solid #1d4a1d", borderRadius: "12px", padding: "2px 8px", fontSize: "10px", color: "#8db85d" }}>{r.rel}</span>
            <span style={{ color: "#f0ede6", fontFamily: "monospace", fontSize: "12px", fontWeight: "700" }}>{r.b}</span>
          </div>
          <p style={{ color: "#8db88d", fontSize: "11px", margin: 0 }}>{r.d}</p>
        </div>
      ))}



      {/* Roles (seguridad) */}
      {d.roles && d.roles.map((r, i) => (
        <div key={i} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px" }}>{r.e}</span>
            <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "13px" }}>{r.n}</h4>
          </div>
          <p style={{ color: "#6a9a6a", fontSize: "10px", margin: "0 0 4px 0" }}>PERMISOS</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
            {r.p.map((p, j) => <span key={j} style={{ background: "#0f2a0f", border: "1px solid #1d4a1d", borderRadius: "12px", padding: "2px 7px", fontSize: "10px", color: "#8db85d" }}>{p}</span>)}
          </div>
          <p style={{ color: "#6a3a3a", fontSize: "10px", margin: "0 0 4px 0" }}>RESTRICCIONES</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {r.r.map((p, j) => <span key={j} style={{ background: "#2a0f0f", border: "1px solid #4a1d1d", borderRadius: "12px", padding: "2px 7px", fontSize: "10px", color: "#e87070" }}>{p}</span>)}
          </div>
        </div>
      ))}

      {/* Nota final */}
      {d.nota && (
        <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
          <p style={label}>💡 Recomendación</p>
          <p style={{ color: "#c9b090", fontSize: "12px", margin: 0 }}>{d.nota}</p>
        </div>
      )}
    </div>
  );
}
