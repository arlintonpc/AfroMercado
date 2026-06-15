import { useState } from "react";

const DATA = {
  tablas: {
    titulo: "Tablas Principales",
    items: [
      { n: "usuarios", e: "👤", d: "Todos los tipos de usuario", c: ["id UUID PK", "nombre VARCHAR", "email VARCHAR", "rol ENUM", "created_at TIMESTAMP"], f: "F1" },
      { n: "comercios", e: "🏪", d: "Tiendas y negocios registrados", c: ["id UUID PK", "usuario_id FK", "nombre VARCHAR", "categoria ENUM", "municipio VARCHAR"], f: "F1" },
      { n: "productos", e: "📦", d: "Catálogo de productos", c: ["id UUID PK", "comercio_id FK", "nombre VARCHAR", "precio DECIMAL", "stock INT", "tipo ENUM"], f: "F1" },
      { n: "pedidos", e: "🛒", d: "Órdenes de compra", c: ["id UUID PK", "comprador_id FK", "estado ENUM", "total DECIMAL", "fecha TIMESTAMP"], f: "F1" },
      { n: "pedido_items", e: "🧾", d: "Productos dentro de un pedido", c: ["id UUID PK", "pedido_id FK", "producto_id FK", "cantidad INT", "precio_unitario DECIMAL"], f: "F1" },
      { n: "pagos", e: "💳", d: "Transacciones y split de pagos", c: ["id UUID PK", "pedido_id FK", "monto DECIMAL", "comision DECIMAL", "estado ENUM"], f: "F1" },
      { n: "rutas", e: "🗺️", d: "Corredores logísticos del Chocó", c: ["id UUID PK", "nombre VARCHAR", "origen VARCHAR", "destinos JSONB", "medio ENUM"], f: "F2" },
      { n: "entregas", e: "🚚", d: "Asignación de repartidores", c: ["id UUID PK", "pedido_id FK", "repartidor_id FK", "ruta_id FK", "estado ENUM"], f: "F2" },
      { n: "comunidades", e: "🌿", d: "Comunidades indígenas registradas", c: ["id UUID PK", "nombre VARCHAR", "territorio VARCHAR", "resguardo VARCHAR", "miembros INT"], f: "F2" },
      { n: "resenas", e: "⭐", d: "Calificaciones y comentarios", c: ["id UUID PK", "comprador_id FK", "comercio_id FK", "rating INT", "comentario TEXT"], f: "F3" },
    ],
    nota: "PostgreSQL con extensión UUID y JSONB para datos flexibles del Chocó"
  },
  relaciones: {
    titulo: "Relaciones de Base de Datos",
    items: [
      { a: "usuarios", rel: "1:N", b: "comercios", d: "Un usuario puede tener varios comercios" },
      { a: "comercios", rel: "1:N", b: "productos", d: "Un comercio tiene muchos productos" },
      { a: "pedidos", rel: "N:M", b: "productos", d: "Un pedido tiene muchos productos (via pedido_items)" },
      { a: "pedidos", rel: "1:1", b: "pagos", d: "Cada pedido genera un pago con split automático" },
      { a: "pedidos", rel: "1:N", b: "entregas", d: "Un pedido puede tener varias entregas agrupadas" },
      { a: "comunidades", rel: "1:N", b: "usuarios", d: "Una comunidad tiene múltiples miembros/vendedores" },
      { a: "rutas", rel: "1:N", b: "entregas", d: "Una ruta agrupa múltiples entregas del día" },
      { a: "usuarios", rel: "1:N", b: "resenas", d: "Un comprador puede dejar varias reseñas" },
    ],
    nota: "Patrón normalizado 3FN con JSONB para datos variables por municipio"
  },
  pagos: {
    titulo: "Modelo de Pagos",
    flujo: "Comprador paga → AfroMercado recibe → descuenta 10% → transfiere a comerciante vía Wompi",
    items: [
      { n: "pagos", e: "💳", d: "Transacción principal del pedido", c: ["id UUID PK", "pedido_id FK", "monto_total DECIMAL", "comision_afro DECIMAL", "monto_comerciante DECIMAL", "estado ENUM", "wompi_ref VARCHAR"] },
      { n: "splits", e: "✂️", d: "Distribución por comerciante", c: ["id UUID PK", "pago_id FK", "comercio_id FK", "monto DECIMAL", "porcentaje DECIMAL", "transferido_at TIMESTAMP"] },
      { n: "splits_comunidad", e: "🌿", d: "Distribución colectiva indígena", c: ["id UUID PK", "split_id FK", "comunidad_id FK", "miembro_id FK", "monto_individual DECIMAL"] },
      { n: "retiros", e: "🏦", d: "Solicitudes de pago a comerciantes", c: ["id UUID PK", "comercio_id FK", "monto DECIMAL", "metodo ENUM", "estado ENUM", "procesado_at TIMESTAMP"] },
    ],
    nota: "Wompi Split Payouts API para dispersión automática programada"
  },
  logistica: {
    titulo: "Módulo Logístico",
    agrup: "Pedidos agrupados por corredor + ventana de tiempo de 4 horas",
    items: [
      { n: "rutas", e: "🗺️", d: "Corredores fijos del Chocó", c: ["id UUID PK", "nombre VARCHAR", "origen VARCHAR", "destinos JSONB", "medio ENUM", "frecuencia ENUM", "tiempo_estimado INT"] },
      { n: "lotes_entrega", e: "📦", d: "Agrupación de pedidos por ruta", c: ["id UUID PK", "ruta_id FK", "repartidor_id FK", "fecha DATE", "ventana_inicio TIME", "ventana_fin TIME", "estado ENUM"] },
      { n: "entregas", e: "🚚", d: "Entrega individual dentro de un lote", c: ["id UUID PK", "lote_id FK", "pedido_id FK", "orden_entrega INT", "estado ENUM", "confirmado_at TIMESTAMP"] },
      { n: "repartidores", e: "🧑", d: "Repartidores aliados locales", c: ["id UUID PK", "usuario_id FK", "vehiculo ENUM", "municipio VARCHAR", "activo BOOLEAN", "calificacion DECIMAL"] },
    ],
    nota: "Campo ventana_tiempo en lotes_entrega es clave para agrupación inteligente"
  },
  seguridad: {
    titulo: "Seguridad y Roles",
    auth: "JWT con refresh token, expiración 24h, roles en payload cifrado",
    roles: [
      { n: "Comprador", e: "🛒", p: ["Ver catálogo", "Crear pedidos", "Ver historial", "Dejar reseñas"], r: ["No accede a datos de otros", "No modifica productos"] },
      { n: "Comerciante", e: "🏪", p: ["Gestionar productos", "Ver sus pedidos", "Ver sus métricas", "Editar perfil"], r: ["Solo ve sus propios datos", "No accede a pagos de otros"] },
      { n: "Comunidad Indígena", e: "🌿", p: ["Gestionar catálogo colectivo", "Ver ingresos comunidad", "Publicar contenido cultural"], r: ["Distribución requiere aprobación líder", "No modifica datos de otros miembros"] },
      { n: "Repartidor", e: "🚚", p: ["Ver lotes asignados", "Confirmar entregas", "Ver ganancias", "Navegar rutas"], r: ["Solo ve pedidos asignados", "No accede a datos de pago completos"] },
      { n: "Administrador", e: "⚙️", p: ["Acceso total al sistema", "Aprobar comerciantes", "Gestionar pagos", "Ver todos los reportes"], r: ["Acciones destructivas requieren 2FA", "Log de auditoría obligatorio"] },
    ],
    nota: "Cifrar datos sensibles: números de cuenta, ubicaciones en tiempo real y datos personales"
  }
};

