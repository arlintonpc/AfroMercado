// Controlador de Datos Abiertos — endpoints PÚBLICOS (sin autenticación).
// Solo exponen agregados ya anonimizados (ver datosabiertos.repository.js).
const DatosAbiertosRepository = require("../repositories/datosabiertos.repository");
const { listarDatasets } = require("../config/datasets-abiertos");

/** Envuelve en comillas dobles un valor si contiene coma, comilla o salto de línea. */
function celdaCsv(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Convierte un array de objetos planos a texto CSV (encabezados + filas). */
function aCsv(filas) {
  if (!filas.length) return "";
  const columnas = Object.keys(filas[0]);
  const encabezado = columnas.map(celdaCsv).join(",");
  const cuerpo = filas.map((fila) => columnas.map((col) => celdaCsv(fila[col])).join(","));
  return [encabezado, ...cuerpo].join("\n");
}

function responderSegunFormato(req, res, filas, nombreArchivoCsv) {
  const formato = (req.query.formato || "json").toLowerCase();
  if (formato === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivoCsv}"`);
    return res.send(aCsv(filas));
  }
  return res.json({ ok: true, data: filas });
}

const DatosAbiertosController = {
  // GET /datos-abiertos
  async listarDatasets(req, res, next) {
    try {
      res.json({ ok: true, data: listarDatasets() });
    } catch (e) { next(e); }
  },

  // GET /datos-abiertos/municipios?formato=json|csv
  async municipios(req, res, next) {
    try {
      const data = await DatosAbiertosRepository.datosPorMunicipio();
      responderSegunFormato(req, res, data, "afromercado_comercios_municipios.csv");
    } catch (e) { next(e); }
  },

  // GET /datos-abiertos/departamentos?formato=json|csv
  async departamentos(req, res, next) {
    try {
      const data = await DatosAbiertosRepository.datosPorDepartamento();
      responderSegunFormato(req, res, data, "afromercado_comercios_departamentos.csv");
    } catch (e) { next(e); }
  },
};

module.exports = DatosAbiertosController;
