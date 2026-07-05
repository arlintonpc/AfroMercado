const ConfigFiscalRepository = require("../repositories/config-fiscal.repository");
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

const ConfigFiscalService = {
  async obtenerPorComercio(comercioId) {
    const comercio = await ComercioRepository.buscarPorId(comercioId);
    if (!comercio) throw new ErrorNoEncontrado("Comercio no encontrado");
    const cfg = await ConfigFiscalRepository.buscarPorComercioId(comercioId);
    return cfg ?? { comercioId, ivaActivo: false, ivaPorcentaje: 19.0, regimenTributario: null };
  },

  async activar(adminId, comercioId, { ivaPorcentaje, regimenTributario } = {}) {
    const comercio = await ComercioRepository.buscarPorId(comercioId);
    if (!comercio) throw new ErrorNoEncontrado("Comercio no encontrado");
    if (ivaPorcentaje != null) {
      const n = Number(ivaPorcentaje);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new ErrorValidacion("ivaPorcentaje debe ser un número entre 0 y 100");
      }
    }
    return ConfigFiscalRepository.activar(comercioId, {
      ivaPorcentaje: ivaPorcentaje != null ? Number(ivaPorcentaje) : undefined,
      regimenTributario,
      adminId,
    });
  },

  async desactivar(adminId, comercioId) {
    const comercio = await ComercioRepository.buscarPorId(comercioId);
    if (!comercio) throw new ErrorNoEncontrado("Comercio no encontrado");
    return ConfigFiscalRepository.desactivar(comercioId);
  },
};

module.exports = ConfigFiscalService;
