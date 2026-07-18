// ============================================================
//  Validación de departamento/municipio contra el catálogo DANE.
//  Usado por los servicios que alimentan la analítica territorial
//  (Comercio, Direccion) — ver src/data/colombia-dane.js.
// ============================================================
const { DEPARTAMENTOS, MUNICIPIOS_POR_DEPARTAMENTO } = require("../data/colombia-dane");
const { ErrorValidacion } = require("./errores");

const MENSAJE = "Selecciona un departamento y municipio válidos de la lista.";

/** Lanza ErrorValidacion si el par departamento/municipio no existe en el catálogo DANE. */
function validarUbicacion(departamento, municipio) {
  if (!DEPARTAMENTOS.includes(departamento)) {
    throw new ErrorValidacion(MENSAJE);
  }
  if (!MUNICIPIOS_POR_DEPARTAMENTO[departamento].includes(municipio)) {
    throw new ErrorValidacion(MENSAJE);
  }
}

module.exports = { validarUbicacion };
