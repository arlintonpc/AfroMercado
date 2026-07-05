const prisma = require("../config/prisma");

const ConfigFiscalRepository = {
  async buscarPorComercioId(comercioId) {
    return prisma.configFiscalComercio.findUnique({ where: { comercioId } });
  },

  async activar(comercioId, { ivaPorcentaje, regimenTributario, adminId }) {
    return prisma.configFiscalComercio.upsert({
      where: { comercioId },
      update: {
        ivaActivo: true,
        ...(ivaPorcentaje != null ? { ivaPorcentaje } : {}),
        ...(regimenTributario !== undefined ? { regimenTributario } : {}),
        activadoPor: adminId,
        activadoAt: new Date(),
      },
      create: {
        comercioId,
        ivaActivo: true,
        ivaPorcentaje: ivaPorcentaje ?? 19.0,
        regimenTributario: regimenTributario ?? null,
        activadoPor: adminId,
        activadoAt: new Date(),
      },
    });
  },

  async desactivar(comercioId) {
    return prisma.configFiscalComercio.upsert({
      where: { comercioId },
      update: { ivaActivo: false },
      create: { comercioId, ivaActivo: false },
    });
  },

  async buscarPorComercioIds(comercioIds) {
    const rows = await prisma.configFiscalComercio.findMany({
      where: { comercioId: { in: comercioIds } },
    });
    return new Map(rows.map((r) => [r.comercioId, r]));
  },
};

module.exports = ConfigFiscalRepository;
