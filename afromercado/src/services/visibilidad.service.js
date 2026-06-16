const VisibilidadRepository = require("../repositories/visibilidad.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

const TIPOS_VALIDOS = ["CATALOGO", "HOME_DESTACADO"];
const MAX_ACTIVAS_POR_TIPO = 4; // límite para evitar saturar

const VisibilidadService = {
  async crear({ comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta, adminId }) {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      throw new ErrorValidacion(`Tipo inválido. Usa: ${TIPOS_VALIDOS.join(", ")}`);
    }
    if (!comercioId) throw new ErrorValidacion("comercioId es requerido");
    if (!inicio || !fin) throw new ErrorValidacion("inicio y fin son requeridos");
    if (new Date(fin) <= new Date(inicio)) {
      throw new ErrorValidacion("fin debe ser posterior a inicio");
    }
    return VisibilidadRepository.crear({ comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta, adminId });
  },

  async listarActivas(tipo) {
    return VisibilidadRepository.listarActivas(tipo);
  },

  async listarTodas(opts) {
    return VisibilidadRepository.listarTodas(opts);
  },

  async desactivar(id) {
    const vis = await VisibilidadRepository.buscarPorId(id);
    if (!vis) throw new ErrorNoEncontrado("Visibilidad no encontrada");
    return VisibilidadRepository.desactivar(id);
  },
};

module.exports = VisibilidadService;
