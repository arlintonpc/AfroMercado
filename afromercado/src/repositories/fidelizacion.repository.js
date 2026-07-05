const prisma = require("../config/prisma");

const FidelizacionRepository = {
  async buscarPorUsuarioId(usuarioId) {
    return prisma.perfilFidelizacion.findUnique({ where: { usuarioId } });
  },

  async buscarPorCodigoReferido(codigo) {
    return prisma.perfilFidelizacion.findUnique({ where: { codigoReferido: codigo } });
  },

  async crear(usuarioId, codigoReferido, referidoPorId) {
    return prisma.perfilFidelizacion.create({
      data: { usuarioId, codigoReferido, referidoPorId: referidoPorId ?? null },
    });
  },

  async registrarMovimiento(perfilId, { tipo, puntos, moduloOrigen, referenciaId, descripcion, creadoPor }) {
    return prisma.$transaction(async (tx) => {
      await tx.perfilFidelizacion.update({
        where: { id: perfilId },
        data: {
          puntos: { increment: puntos },
          ...(puntos > 0 ? { puntosAcumuladosTotal: { increment: puntos } } : {}),
        },
      });
      return tx.movimientoPuntos.create({
        data: { perfilId, tipo, puntos, moduloOrigen, referenciaId, descripcion, creadoPor },
      });
    });
  },

  async listarMovimientos(perfilId) {
    return prisma.movimientoPuntos.findMany({ where: { perfilId }, orderBy: { createdAt: "desc" }, take: 100 });
  },

  /** ¿Este usuario ya tuvo alguna compra confirmada antes de la referencia dada? */
  async yaTuvoCompraPrevia(usuarioId, excluirModuloOrigen, excluirReferenciaId) {
    const previo = await prisma.movimientoPuntos.findFirst({
      where: {
        tipo: "GANADO_COMPRA",
        perfil: { usuarioId },
        NOT: { moduloOrigen: excluirModuloOrigen, referenciaId: excluirReferenciaId },
      },
    });
    return !!previo;
  },
};

module.exports = FidelizacionRepository;
