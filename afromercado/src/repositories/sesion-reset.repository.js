const prisma = require("../config/prisma");

const SesionResetRepository = {
  async crear({ usuarioId, tokenHash, expiresAt }) {
    return prisma.sesionReset.create({
      data: { usuarioId, tokenHash, expiresAt },
    });
  },

  async buscarActiva(id) {
    const ahora = new Date();
    return prisma.sesionReset.findFirst({
      where: { id, usadoEn: null, expiresAt: { gt: ahora } },
    });
  },

  async marcarUsada(id) {
    return prisma.sesionReset.update({
      where: { id },
      data: { usadoEn: new Date() },
    });
  },
};

module.exports = SesionResetRepository;
