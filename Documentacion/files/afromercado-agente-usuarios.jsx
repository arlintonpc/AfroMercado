import { useState } from "react";

export default function AgenteUsuarios() {
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const consultarAgente = async () => {
    setCargando(true);
    setErrorMsg(null);
    setResultado(null);

    const systemPrompt = `Eres experto en marketplaces (Mercado Libre, Rappi, Etsy, Airbnb).
AfroMercado es un marketplace cultural afro e indígena del Chocó, Colombia. Tiene 5 pilares: productos del campo, artesanías, restaurantes, turismo y contenido. Modelo: comisión 10%, split de pagos, logística local.

Responde SOLO con este JSON exacto (sin texto extra, sin markdown):
{"analisis":"texto breve","usuarios":[{"id":1,"emoji":"🛒","nombre":"Comprador","descripcion":"texto","capacidades":["cap1","cap2"],"justificacion":"texto","referencia":"Mercado Libre"},{"id":2,"emoji":"🏪","nombre":"Comerciante","descripcion":"texto","capacidades":["cap1","cap2"],"justificacion":"texto","referencia":"Etsy"},{"id":3,"emoji":"🌿","nombre":"Comunidad Indigena","descripcion":"texto","capacidades":["cap1","cap2"],"justificacion":"texto","referencia":"Etsy"},{"id":4,"emoji":"🚚","nombre":"Repartidor","descripcion":"texto","capacidades":["cap1","cap2"],"justificacion":"texto","referencia":"Rappi"},{"id":5,"emoji":"⚙️","nombre":"Administrador","descripcion":"texto","capacidades":["cap1","cap2"],"justificacion":"texto","referencia":"Mercado Libre"}],"fase1":"texto corto","insight":"texto corto"}`;

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
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: "Dame el JSON con los tipos de usuarios para AfroMercado." }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

      const raw = (data.content || []).map(b => b.text || "").join("").trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("El agente no devolvió JSON válido");

      const parsed = JSON.parse(raw.slice(start, end + 1));
      setResultado(parsed);
    } catch (e) {
      setErrorMsg(e.message || "Error desconocido.");
    } finally {
      setCargando(false);
    }
  };

  const card = { background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "14px", padding: "18px", marginBottom: "14px" };
  const label = { color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px 0", fontWeight: "700" };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f1a0f", minHeight: "100vh", padding: "20px", color: "#f0ede6" }}>

      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "40px", marginBottom: "4px" }}>🌿</div>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#c8a96e", margin: "0 0 4px 0" }}>AfroMercado</h1>
        <p style={{ color: "#8db88d", fontSize: "13px", margin: 0 }}>Agente Experto · Tipos de Usuarios</p>
      </div>

      {!resultado && !cargando && (
        <div style={{ maxWidth: "460px", margin: "0 auto" }}>
          <div style={card}>
            <p style={{ color: "#b0c9b0", fontSize: "14px", lineHeight: "1.6", margin: "0 0 16px 0", textAlign: "center" }}>
              El agente analiza AfroMercado comparándolo con{" "}
              <strong style={{ color: "#c8a96e" }}>Mercado Libre, Rappi, Etsy y Airbnb</strong>.
            </p>
            <button onClick={consultarAgente} style={{ width: "100%", background: "linear-gradient(135deg, #c8a96e, #a07840)", color: "#0f1a0f", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
              🤖 Consultar al Agente Experto
            </button>
          </div>
          {errorMsg && (
            <div style={{ background: "#2e1a1a", border: "1px solid #5a2a2a", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
              <p style={{ color: "#e88", margin: "0 0 12px 0", fontSize: "13px" }}>⚠️ {errorMsg}</p>
              <button onClick={consultarAgente} style={{ background: "#c8a96e", color: "#0f1a0f", border: "none", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", fontWeight: "700" }}>
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {cargando && (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
          <p style={{ color: "#8db88d", fontSize: "15px", margin: "0 0 4px 0" }}>Analizando AfroMercado...</p>
          <p style={{ color: "#5a7a5a", fontSize: "12px" }}>Consultando Mercado Libre, Rappi, Etsy y Airbnb</p>
        </div>
      )}

      {resultado && (
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>

          <div style={card}>
            <p style={label}>📊 Análisis General</p>
            <p style={{ color: "#b0c9b0", lineHeight: "1.7", margin: 0, fontSize: "14px" }}>{resultado.analisis}</p>
          </div>

          <p style={{ ...label, marginBottom: "12px" }}>👥 Usuarios Recomendados</p>

          {(resultado.usuarios || []).map(u => (
            <div key={u.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "28px" }}>{u.emoji}</span>
                <div>
                  <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "15px", fontWeight: "700" }}>{u.nombre}</h4>
                  <p style={{ color: "#8db88d", margin: 0, fontSize: "12px" }}>{u.descripcion}</p>
                </div>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(u.capacidades || []).map((c, i) => (
                    <span key={i} style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "20px", padding: "3px 10px", fontSize: "11px", color: "#b0c9b0" }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid #2d4a2d", paddingTop: "10px", display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <p style={{ color: "#a0b9a0", fontSize: "12px", margin: 0, flex: 1 }}>
                  <strong style={{ color: "#c8a96e" }}>¿Por qué? </strong>{u.justificacion}
                </p>
                <span style={{ background: "#0f2a0f", border: "1px solid #1d3a1d", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "#6a9a6a", whiteSpace: "nowrap" }}>
                  📌 {u.referencia}
                </span>
              </div>
            </div>
          ))}

          <div style={{ ...card, background: "#1a2a0a", borderColor: "#3a5a1a" }}>
            <p style={{ ...label, color: "#8db85d" }}>🚀 Fase 1 — Implementar primero</p>
            <p style={{ color: "#b0c9a0", lineHeight: "1.6", margin: 0, fontSize: "14px" }}>{resultado.fase1}</p>
          </div>

          <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
            <p style={label}>💡 Insight para AfroMercado</p>
            <p style={{ color: "#c9b090", lineHeight: "1.6", margin: 0, fontSize: "14px" }}>{resultado.insight}</p>
          </div>

          <div style={{ textAlign: "center", marginTop: "4px", marginBottom: "24px" }}>
            <button onClick={() => { setResultado(null); setErrorMsg(null); }} style={{ background: "transparent", border: "1px solid #2d4a2d", color: "#8db88d", borderRadius: "10px", padding: "10px 24px", cursor: "pointer", fontSize: "13px" }}>
              🔄 Consultar de nuevo
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
