const prisma = require("../config/prisma");

const InmuebleRepository = {
  // ── Inmuebles ────────────────────────────────────────────────
  async crear(data) {
    return prisma.inmueble.create({ data });
  },

  async buscarPorId(id) {
    return prisma.inmueble.findUnique({
      where: { id },
      include: {
        publicador: { select: { id: true, nombre: true } },
        comercio: { select: { id: true, nombre: true, verificado: true, logoUrl: true } },
      },
    });
  },

  async actualizar(id, data) {
    return prisma.inmueble.update({ where: { id }, data });
  },

  async listarPublicos({ departamento, municipio, tipoInmueble, tipoOperacion, precioMax, page = 1, take = 20 }) {
    const max = precioMax != null && precioMax !== "" ? Number(precioMax) : null;
    const where = {
      estado: "PUBLICADO",
      estadoModeracion: "APROBADA",
      deletedAt: null,
      ...(departamento ? { departamento: { equals: departamento, mode: "insensitive" } } : {}),
      ...(municipio ? { municipio: { contains: municipio, mode: "insensitive" } } : {}),
      ...(tipoInmueble ? { tipoInmueble } : {}),
      ...(tipoOperacion ? { tipoOperacion } : {}),
      ...(max != null ? { precio: { lte: max } } : {}),
    };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.inmueble.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          publicador: { select: { id: true, nombre: true } },
          comercio: { select: { id: true, nombre: true, verificado: true, logoUrl: true } },
        },
      }),
      prisma.inmueble.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },

  async listarPorPublicador(usuarioId) {
    return prisma.inmueble.findMany({
      where: { publicadorId: usuarioId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async listarPendientesModeracion() {
    return prisma.inmueble.findMany({
      where: { estadoModeracion: "PENDIENTE", deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { publicador: { select: { id: true, nombre: true, email: true } } },
    });
  },

  async cerrarTodosLosDelUsuario(publicadorId, adminId, motivo) {
    return prisma.inmueble.updateMany({
      where: { publicadorId, estado: { not: "CERRADO" }, deletedAt: null },
      data: {
        estado: "CERRADO",
        estadoModeracion: "RECHAZADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        motivoRechazoModeracion: motivo,
      },
    });
  },

  // ── Denuncias ────────────────────────────────────────────────
  async crearDenuncia(data) {
    return prisma.denunciaInmueble.create({ data });
  },

  async buscarDenuncia(inmuebleId, denuncianteId) {
    return prisma.denunciaInmueble.findUnique({
      where: { inmuebleId_denuncianteId: { inmuebleId, denuncianteId } },
    });
  },

  async buscarDenunciaPorId(id) {
    return prisma.denunciaInmueble.findUnique({
      where: { id },
      include: { inmueble: true },
    });
  },

  async listarDenunciasPendientes() {
    return prisma.denunciaInmueble.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        inmueble: { include: { publicador: { select: { id: true, nombre: true, email: true } } } },
        denunciante: { select: { id: true, nombre: true, email: true } },
      },
    });
  },

  async actualizarDenuncia(id, data) {
    return prisma.denunciaInmueble.update({ where: { id }, data });
  },

  async resolverDenunciasPendientesDelUsuario(publicadorId, nuevoEstado, adminId, motivo) {
    return prisma.denunciaInmueble.updateMany({
      where: { estado: "PENDIENTE", inmueble: { publicadorId } },
      data: {
        estado: nuevoEstado,
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo,
      },
    });
  },
};

module.exports = InmuebleRepository;
