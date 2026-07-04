// Metadatos estáticos de los datasets públicos de Datos Abiertos.
// La lista de datasets es fija (no depende de la DB); la fecha de corte sí
// se calcula en runtime a partir del último mes calendario cerrado.
const { rangoMesCerrado } = require("../repositories/datosabiertos.repository");

function listarDatasets() {
  const { inicio } = rangoMesCerrado();
  // El corte publicado es el mes completo que ya cerró (ej. si "inicio" es
  // 1-jun, el snapshot corresponde a junio).
  const ultimaActualizacion = inicio.toISOString().slice(0, 10);

  return [
    {
      id: "comercios-por-departamento",
      nombre: "Comercios, pedidos y GMV por departamento",
      descripcion:
        "Número de comercios activos y verificados, pedidos confirmados y volumen de ventas (GMV) agregados por departamento.",
      frecuencia: "mensual",
      cobertura: "Nacional (departamentos y municipios de Colombia)",
      licencia: "CC BY 4.0",
      ultimaActualizacion,
    },
    {
      id: "comercios-por-municipio",
      nombre: "Comercios, pedidos y GMV por municipio",
      descripcion:
        "Número de comercios activos y verificados, pedidos confirmados y volumen de ventas (GMV) agregados por departamento y municipio. Los municipios con menos de 5 comercios se consolidan a nivel departamental para proteger la identidad de comercios individuales.",
      frecuencia: "mensual",
      cobertura: "Nacional (departamentos y municipios de Colombia)",
      licencia: "CC BY 4.0",
      ultimaActualizacion,
    },
  ];
}

module.exports = { listarDatasets };
