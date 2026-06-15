import { useState } from "react";

// ===== PALETA AFROMERCADO =====
// Inspirada en la selva del Chocó, el oro artesanal y los textiles ancestrales
const C = {
  fondo: "#0e1a12",       // verde selva profundo
  fondoCard: "#16271b",   // verde card
  borde: "#264532",       // verde borde
  oroReal: "#d4a23c",     // oro chocoano
  oroSuave: "#e8c478",
  crema: "#f2ede1",       // texto claro
  verde: "#7fb069",       // verde hoja
  verdeClaro: "#a3c585",
  tierra: "#b5651d",      // terracota
  texto: "#cdd9cd",
  textoTenue: "#7a8c7a",
};

// ===== DATOS DEMO =====
const PILARES = [
  { id: "campo", nombre: "Del Campo", emoji: "🌾" },
  { id: "artesania", nombre: "Artesanías", emoji: "🧺" },
  { id: "restaurante", nombre: "Cocina", emoji: "🍲" },
  { id: "turismo", nombre: "Turismo", emoji: "🌴" },
];

const PRODUCTOS = [
  { id: 1, nombre: "Borojó fresco", precio: 8000, unidad: "libra", comercio: "Finca La Esperanza", municipio: "Quibdó", pilar: "campo", emoji: "🟤", origen: "Cultivado a orillas del río Atrato por la familia Mosquera durante tres generaciones.", vendedor: "Doña Edilma Mosquera" },
  { id: 2, nombre: "Canasto en werregue", precio: 145000, unidad: "unidad", comercio: "Resguardo Wounaan", municipio: "Litoral San Juan", pilar: "artesania", emoji: "🧺", origen: "Tejido a mano con fibra de palma werregue. Cada pieza toma hasta 3 semanas de trabajo.", vendedor: "Comunidad Wounaan" },
  { id: 3, nombre: "Pescado ahumado", precio: 22000, unidad: "libra", comercio: "Pescadería El Atrato", municipio: "Istmina", pilar: "campo", emoji: "🐟", origen: "Bocachico ahumado con leña de la región según técnica tradicional ribereña.", vendedor: "Carlos Rentería" },
  { id: 4, nombre: "Chocolate de mesa", precio: 12000, unidad: "barra", comercio: "Cacao del Pacífico", municipio: "Tadó", pilar: "campo", emoji: "🍫", origen: "Cacao fino de aroma, tostado y molido artesanalmente en piedra.", vendedor: "Asoc. Cacaotera" },
  { id: 5, nombre: "Aceite de coco", precio: 18000, unidad: "frasco", comercio: "Cosméticos Naturales", municipio: "Nuquí", pilar: "campo", emoji: "🥥", origen: "Extraído en frío de cocos de la costa pacífica. Sin químicos.", vendedor: "Mujeres de Nuquí" },
  { id: 6, nombre: "Collar de chaquiras", precio: 65000, unidad: "unidad", comercio: "Arte Emberá", municipio: "Alto Baudó", pilar: "artesania", emoji: "📿", origen: "Tejido en chaquira por artesanas Emberá con diseños tradicionales.", vendedor: "Comunidad Emberá" },
];

const PEDIDOS_COMERCIANTE = [
  { id: "#A1042", producto: "Borojó fresco x3", cliente: "María en Medellín", estado: "Por despachar", monto: 24000 },
  { id: "#A1041", producto: "Chocolate de mesa x5", cliente: "José en Bogotá", estado: "En ruta", monto: 60000 },
  { id: "#A1038", producto: "Pescado ahumado x2", cliente: "Ana en Cali", estado: "Entregado", monto: 44000 },
];

function money(n) {
  return "$" + n.toLocaleString("es-CO");
}

