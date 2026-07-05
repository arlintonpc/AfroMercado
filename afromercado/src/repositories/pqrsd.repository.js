const prisma = require("../config/prisma");

const PqrsdRepository = {
  async crear(data) {
    return prisma.pqrsd.create({ data });
  },

  async buscarPorId(id) {
    return prisma.pqrsd.findUnique({ where: { id } });
  },

  async listarPorUsuario(usuarioId) {
    return prisma.pqrsd.findMany({ where: { usuarioId }, orderBy: { createdAt: "desc" } });
  },

  async listarAdmin({ estado, tipo } = {}) {
    return prisma.pqrsd.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(tipo ? { tipo } : {}),
      },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
    });
  },

  async responder(id, { respuesta, respondidoPor }) {
    return prisma.pqrsd.update({
      where: { id },
      data: { respuesta, respondidoPor, respondidoAt: new Date(), estado: "RESPONDIDO" },
    });
  },

  async cerrar(id, cerradoPor) {
    return prisma.pqrsd.update({
      where: { id },
      data: { estado: "CERRADO", cerradoPor, cerradoAt: new Date() },
    });
  },
};

module.exports = PqrsdRepository;