export default function AgenteDatabase() {
  const [consultaActiva, setConsultaActiva] = useState(null);

  const consultas = [
    { id: "tablas", emoji: "📋", nombre: "Tablas Principales", desc: "Entidades clave del sistema" },
    { id: "relaciones", emoji: "🔗", nombre: "Relaciones", desc: "Cómo se conectan las tablas" },
    { id: "pagos", emoji: "💳", nombre: "Modelo de Pagos", desc: "Split de pagos y comisiones" },
    { id: "logistica", emoji: "🚚", nombre: "Módulo Logístico", desc: "Pedidos, rutas y entregas" },
    { id: "seguridad", emoji: "🔒", nombre: "Seguridad y Roles", desc: "Permisos por tipo de usuario" },
  ];

  const faseColor = (f) => f === "F1" ? "#4a9a4a" : f === "F2" ? "#9a9a4a" : "#9a6a4a";
  const card = { background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "14px", padding: "16px", marginBottom: "12px" };
  const cardDark = { background: "#2a1a0a", border: "1px solid #5a3a1a", borderRadius: "14px", padding: "14px", marginBottom: "12px" };
  const label = { color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px 0", fontWeight: "700" };

  const resultado = consultaActiva ? DATA[consultaActiva.id] : null;

  const renderResultado = () => {
    if (!resultado) return null;
    const id = consultaActiva.id;

    if (id === "tablas") return (
      <>
        {resultado.items.map((item, i) => (
          <div key={i} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>{item.e}</span>
                <div>
                  <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "13px", fontWeight: "700", fontFamily: "monospace" }}>{item.n}</h4>
                  <p style={{ color: "#8db88d", margin: 0, fontSize: "12px" }}>{item.d}</p>
                </div>
              </div>
              <span style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", color: faseColor(item.f) }}>{item.f}</span>
            </div>
            <div style={{ background: "#0f1a0f", borderRadius: "8px", padding: "10px" }}>
              {item.c.map((campo, j) => (
                <p key={j} style={{ color: "#b0c9b0", fontSize: "12px", margin: "0 0 3px 0", fontFamily: "monospace" }}>
                  <span style={{ color: "#c8a96e" }}>→</span> {campo}
                </p>
              ))}
            </div>
          </div>
        ))}
        <div style={cardDark}><p style={label}>💡 Motor BD</p><p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.nota}</p></div>
      </>
    );

    if (id === "relaciones") return (
      <>
        {resultado.items.map((r, i) => (
          <div key={i} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <span style={{ color: "#f0ede6", fontFamily: "monospace", fontSize: "13px", fontWeight: "700" }}>{r.a}</span>
              <span style={{ background: "#0f2a0f", border: "1px solid #1d4a1d", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", color: "#8db85d" }}>{r.rel}</span>
              <span style={{ color: "#f0ede6", fontFamily: "monospace", fontSize: "13px", fontWeight: "700" }}>{r.b}</span>
            </div>
            <p style={{ color: "#8db88d", fontSize: "12px", margin: 0 }}>{r.d}</p>
          </div>
        ))}
        <div style={cardDark}><p style={label}>📐 Patrón</p><p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.nota}</p></div>
      </>
    );

    if (id === "pagos") return (
      <>
        <div style={{ ...card, background: "#0f2a0f", borderColor: "#1d5a1d" }}>
          <p style={label}>💰 Flujo del Dinero</p>
          <p style={{ color: "#8db85d", fontSize: "14px", margin: 0, fontWeight: "700" }}>{resultado.flujo}</p>
        </div>
        {resultado.items.map((item, i) => (
          <div key={i} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ fontSize: "20px" }}>{item.e}</span>
              <div>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "13px", fontWeight: "700", fontFamily: "monospace" }}>{item.n}</h4>
                <p style={{ color: "#8db88d", margin: 0, fontSize: "12px" }}>{item.d}</p>
              </div>
            </div>
            <div style={{ background: "#0f1a0f", borderRadius: "8px", padding: "10px" }}>
              {item.c.map((campo, j) => (
                <p key={j} style={{ color: "#b0c9b0", fontSize: "12px", margin: "0 0 3px 0", fontFamily: "monospace" }}>
                  <span style={{ color: "#c8a96e" }}>→</span> {campo}
                </p>
              ))}
            </div>
          </div>
        ))}
        <div style={cardDark}><p style={label}>🔌 Wompi</p><p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.nota}</p></div>
      </>
    );

    if (id === "logistica") return (
      <>
        <div style={{ ...card, background: "#0f2a0f", borderColor: "#1d5a1d" }}>
          <p style={label}>📦 Agrupación Inteligente</p>
          <p style={{ color: "#8db85d", fontSize: "14px", margin: 0, fontWeight: "700" }}>{resultado.agrup}</p>
        </div>
        {resultado.items.map((item, i) => (
          <div key={i} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ fontSize: "20px" }}>{item.e}</span>
              <div>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "13px", fontWeight: "700", fontFamily: "monospace" }}>{item.n}</h4>
                <p style={{ color: "#8db88d", margin: 0, fontSize: "12px" }}>{item.d}</p>
              </div>
            </div>
            <div style={{ background: "#0f1a0f", borderRadius: "8px", padding: "10px" }}>
              {item.c.map((campo, j) => (
                <p key={j} style={{ color: "#b0c9b0", fontSize: "12px", margin: "0 0 3px 0", fontFamily: "monospace" }}>
                  <span style={{ color: "#c8a96e" }}>→</span> {campo}
                </p>
              ))}
            </div>
          </div>
        ))}
        <div style={cardDark}><p style={label}>💡 Insight Clave</p><p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.nota}</p></div>
      </>
    );

    if (id === "seguridad") return (
      <>
        <div style={{ ...card, background: "#0f2a0f", borderColor: "#1d5a1d" }}>
          <p style={label}>🔑 Autenticación JWT</p>
          <p style={{ color: "#8db85d", fontSize: "14px", margin: 0, fontWeight: "700" }}>{resultado.auth}</p>
        </div>
        {resultado.roles.map((r, i) => (
          <div key={i} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ fontSize: "20px" }}>{r.e}</span>
              <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>{r.n}</h4>
            </div>
            <p style={{ color: "#6a9a6a", fontSize: "11px", margin: "0 0 4px 0" }}>PERMISOS</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
              {r.p.map((p, j) => <span key={j} style={{ background: "#0f2a0f", border: "1px solid #1d4a1d", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#8db85d" }}>{p}</span>)}
            </div>
            <p style={{ color: "#6a3a3a", fontSize: "11px", margin: "0 0 4px 0" }}>RESTRICCIONES</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {r.r.map((p, j) => <span key={j} style={{ background: "#2a0f0f", border: "1px solid #4a1d1d", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#e87070" }}>{p}</span>)}
            </div>
          </div>
        ))}
        <div style={cardDark}><p style={label}>🛡️ Cifrado</p><p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.nota}</p></div>
      </>
    );

    return null;
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f1a0f", minHeight: "100vh", padding: "20px", color: "#f0ede6" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "38px", marginBottom: "4px" }}>🗄️</div>
        <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#c8a96e", margin: "0 0 4px 0" }}>AfroMercado</h1>
        <p style={{ color: "#8db88d", fontSize: "12px", margin: 0 }}>Arquitectura · Base de Datos</p>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto 20px auto" }}>
        <p style={{ color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", marginBottom: "12px", fontWeight: "700" }}>¿Qué módulo explorar?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {consultas.map(c => (
            <button key={c.id} onClick={() => setConsultaActiva(c)} style={{
              background: consultaActiva?.id === c.id ? "linear-gradient(135deg, #c8a96e, #a07840)" : "#1a2e1a",
              border: consultaActiva?.id === c.id ? "none" : "1px solid #2d4a2d",
              borderRadius: "12px", padding: "12px 16px",
              color: consultaActiva?.id === c.id ? "#0f1a0f" : "#b0c9b0",
              fontSize: "14px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "10px", textAlign: "left"
            }}>
              <span style={{ fontSize: "20px" }}>{c.emoji}</span>
              <div><div>{c.nombre}</div><div style={{ fontSize: "12px", fontWeight: "400", opacity: 0.8 }}>{c.desc}</div></div>
            </button>
          ))}
        </div>
      </div>

      {resultado && (
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "14px", padding: "14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>{consultaActiva.emoji}</span>
            <h3 style={{ color: "#c8a96e", margin: 0, fontSize: "15px", fontWeight: "700" }}>{resultado.titulo}</h3>
          </div>
          {renderResultado()}
          <p style={{ color: "#5a7a5a", fontSize: "12px", textAlign: "center", marginBottom: "24px" }}>Selecciona otro módulo arriba para continuar</p>
        </div>
      )}
    </div>
  );
}
