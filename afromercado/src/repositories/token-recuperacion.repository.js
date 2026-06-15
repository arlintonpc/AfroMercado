const prisma = require("../config/prisma");

const TokenRecuperacionRepository = {
  async crear({ usuarioId, codigoHash, expiresAt }) {
    return prisma.tokenRecuperacion.create({
      data: { usuarioId, codigoHash, expiresAt },
    });
  },

  async buscarActivoPorUsuario(usuarioId) {
    const ahora = new Date();
    return prisma.tokenRecuperacion.findFirst({
      where: {
        usuarioId,
        usadoEn: null,
        reemplazadoEn: null,
        expiresAt: { gt: ahora },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async contarRecientes(usuarioId, desdeHace) {
    return prisma.tokenRecuperacion.count({
      where: {
        usuarioId,
        createdAt: { gt: desdeHace },
      },
    });
  },

  async marcarReemplazados(usuarioId) {
    return prisma.tokenRecuperacion.updateMany({
      where: {
        usuarioId,
        usadoEn: null,
        reemplazadoEn: null,
      },
      data: { reemplazadoEn: new Date() },
    });
  },

  async marcarUsado(id) {
    return prisma.tokenRecuperacion.update({
      where: { id },
      data: { usadoEn: new Date() },
    });
  },

  async incrementarIntentos(id) {
    return prisma.tokenRecuperacion.update({
      where: { id },
      data: { intentos: { increment: 1 } },
    });
  },
};

module.exports = TokenRecuperacionRepository;
