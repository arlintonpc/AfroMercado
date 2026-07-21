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

    // Inyectar Banners Publicitarios (Red de Display Cruzada)
    const banners = await prisma.anuncioUbicacion.findMany({
      where: { 
        modulo: 'BIENES_RAICES', 
        formato: 'BANNER', 
        activa: true,
        campana: { estado: 'ACTIVA' }
      },
      include: { campana: true },
    });

    const shuffledBanners = banners.sort(() => 0.5 - Math.random()).slice(0, 2);
    let itemsHibridos = [...items];

    if (shuffledBanners[0] && itemsHibridos.length >= 3) {
      itemsHibridos.splice(3, 0, {
        id: `banner-${shuffledBanners[0].id}`,
        esBannerDisplay: true,
        titulo: shuffledBanners[0].titulo,
        subtitulo: shuffledBanners[0].subtitulo,
        mediaUrl: shuffledBanners[0].mediaUrl,
        urlDestino: shuffledBanners[0].urlDestino,
        ctaTexto: shuffledBanners[0].ctaTexto,
        etiqueta: shuffledBanners[0].etiqueta,
      });
    }

    if (shuffledBanners[1] && itemsHibridos.length >= 7) {
      itemsHibridos.splice(7, 0, {
        id: `banner-${shuffledBanners[1].id}`,
        esBannerDisplay: true,
        titulo: shuffledBanners[1].titulo,
        subtitulo: shuffledBanners[1].subtitulo,
        mediaUrl: shuffledBanners[1].mediaUrl,
        urlDestino: shuffledBanners[1].urlDestino,
        ctaTexto: shuffledBanners[1].ctaTexto,
        etiqueta: shuffledBanners[1].etiqueta,
      });
    }

    return { items: itemsHibridos, total, pagina: Math.max(1, Number(page)) };
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
