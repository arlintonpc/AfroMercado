// Anonimización de datos abiertos — regla k-anonimato (k=5)
// Ninguna fila publicada puede representar menos de 5 comercios distintos,
// porque con pocos comercios alguien podría deducir cifras de un comercio
// puntual (ej. si solo hay 1 comercio en un municipio, "ventas del municipio"
// == "ventas de ese comercio"). Las filas que no llegan al umbral se fusionan
// (roll-up) dentro de la fila de su nivel superior (departamento), sumando
// sus valores numéricos, en vez de descartarse o publicarse sueltas.

const UMBRAL_MINIMO_COMERCIOS = 5;

/**
 * Aplica el umbral k=5 a un array de filas agregadas.
 *
 * @param {Array<Object>} filas - filas con al menos { comercios, ...camposNumericos }
 * @param {Object} opciones
 * @param {string} opciones.nivelSuperior - nombre del campo que identifica el nivel
 *   superior al que se debe re-agrupar (ej. "departamento").
 * @param {string[]} [opciones.camposSuma] - campos numéricos a sumar al fusionar
 *   filas (por defecto: comercios, pedidos, gmv).
 * @returns {Array<Object>} filas resultantes, todas con comercios >= 5 (o el
 *   total real si ni siquiera el nivel superior completo alcanza el umbral).
 */
function aplicarUmbralK5(filas, { nivelSuperior, camposSuma = ["comercios", "pedidos", "gmv"] } = {}) {
  if (!nivelSuperior) throw new Error("aplicarUmbralK5 requiere 'nivelSuperior'");
  if (!Array.isArray(filas) || filas.length === 0) return [];

  const cumplen = [];
  const porFusionar = new Map(); // nivelSuperior -> fila acumulada

  for (const fila of filas) {
    const comercios = Number(fila.comercios ?? 0);
    if (comercios >= UMBRAL_MINIMO_COMERCIOS) {
      cumplen.push({ ...fila });
      continue;
    }

    const clave = fila[nivelSuperior] ?? "Sin dato";
    const acumulada = porFusionar.get(clave);
    if (!acumulada) {
      const base = { [nivelSuperior]: clave };
      for (const campo of camposSuma) base[campo] = Number(fila[campo] ?? 0);
      porFusionar.set(clave, base);
    } else {
      for (const campo of camposSuma) acumulada[campo] += Number(fila[campo] ?? 0);
    }
  }

  return [...cumplen, ...porFusionar.values()];
}

module.exports = { aplicarUmbralK5, UMBRAL_MINIMO_COMERCIOS };
