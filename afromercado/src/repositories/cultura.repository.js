const prisma = require("../config/prisma");

const CulturaRepository = {
  // ── Publicaciones comunitarias ("Comparte tu Chocó") ──────────
  async crearPublicacion(data) {
    return prisma.publicacionCultural.create({ data });
  },

  async listarPublicaciones({ departamento, page = 1, take = 20, usuarioId } = {}) {
    const where = {
      activa: true,
      ...(departamento ? { departamento: { equals: departamento, mode: "insensitive" } } : {}),
    };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.publicacionCultural.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          autor: { select: { id: true, nombre: true } },
          _count: { select: { likes: true } },
          ...(usuarioId ? { likes: { where: { usuarioId }, select: { id: true } } } : {}),
        },
      }),
      prisma.publicacionCultural.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },

  async buscarPublicacionPorId(id) {
    return prisma.publicacionCultural.findUnique({ where: { id } });
  },

  async ocultarPublicacion(id) {
    return prisma.publicacionCultural.update({ where: { id }, data: { activa: false } });
  },

  // ── Denuncias de publicaciones ─────────────────────────────────
  async crearDenunciaPublicacion(data) {
    return prisma.denunciaPublicacionCultural.create({ data });
  },

  async buscarDenunciaPublicacion(publicacionCulturalId, denuncianteId) {
    return prisma.denunciaPublicacionCultural.findUnique({
      where: { publicacionCulturalId_denuncianteId: { publicacionCulturalId, denuncianteId } },
    });
  },

  async buscarDenunciaPublicacionPorId(id) {
    return prisma.denunciaPublicacionCultural.findUnique({
      where: { id },
      include: { publicacion: true },
    });
  },

  async listarDenunciasPublicacionPendientes() {
    return prisma.denunciaPublicacionCultural.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        publicacion: { include: { autor: { select: { id: true, nombre: true } } } },
        denunciante: { select: { id: true, nombre: true } },
      },
    });
  },

  async actualizarDenunciaPublicacion(id, data) {
    return prisma.denunciaPublicacionCultural.update({ where: { id }, data });
  },
};

module.exports = CulturaRepository;
