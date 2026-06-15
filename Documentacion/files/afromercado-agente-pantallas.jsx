import { useState } from "react";

export default function AgentePantallas() {
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [usuarioActivo, setUsuarioActivo] = useState(null);

  const usuarios = [
    { id: "comprador", emoji: "🛒", nombre: "Comprador" },
    { id: "comerciante", emoji: "🏪", nombre: "Comerciante" },
    { id: "indigena", emoji: "🌿", nombre: "Comunidad Indígena" },
    { id: "repartidor", emoji: "🚚", nombre: "Repartidor" },
    { id: "admin", emoji: "⚙️", nombre: "Administrador" },
  ];

  const consultarAgente = async (usuario) => {
    setCargando(true);
    setErrorMsg(null);
    setResultado(null);
    setUsuarioActivo(usuario);

    const systemPrompt = `Eres experto en UX de marketplaces. AfroMercado es un marketplace cultural afro del Chocó, Colombia con 5 pilares: campo, artesanías, restaurantes, turismo, contenido.

Para el rol dado, lista exactamente 5 pantallas clave.

Responde SOLO con este JSON (sin texto extra, sin markdown, muy compacto):
{"rol":"nombre","pantallas":[{"n":"nombre","e":"emoji","d":"descripcion corta max 10 palabras","p":"Alta","f":"Fase 1"},{"n":"nombre","e":"emoji","d":"descripcion corta max 10 palabras","p":"Alta","f":"Fase 1"},{"n":"nombre","e":"emoji","d":"descripcion corta max 10 palabras","p":"Media","f":"Fase 2"},{"n":"nombre","e":"emoji","d":"descripcion corta max 10 palabras","p":"Media","f":"Fase 2"},{"n":"nombre","e":"emoji","d":"descripcion corta max 10 palabras","p":"Baja","f":"Fase 3"}],"flujo":"una frase del flujo principal","clave":"pantalla mas importante y por que en max 15 palabras"}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "proxy",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: "user", content: `Pantallas para: ${usuario.nombre}` }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

      const raw = (data.content || []).map(b => b.text || "").join("").trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Respuesta inválida");

      const parsed = JSON.parse(raw.slice(start, end + 1));
      setResultado(parsed);
    } catch (e) {
      setErrorMsg(e.message || "Error desconocido.");
    } finally {
      setCargando(false);
    }
  };

  const prioridadColor = (p) => {
    if (p === "Alta") return { bg: "#1a2a0a", border: "#3a5a1a", text: "#8db85d" };
    if (p === "Media") return { bg: "#2a2a0a", border: "#5a5a1a", text: "#c8c86e" };
    return { bg: "#2a1a0a", border: "#5a3a1a", text: "#c8a96e" };
  };

  const faseColor = (f) => {
    if (f === "Fase 1") return "#4a9a4a";
    if (f === "Fase 2") return "#9a9a4a";
    return "#9a6a4a";
  };

  const card = { background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "14px", padding: "16px", marginBottom: "12px" };
  const label = { color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px 0", fontWeight: "700" };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f1a0f", minHeight: "100vh", padding: "20px", color: "#f0ede6" }}>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "38px", marginBottom: "4px" }}>🌿</div>
        <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#c8a96e", margin: "0 0 4px 0" }}>AfroMercado</h1>
        <p style={{ color: "#8db88d", fontSize: "12px", margin: 0 }}>Agente Experto · Pantallas por Usuario</p>
      </div>

      {/* Selector */}
      <div style={{ maxWidth: "560px", margin: "0 auto 20px auto" }}>
        <p style={{ ...label, textAlign: "center", marginBottom: "10px" }}>Selecciona un tipo de usuario</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
          {usuarios.map(u => (
            <button
              key={u.id}
              onClick={() => consultarAgente(u)}
              disabled={cargando}
              style={{
                background: usuarioActivo?.id === u.id && !cargando ? "linear-gradient(135deg, #c8a96e, #a07840)" : "#1a2e1a",
                border: usuarioActivo?.id === u.id && !cargando ? "none" : "1px solid #2d4a2d",
                borderRadius: "10px",
                padding: "9px 14px",
                color: usuarioActivo?.id === u.id && !cargando ? "#0f1a0f" : "#b0c9b0",
                fontSize: "13px",
                fontWeight: "700",
                cursor: cargando ? "not-allowed" : "pointer",
                opacity: cargando && usuarioActivo?.id !== u.id ? 0.4 : 1,
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <span>{u.emoji}</span><span>{u.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cargando */}
      {cargando && (
        <div style={{ textAlign: "center", padding: "36px" }}>
          <div style={{ fontSize: "34px", marginBottom: "10px" }}>🔍</div>
          <p style={{ color: "#8db88d", fontSize: "14px", margin: "0 0 4px 0" }}>
            Analizando {usuarioActivo?.emoji} {usuarioActivo?.nombre}...
          </p>
          <p style={{ color: "#5a7a5a", fontSize: "12px" }}>Consultando mejores prácticas UX</p>
        </div>
      )}

      {/* Error */}
      {errorMsg && !cargando && (
        <div style={{ background: "#2e1a1a", border: "1px solid #5a2a2a", borderRadius: "12px", padding: "14px", textAlign: "center", maxWidth: "440px", margin: "0 auto" }}>
          <p style={{ color: "#e88", margin: "0 0 10px 0", fontSize: "13px" }}>⚠️ {errorMsg}</p>
          <button onClick={() => consultarAgente(usuarioActivo)} style={{ background: "#c8a96e", color: "#0f1a0f", border: "none", borderRadius: "8px", padding: "8px 20px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Resultados */}
      {resultado && !cargando && (
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {/* Flujo y pantalla clave */}
          <div style={{ display: "grid", gap: "12px", marginBottom: "16px", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ ...card, margin: 0 }}>
              <p style={label}>🔄 Flujo Principal</p>
              <p style={{ color: "#a0c9a0", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>{resultado.flujo}</p>
            </div>
            <div style={{ ...card, margin: 0, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
              <p style={label}>⭐ Pantalla Clave</p>
              <p style={{ color: "#c9b090", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>{resultado.clave}</p>
            </div>
          </div>

          {/* Pantallas */}
          <p style={{ ...label, marginBottom: "10px" }}>🖥️ Pantallas Recomendadas</p>

          {(resultado.pantallas || []).map((p, i) => {
            const pc = prioridadColor(p.p);
            return (
              <div key={i} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "22px" }}>{p.e}</span>
                    <div>
                      <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>{p.n}</h4>
                      <p style={{ color: "#8db88d", margin: 0, fontSize: "12px" }}>{p.d}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: "6px", padding: "2px 8px", fontSize: "11px", color: pc.text, fontWeight: "700" }}>
                      {p.p}
                    </span>
                    <span style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", color: faseColor(p.f) }}>
                      {p.f}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <p style={{ color: "#5a7a5a", fontSize: "12px", textAlign: "center", marginTop: "8px", marginBottom: "24px" }}>
            Selecciona otro usuario arriba para ver sus pantallas
          </p>
        </div>
      )}
    </div>
  );
}
