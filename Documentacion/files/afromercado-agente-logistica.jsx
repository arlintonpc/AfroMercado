import { useState } from "react";

export default function AgenteLogistica() {
  const [vista, setVista] = useState("menu");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [consultaActiva, setConsultaActiva] = useState(null);

  const consultas = [
    { id: "corredores", emoji: "🗺️", nombre: "Corredores Logísticos", desc: "Rutas principales del Chocó" },
    { id: "municipios", emoji: "🏘️", nombre: "Municipios Clave", desc: "Prioridad de cobertura por volumen" },
    { id: "tiempos", emoji: "⏱️", nombre: "Tiempos de Entrega", desc: "Estimados por ruta y tipo de producto" },
    { id: "fases", emoji: "🚀", nombre: "Plan por Fases", desc: "Cómo implementar la logística paso a paso" },
    { id: "problemas", emoji: "⚠️", nombre: "Retos del Chocó", desc: "Obstáculos logísticos y cómo resolverlos" },
  ];

  const prompts = {
    corredores: `Eres experto en logística del departamento del Chocó, Colombia. Conoces sus carreteras, ríos, municipios y condiciones de transporte.

Define los corredores logísticos principales para AfroMercado, un marketplace cultural afro del Chocó.

Responde SOLO con JSON compacto sin texto extra ni markdown:
{"titulo":"Corredores Logísticos del Chocó","corredores":[{"id":1,"nombre":"nombre corredor","origen":"municipio","destinos":["mun1","mun2"],"medio":"Carretera|Río|Mixto","frecuencia":"Diaria|3 veces semana|Semanal","tiempo":"X horas","prioridad":"Alta|Media|Baja","productos":["tipo1","tipo2"]}],"insight":"recomendacion clave en max 20 palabras"}`,

    municipios: `Eres experto en geografía y comercio del Chocó, Colombia.

Lista los municipios más importantes para AfroMercado por volumen comercial potencial.

Responde SOLO con JSON compacto sin texto extra ni markdown:
{"titulo":"Municipios Clave para AfroMercado","municipios":[{"id":1,"nombre":"municipio","region":"Norte|Centro|Sur|Pacifico","potencial":"Alto|Medio|Bajo","productos":["prod1","prod2"],"conexion":"Carretera|Río|Aéreo","fase":"Fase 1|Fase 2|Fase 3"}],"capital":"dato clave sobre Quibdó como hub logístico en max 15 palabras"}`,

    tiempos: `Eres experto en logística del Chocó, Colombia. Conoces las condiciones reales de transporte.

Define tiempos de entrega estimados para AfroMercado por tipo de producto y ruta.

Responde SOLO con JSON compacto sin texto extra ni markdown:
{"titulo":"Tiempos de Entrega AfroMercado","categorias":[{"tipo":"tipo producto","emoji":"emoji","tiempo_local":"X horas","tiempo_regional":"X horas","tiempo_nacional":"X dias","condicion":"nota importante max 8 palabras"}],"regla_oro":"regla principal de tiempos en max 15 palabras"}`,

    fases: `Eres experto en logística y operaciones de marketplaces en Latinoamérica.

Diseña el plan de implementación logística por fases para AfroMercado en el Chocó.

Responde SOLO con JSON compacto sin texto extra ni markdown:
{"titulo":"Plan Logístico por Fases","fases":[{"fase":"Fase 1","nombre":"nombre descriptivo","duracion":"X meses","acciones":["accion1","accion2","accion3"],"tecnologia":"herramienta principal","meta":"meta medible en max 10 palabras"}],"consejo":"consejo crítico en max 15 palabras"}`,

    problemas: `Eres experto en logística del Chocó, Colombia. Conoces sus retos reales: vías, clima, geografía.

Identifica los principales retos logísticos para AfroMercado y cómo resolverlos.

Responde SOLO con JSON compacto sin texto extra ni markdown:
{"titulo":"Retos Logísticos del Chocó","retos":[{"id":1,"problema":"nombre del problema","emoji":"emoji","descripcion":"descripcion max 10 palabras","impacto":"Alto|Medio|Bajo","solucion":"solucion concreta max 12 palabras","referencia":"empresa que lo resolvió similar"}],"aprendizaje":"lección más importante en max 15 palabras"}`
  };

  const consultar = async (consulta) => {
    setCargando(true);
    setErrorMsg(null);
    setResultado(null);
    setConsultaActiva(consulta);
    setVista("resultado");

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
          max_tokens: 1200,
          system: prompts[consulta.id],
          messages: [{ role: "user", content: `Analiza para AfroMercado: ${consulta.nombre}` }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

      const raw = (data.content || []).map(b => b.text || "").join("").trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Respuesta inválida del agente");

      const parsed = JSON.parse(raw.slice(start, end + 1));
      setResultado(parsed);
    } catch (e) {
      setErrorMsg(e.message || "Error desconocido.");
    } finally {
      setCargando(false);
    }
  };

  const prioridadColor = (p) => {
    if (p === "Alta" || p === "Alto") return "#8db85d";
    if (p === "Media" || p === "Medio") return "#c8c86e";
    return "#c8a96e";
  };

  const faseColor = (f) => {
    if (!f) return "#4a9a4a";
    if (f.includes("1")) return "#4a9a4a";
    if (f.includes("2")) return "#9a9a4a";
    return "#9a6a4a";
  };

  const card = { background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "14px", padding: "16px", marginBottom: "12px" };
  const label = { color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px 0", fontWeight: "700" };
  const tag = (color, bg, border, text) => ({ background: bg, border: `1px solid ${border}`, borderRadius: "6px", padding: "2px 8px", fontSize: "11px", color: color, fontWeight: "700" });

  const renderResultado = () => {
    if (!resultado) return null;
    const id = consultaActiva?.id;

    if (id === "corredores") {
      return (
        <>
          {(resultado.corredores || []).map(c => (
            <div key={c.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>🛣️ {c.nombre}</h4>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={tag(prioridadColor(c.prioridad), "#0f1a0f", "#2d4a2d", "")}>{c.prioridad}</span>
                  <span style={tag("#8db88d", "#0f1a0f", "#2d4a2d", "")}>{c.medio}</span>
                </div>
              </div>
              <p style={{ color: "#8db88d", fontSize: "12px", margin: "0 0 8px 0" }}>
                <strong style={{ color: "#c8a96e" }}>Origen:</strong> {c.origen} →{" "}
                <strong style={{ color: "#c8a96e" }}>Destinos:</strong> {(c.destinos || []).join(", ")}
              </p>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
                <span style={{ color: "#b0c9b0", fontSize: "12px" }}>⏱️ {c.tiempo}</span>
                <span style={{ color: "#b0c9b0", fontSize: "12px" }}>🔄 {c.frecuencia}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(c.productos || []).map((p, i) => (
                  <span key={i} style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#b0c9b0" }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
            <p style={label}>💡 Insight Clave</p>
            <p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.insight}</p>
          </div>
        </>
      );
    }

    if (id === "municipios") {
      return (
        <>
          {(resultado.municipios || []).map(m => (
            <div key={m.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>🏘️ {m.nombre}</h4>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{ ...tag("", "#0f1a0f", "#2d4a2d", ""), color: prioridadColor(m.potencial) }}>{m.potencial}</span>
                  <span style={{ ...tag("", "#0f1a0f", "#2d4a2d", ""), color: faseColor(m.fase) }}>{m.fase}</span>
                </div>
              </div>
              <p style={{ color: "#8db88d", fontSize: "12px", margin: "0 0 8px 0" }}>
                📍 {m.region} · 🚗 {m.conexion}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(m.productos || []).map((p, i) => (
                  <span key={i} style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#b0c9b0" }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
            <p style={label}>🏙️ Quibdó como Hub</p>
            <p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.capital}</p>
          </div>
        </>
      );
    }

    if (id === "tiempos") {
      return (
        <>
          {(resultado.categorias || []).map((c, i) => (
            <div key={i} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ fontSize: "24px" }}>{c.emoji}</span>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>{c.tipo}</h4>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <div style={{ background: "#0f1a0f", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                  <p style={{ color: "#6a9a6a", fontSize: "10px", margin: "0 0 4px 0", textTransform: "uppercase" }}>Local</p>
                  <p style={{ color: "#8db85d", fontSize: "13px", fontWeight: "700", margin: 0 }}>{c.tiempo_local}</p>
                </div>
                <div style={{ background: "#0f1a0f", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                  <p style={{ color: "#6a9a6a", fontSize: "10px", margin: "0 0 4px 0", textTransform: "uppercase" }}>Regional</p>
                  <p style={{ color: "#c8c86e", fontSize: "13px", fontWeight: "700", margin: 0 }}>{c.tiempo_regional}</p>
                </div>
                <div style={{ background: "#0f1a0f", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                  <p style={{ color: "#6a9a6a", fontSize: "10px", margin: "0 0 4px 0", textTransform: "uppercase" }}>Nacional</p>
                  <p style={{ color: "#c8a96e", fontSize: "13px", fontWeight: "700", margin: 0 }}>{c.tiempo_nacional}</p>
                </div>
              </div>
              <p style={{ color: "#8db88d", fontSize: "12px", margin: 0 }}>⚠️ {c.condicion}</p>
            </div>
          ))}
          <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
            <p style={label}>📏 Regla de Oro</p>
            <p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.regla_oro}</p>
          </div>
        </>
      );
    }

    if (id === "fases") {
      return (
        <>
          {(resultado.fases || []).map((f, i) => (
            <div key={i} style={{ ...card, borderColor: faseColor(f.fase) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>{f.fase}: {f.nombre}</h4>
                <span style={{ background: "#0f1a0f", border: `1px solid ${faseColor(f.fase)}`, borderRadius: "6px", padding: "2px 8px", fontSize: "11px", color: faseColor(f.fase) }}>
                  {f.duracion}
                </span>
              </div>
              <div style={{ marginBottom: "10px" }}>
                {(f.acciones || []).map((a, j) => (
                  <p key={j} style={{ color: "#b0c9b0", fontSize: "13px", margin: "0 0 4px 0" }}>✓ {a}</p>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", color: "#8db88d" }}>
                  🛠️ {f.tecnologia}
                </span>
                <span style={{ color: "#c8a96e", fontSize: "12px" }}>🎯 {f.meta}</span>
              </div>
            </div>
          ))}
          <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
            <p style={label}>💡 Consejo Crítico</p>
            <p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.consejo}</p>
          </div>
        </>
      );
    }

    if (id === "problemas") {
      return (
        <>
          {(resultado.retos || []).map(r => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>{r.emoji}</span>
                  <h4 style={{ color: "#f0ede6", margin: 0, fontSize: "14px", fontWeight: "700" }}>{r.problema}</h4>
                </div>
                <span style={{ ...tag("", "#0f1a0f", "#2d4a2d", ""), color: prioridadColor(r.impacto) }}>{r.impacto}</span>
              </div>
              <p style={{ color: "#8db88d", fontSize: "12px", margin: "0 0 8px 0" }}>{r.descripcion}</p>
              <div style={{ background: "#0f2a0f", border: "1px solid #1d4a1d", borderRadius: "8px", padding: "8px", marginBottom: "6px" }}>
                <p style={{ color: "#8db85d", fontSize: "12px", margin: 0 }}>✅ {r.solucion}</p>
              </div>
              <p style={{ color: "#5a7a5a", fontSize: "11px", margin: 0 }}>📌 Ref: {r.referencia}</p>
            </div>
          ))}
          <div style={{ ...card, background: "#2a1a0a", borderColor: "#5a3a1a" }}>
            <p style={label}>🎓 Aprendizaje Clave</p>
            <p style={{ color: "#c9b090", fontSize: "13px", margin: 0 }}>{resultado.aprendizaje}</p>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f1a0f", minHeight: "100vh", padding: "20px", color: "#f0ede6" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "38px", marginBottom: "4px" }}>🚚</div>
        <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#c8a96e", margin: "0 0 4px 0" }}>AfroMercado</h1>
        <p style={{ color: "#8db88d", fontSize: "12px", margin: 0 }}>Agente Experto · Logística del Chocó</p>
      </div>

      {/* Menú */}
      <div style={{ maxWidth: "560px", margin: "0 auto 20px auto" }}>
        <p style={{ color: "#c8a96e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", marginBottom: "12px", fontWeight: "700" }}>
          ¿Qué quieres analizar?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {consultas.map(c => (
            <button
              key={c.id}
              onClick={() => consultar(c)}
              disabled={cargando}
              style={{
                background: consultaActiva?.id === c.id && !cargando ? "linear-gradient(135deg, #c8a96e, #a07840)" : "#1a2e1a",
                border: consultaActiva?.id === c.id && !cargando ? "none" : "1px solid #2d4a2d",
                borderRadius: "12px",
                padding: "12px 16px",
                color: consultaActiva?.id === c.id && !cargando ? "#0f1a0f" : "#b0c9b0",
                fontSize: "14px",
                fontWeight: "700",
                cursor: cargando ? "not-allowed" : "pointer",
                opacity: cargando && consultaActiva?.id !== c.id ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textAlign: "left"
              }}
            >
              <span style={{ fontSize: "20px" }}>{c.emoji}</span>
              <div>
                <div>{c.nombre}</div>
                <div style={{ fontSize: "12px", fontWeight: "400", opacity: 0.8 }}>{c.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cargando */}
      {cargando && (
        <div style={{ textAlign: "center", padding: "36px" }}>
          <div style={{ fontSize: "34px", marginBottom: "10px" }}>🔍</div>
          <p style={{ color: "#8db88d", fontSize: "14px", margin: "0 0 4px 0" }}>
            Analizando {consultaActiva?.emoji} {consultaActiva?.nombre}...
          </p>
          <p style={{ color: "#5a7a5a", fontSize: "12px" }}>Consultando datos del Chocó</p>
        </div>
      )}

      {/* Error */}
      {errorMsg && !cargando && (
        <div style={{ background: "#2e1a1a", border: "1px solid #5a2a2a", borderRadius: "12px", padding: "14px", textAlign: "center", maxWidth: "440px", margin: "0 auto" }}>
          <p style={{ color: "#e88", margin: "0 0 10px 0", fontSize: "13px" }}>⚠️ {errorMsg}</p>
          <button onClick={() => consultar(consultaActiva)} style={{ background: "#c8a96e", color: "#0f1a0f", border: "none", borderRadius: "8px", padding: "8px 20px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Resultados */}
      {resultado && !cargando && (
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: "14px", padding: "14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>{consultaActiva?.emoji}</span>
            <h3 style={{ color: "#c8a96e", margin: 0, fontSize: "15px", fontWeight: "700" }}>{resultado.titulo}</h3>
          </div>
          {renderResultado()}
        </div>
      )}
    </div>
  );
}
