const prisma = require("../config/prisma");
const { filtroComercioVisible } = require("../utils/comercio-publicacion");

const CulturaRepository = {
  // ── Publicaciones comunitarias ("Comparte tu Chocó") ──────────
  async crearPublicacion(data) {
    return prisma.publicacionCultural.create({ data });
  },

  async listarPublicaciones({ departamento, page = 1, take = 20, usuarioId } = {}) {
    const where = {
      activa: true,
      comercioId: null, // feed personal "Comparte tu Chocó" — nunca mezcla contenido comercial de la vitrina
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

  // ── Vitrina de video (v0) — publicaciones de comercio ("moduloOrigen") ──
  // v0.2: ya no pagina directo en SQL — trae una ventana acotada de las
  // publicaciones más recientes (candidatos a rankear) y deja que
  // CulturaService.listarVitrina aplique el puntaje heurístico y la
  // paginación en memoria sobre esa ventana. `total` sigue siendo el count()
  // real, sin el límite de la ventana.
  async listarVitrina({ departamento, modulo, search, page = 1, usuarioId } = {}) {
    const where = {
      activa: true,
      comercioId: { not: null },
      comercio: filtroComercioVisible(),
      ...(departamento ? { departamento: { equals: departamento, mode: "insensitive" } } : {}),
      ...(modulo ? { moduloOrigen: modulo } : {}),
      ...(search ? { titulo: { contains: search, mode: "insensitive" } } : {}),
    };
    const [itemsVentana, total] = await Promise.all([
      prisma.publicacionCultural.findMany({
        where,
        take: 200,
        orderBy: { createdAt: "desc" },
        include: {
          autor: { select: { id: true, nombre: true } },
          comercio: {
            select: {
              id: true,
              nombre: true,
              logoUrl: true,
              whatsapp: true,
              whatsappVisible: true,
              municipio: true,
              departamento: true,
              activo: true,
              verificado: true,
              estadoRegistro: true,
              fotoDocumentoUrl: true,
              fotoDocumentoFrenteUrl: true,
              fotoDocumentoReversoUrl: true,
              cuentaDispersion: { select: { estado: true } },
              _count: { select: { seguidores: true } },
            },
          },
          producto: { select: { id: true, nombre: true, precio: true, fotoUrl: true, esExpress: true, comercioId: true } },
          _count: { select: { likes: true, comentarios: true, vistas: true } },
          ...(usuarioId ? { likes: { where: { usuarioId }, select: { id: true } } } : {}),
        },
      }),
      prisma.publicacionCultural.count({ where }),
    ]);
    return { itemsVentana, total, pagina: Math.max(1, Number(page)) };
  },

  async buscarPublicacionPorId(id) {
    return prisma.publicacionCultural.findUnique({ where: { id } });
  },

  async ocultarPublicacion(id) {
    return prisma.publicacionCultural.update({ where: { id }, data: { activa: false } });
  },

  async listarMisPublicaciones(comercioId, page = 1, take = 20) {
    const where = { comercioId };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.publicacionCultural.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { vistas: true, likes: true, comentarios: true } },
          producto: { select: { id: true, nombre: true, comercioId: true, esExpress: true } },
        },
      }),
      prisma.publicacionCultural.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },

  async actualizarMiPublicacion(id, comercioId, data) {
    return prisma.publicacionCultural.update({
      where: { id, comercioId },
      data,
    });
  },

  async eliminarPublicacion(id, comercioId) {
    return prisma.publicacionCultural.delete({
      where: { id, comercioId },
    });
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