// ===== APP =====
export default function Prototipo() {
  const [rol, setRol] = useState(null); // null, "comprador", "comerciante"
  const [pantalla, setPantalla] = useState("explorar");
  const [productoSel, setProductoSel] = useState(null);
  const [pilarActivo, setPilarActivo] = useState("todos");
  const [carrito, setCarrito] = useState([]);

  const wrap = {
    maxWidth: 420, margin: "0 auto", background: C.fondo, minHeight: "100vh",
    fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.texto, position: "relative",
    boxShadow: "0 0 40px rgba(0,0,0,0.5)"
  };

  // ===== SELECTOR DE ROL (pantalla inicial) =====
  if (!rol) {
    return (
      <div style={{ background: C.fondo, minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🌿</div>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: C.oroReal, margin: "0 0 4px 0", letterSpacing: -0.5 }}>AfroMercado</h1>
          <p style={{ color: C.verde, fontSize: 15, margin: "0 0 8px 0", fontStyle: "italic" }}>El corazón del Chocó, conectado al mundo</p>
          <div style={{ width: 60, height: 3, background: C.oroReal, margin: "20px auto 36px auto", borderRadius: 2 }} />
          <p style={{ color: C.textoTenue, fontSize: 13, textTransform: "uppercase", letterSpacing: 2, marginBottom: 20 }}>Vista de demostración</p>
          <p style={{ color: C.texto, fontSize: 15, marginBottom: 24 }}>¿Cómo quieres explorar el prototipo?</p>

          <button onClick={() => { setRol("comprador"); setPantalla("explorar"); }} style={{
            width: "100%", background: `linear-gradient(135deg, ${C.oroReal}, ${C.tierra})`, color: C.fondo,
            border: "none", borderRadius: 16, padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10
          }}>
            <span style={{ fontSize: 24 }}>🛒</span> Soy Comprador
          </button>

          <button onClick={() => { setRol("comerciante"); setPantalla("dashboard"); }} style={{
            width: "100%", background: C.fondoCard, color: C.crema, border: `1px solid ${C.borde}`,
            borderRadius: 16, padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10
          }}>
            <span style={{ fontSize: 24 }}>🏪</span> Soy Comerciante
          </button>
        </div>
      </div>
    );
  }

  // ===== BARRA SUPERIOR =====
  const TopBar = ({ titulo }) => (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.borde}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: C.fondo, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>🌿</span>
        <span style={{ fontWeight: 800, color: C.oroReal, fontSize: 18 }}>{titulo}</span>
      </div>
      <button onClick={() => setRol(null)} style={{ background: "transparent", border: `1px solid ${C.borde}`, color: C.textoTenue, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
        Cambiar rol
      </button>
    </div>
  );

  // ===== COMPRADOR: EXPLORAR =====
  const Explorar = () => {
    const productosFiltrados = pilarActivo === "todos" ? PRODUCTOS : PRODUCTOS.filter(p => p.pilar === pilarActivo);
    return (
      <div style={{ paddingBottom: 80 }}>
        <TopBar titulo="AfroMercado" />
        <div style={{ padding: "18px 18px 0 18px" }}>
          <div style={{ background: `linear-gradient(135deg, ${C.tierra}33, ${C.oroReal}22)`, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.oroSuave, fontWeight: 600 }}>✨ Productos con historia</p>
            <p style={{ margin: "4px 0 0 0", fontSize: 15, color: C.crema, lineHeight: 1.4 }}>Cada compra apoya directamente a familias y comunidades del Chocó.</p>
          </div>

          {/* Buscador */}
          <div style={{ background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: "11px 14px", marginBottom: 16, color: C.textoTenue, fontSize: 14 }}>
            🔍 Buscar borojó, werregue, pescado...
          </div>

          {/* Pilares */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, paddingBottom: 4 }}>
            <Chip activo={pilarActivo === "todos"} onClick={() => setPilarActivo("todos")} label="Todos" emoji="🌍" />
            {PILARES.map(p => (
              <Chip key={p.id} activo={pilarActivo === p.id} onClick={() => setPilarActivo(p.id)} label={p.nombre} emoji={p.emoji} />
            ))}
          </div>
        </div>

        {/* Grid productos */}
        <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {productosFiltrados.map(prod => (
            <div key={prod.id} onClick={() => { setProductoSel(prod); setPantalla("detalle"); }} style={{
              background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 12, cursor: "pointer"
            }}>
              <div style={{ fontSize: 44, textAlign: "center", margin: "8px 0 12px 0" }}>{prod.emoji}</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.crema }}>{prod.nombre}</p>
              <p style={{ margin: "2px 0 8px 0", fontSize: 11, color: C.textoTenue }}>📍 {prod.municipio}</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.oroReal }}>{money(prod.precio)}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.verde }}>/ {prod.unidad}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== COMPRADOR: DETALLE =====
  const Detalle = () => {
    const prod = productoSel;
    if (!prod) return null;
    return (
      <div style={{ paddingBottom: 100 }}>
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: C.fondo, zIndex: 10, borderBottom: `1px solid ${C.borde}` }}>
          <button onClick={() => setPantalla("explorar")} style={{ background: C.fondoCard, border: `1px solid ${C.borde}`, color: C.crema, borderRadius: 10, width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>←</button>
          <span style={{ fontWeight: 700, color: C.crema, fontSize: 16 }}>Detalle del producto</span>
        </div>

        <div style={{ fontSize: 110, textAlign: "center", padding: "30px 0", background: `radial-gradient(circle, ${C.fondoCard}, ${C.fondo})` }}>{prod.emoji}</div>

        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "inline-block", background: `${C.verde}22`, border: `1px solid ${C.verde}55`, color: C.verdeClaro, fontSize: 11, padding: "3px 10px", borderRadius: 20, marginBottom: 10 }}>
            {PILARES.find(p => p.id === prod.pilar)?.emoji} {PILARES.find(p => p.id === prod.pilar)?.nombre}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 24, color: C.crema, fontWeight: 800 }}>{prod.nombre}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: C.textoTenue }}>📍 {prod.municipio} · {prod.comercio}</p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: C.oroReal }}>{money(prod.precio)}</span>
            <span style={{ fontSize: 14, color: C.verde }}>/ {prod.unidad}</span>
          </div>

          {/* Historia / Storytelling */}
          <div style={{ background: C.fondoCard, border: `1px solid ${C.borde}`, borderLeft: `3px solid ${C.oroReal}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: "0 0 6px 0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: C.oroSuave, fontWeight: 700 }}>📖 La historia detrás</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.texto, fontStyle: "italic" }}>"{prod.origen}"</p>
            <p style={{ margin: "10px 0 0 0", fontSize: 13, color: C.verdeClaro, fontWeight: 600 }}>— {prod.vendedor}</p>
          </div>

          {/* Comercio justo */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 20 }}>🤝</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: C.textoTenue }}>Comercio justo</p>
            </div>
            <div style={{ flex: 1, background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 20 }}>🚚</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: C.textoTenue }}>Entrega 3-5 días</p>
            </div>
            <div style={{ flex: 1, background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 20 }}>✓</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: C.textoTenue }}>Origen verificado</p>
            </div>
          </div>
        </div>

        {/* Barra de compra fija */}
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", maxWidth: 420, width: "100%", background: C.fondoCard, borderTop: `1px solid ${C.borde}`, padding: 16, display: "flex", gap: 12, boxSizing: "border-box" }}>
          <button onClick={() => { setCarrito([...carrito, prod]); }} style={{ flex: 1, background: "transparent", border: `1px solid ${C.oroReal}`, color: C.oroReal, borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Agregar al carrito
          </button>
          <button onClick={() => { setCarrito([...carrito, prod]); setPantalla("carrito"); }} style={{ flex: 1, background: `linear-gradient(135deg, ${C.oroReal}, ${C.tierra})`, border: "none", color: C.fondo, borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Comprar ahora
          </button>
        </div>
      </div>
    );
  };

  // ===== COMPRADOR: CARRITO =====
  const Carrito = () => {
    const total = carrito.reduce((s, p) => s + p.precio, 0);
    const comision = Math.round(total * 0.1);
    return (
      <div style={{ paddingBottom: 100 }}>
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.borde}` }}>
          <button onClick={() => setPantalla("explorar")} style={{ background: C.fondoCard, border: `1px solid ${C.borde}`, color: C.crema, borderRadius: 10, width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>←</button>
          <span style={{ fontWeight: 700, color: C.crema, fontSize: 16 }}>Tu carrito</span>
        </div>

        <div style={{ padding: 18 }}>
          {carrito.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.textoTenue }}>
              <div style={{ fontSize: 50, marginBottom: 12 }}>🧺</div>
              <p>Tu carrito está vacío.</p>
              <button onClick={() => setPantalla("explorar")} style={{ background: C.oroReal, border: "none", color: C.fondo, borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Explorar productos</button>
            </div>
          ) : (
            <>
              {carrito.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 32 }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.crema }}>{p.nombre}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.textoTenue }}>{p.comercio}</p>
                  </div>
                  <span style={{ fontWeight: 800, color: C.oroReal, fontSize: 14 }}>{money(p.precio)}</span>
                </div>
              ))}

              <div style={{ background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
                <Row label="Subtotal productos" valor={money(total)} />
                <Row label="Servicio AfroMercado (10%)" valor={money(comision)} tenue />
                <div style={{ height: 1, background: C.borde, margin: "10px 0" }} />
                <Row label="Total" valor={money(total + comision)} grande />
                <p style={{ margin: "12px 0 0 0", fontSize: 11, color: C.verde, lineHeight: 1.5 }}>
                  💚 De este pedido, {money(total)} van directo a los comerciantes del Chocó.
                </p>
              </div>
            </>
          )}
        </div>

        {carrito.length > 0 && (
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", maxWidth: 420, width: "100%", background: C.fondoCard, borderTop: `1px solid ${C.borde}`, padding: 16, boxSizing: "border-box" }}>
            <button style={{ width: "100%", background: `linear-gradient(135deg, ${C.oroReal}, ${C.tierra})`, border: "none", color: C.fondo, borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              Pagar {money(total + comision)}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ===== COMERCIANTE: DASHBOARD =====
  const Dashboard = () => (
    <div style={{ paddingBottom: 80 }}>
      <TopBar titulo="Mi Negocio" />
      <div style={{ padding: 18 }}>
        <p style={{ margin: "0 0 4px 0", fontSize: 14, color: C.textoTenue }}>Buenos días,</p>
        <h2 style={{ margin: "0 0 18px 0", fontSize: 22, color: C.crema, fontWeight: 800 }}>Doña Edilma 🌿</h2>

        {/* Métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <Metrica valor={money(128000)} label="Ventas esta semana" emoji="💰" />
          <Metrica valor="3" label="Pedidos pendientes" emoji="📦" />
          <Metrica valor="48" label="Productos activos" emoji="🌾" />
          <Metrica valor="4.8 ⭐" label="Calificación" emoji="💚" />
        </div>

        {/* Saldo */}
        <div style={{ background: `linear-gradient(135deg, ${C.oroReal}, ${C.tierra})`, borderRadius: 16, padding: 18, marginBottom: 20, color: C.fondo }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>Saldo disponible para retiro</p>
          <p style={{ margin: "4px 0 12px 0", fontSize: 30, fontWeight: 800 }}>{money(115200)}</p>
          <button style={{ background: C.fondo, color: C.oroReal, border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Retirar a Nequi
          </button>
        </div>

        {/* Pedidos */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: C.crema, fontWeight: 700 }}>Pedidos recientes</h3>
          <span style={{ fontSize: 12, color: C.oroReal, fontWeight: 600 }}>Ver todos</span>
        </div>
        {PEDIDOS_COMERCIANTE.map(ped => (
          <div key={ped.id} style={{ background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.crema }}>{ped.producto}</span>
              <span style={{ fontWeight: 800, color: C.oroReal, fontSize: 13 }}>{money(ped.monto)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.textoTenue }}>{ped.id} · {ped.cliente}</span>
              <EstadoChip estado={ped.estado} />
            </div>
          </div>
        ))}

        <button style={{ width: "100%", background: "transparent", border: `1px dashed ${C.oroReal}`, color: C.oroReal, borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
          + Publicar nuevo producto
        </button>
      </div>
    </div>
  );

  // ===== NAV INFERIOR =====
  const NavInferior = () => {
    if (rol === "comprador") {
      return (
        <div style={navStyle}>
          <NavItem activo={pantalla === "explorar"} onClick={() => setPantalla("explorar")} emoji="🏠" label="Explorar" />
          <NavItem activo={pantalla === "carrito"} onClick={() => setPantalla("carrito")} emoji="🧺" label="Carrito" badge={carrito.length} />
          <NavItem activo={false} onClick={() => {}} emoji="📦" label="Pedidos" />
          <NavItem activo={false} onClick={() => {}} emoji="👤" label="Perfil" />
        </div>
      );
    }
    return (
      <div style={navStyle}>
        <NavItem activo={pantalla === "dashboard"} onClick={() => setPantalla("dashboard")} emoji="📊" label="Inicio" />
        <NavItem activo={false} onClick={() => {}} emoji="🌾" label="Productos" />
        <NavItem activo={false} onClick={() => {}} emoji="📦" label="Pedidos" />
        <NavItem activo={false} onClick={() => {}} emoji="🏪" label="Negocio" />
      </div>
    );
  };

  const navStyle = {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", maxWidth: 420, width: "100%",
    background: C.fondoCard, borderTop: `1px solid ${C.borde}`, display: "flex", padding: "8px 0", boxSizing: "border-box", zIndex: 20
  };

  // No mostrar nav en detalle/carrito de pago
  const mostrarNav = !(rol === "comprador" && pantalla === "detalle");

  return (
    <div style={wrap}>
      {rol === "comprador" && pantalla === "explorar" && <Explorar />}
      {rol === "comprador" && pantalla === "detalle" && <Detalle />}
      {rol === "comprador" && pantalla === "carrito" && <Carrito />}
      {rol === "comerciante" && pantalla === "dashboard" && <Dashboard />}
      {mostrarNav && <NavInferior />}
    </div>
  );
}

// ===== COMPONENTES AUXILIARES =====
function Chip({ activo, onClick, label, emoji }) {
  return (
    <button onClick={onClick} style={{
      whiteSpace: "nowrap", background: activo ? "#d4a23c" : "#16271b", color: activo ? "#0e1a12" : "#cdd9cd",
      border: activo ? "none" : "1px solid #264532", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer"
    }}>
      {emoji} {label}
    </button>
  );
}

function Metrica({ valor, label, emoji }) {
  return (
    <div style={{ background: "#16271b", border: "1px solid #264532", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{emoji}</div>
      <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#f2ede1" }}>{valor}</p>
      <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "#7a8c7a" }}>{label}</p>
    </div>
  );
}

function Row({ label, valor, tenue, grande }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: grande ? 16 : 13, color: tenue ? "#7a8c7a" : "#cdd9cd", fontWeight: grande ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: grande ? 18 : 13, color: grande ? "#d4a23c" : "#cdd9cd", fontWeight: grande ? 800 : 600 }}>{valor}</span>
    </div>
  );
}

function EstadoChip({ estado }) {
  const colores = {
    "Por despachar": { bg: "#5a3a0a", border: "#8a5a1a", text: "#e8c478" },
    "En ruta": { bg: "#0a3a4a", border: "#1a5a6a", text: "#78c8e8" },
    "Entregado": { bg: "#0a3a1a", border: "#1a5a2a", text: "#7fb069" },
  };
  const c = colores[estado] || colores["Entregado"];
  return <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: 10, padding: "3px 9px", borderRadius: 12, fontWeight: 700 }}>{estado}</span>;
}

function NavItem({ activo, onClick, emoji, label, badge }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
      <span style={{ fontSize: 20, opacity: activo ? 1 : 0.5 }}>{emoji}</span>
      <span style={{ fontSize: 10, color: activo ? "#d4a23c" : "#7a8c7a", fontWeight: activo ? 700 : 400 }}>{label}</span>
      {badge > 0 && <span style={{ position: "absolute", top: -4, right: "50%", marginRight: -18, background: "#b5651d", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 10, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>}
    </button>
  );
}
