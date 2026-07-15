const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

async function _getConfigTransporteId(rutaTransporteId) {
  const ruta = await prisma.rutaTransporte.findUnique({ where: { id: rutaTransporteId }, select: { configTransporteId: true } });
  if (!ruta) throw new ErrorValidacion("Ruta no encontrada");
  return ruta.configTransporteId;
}

const ReviewService = {
  // ── HOTEL ───────────────────────────────────────────────────
  async crearReviewHotel(clienteId, { reservaHotelId, calificacion, comentario }) {
    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaHotelId, clienteId, estado: "CHECKOUT" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar estadías completadas (CHECKOUT)");

    const existente = await prisma.reviewHotel.findUnique({ where: { reservaHotelId } });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para esta estadía");

    const review = await prisma.reviewHotel.create({
      data: { configHotelId: reserva.configHotelId, clienteId, reservaHotelId, calificacion, comentario: comentario || null },
    });

    // Recalcular promedio del hotel
    const agg = await prisma.reviewHotel.aggregate({
      where: { configHotelId: reserva.configHotelId },
      _avg: { calificacion: true },
      _count: true,
    });
    // Actualizar calificacion en Comercio (via configHotel)
    const cfg = await prisma.configHotel.findUnique({ where: { id: reserva.configHotelId } });
    if (cfg) {
      await prisma.comercio.update({
        where: { id: cfg.comercioId },
        data: {
          calificacion: Math.round((agg._avg.calificacion ?? 0) * 100) / 100,
          totalReviews: agg._count,
        },
      });
    }
    return review;
  },

  async reviewsHotel(configHotelId) {
    return prisma.reviewHotel.findMany({
      where: { configHotelId },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
      orderBy: { creadoAt: "desc" },
      take: 50,
    });
  },

  // ── TRANSPORTE ──────────────────────────────────────────────
  async crearReviewTransporte(clienteId, { reservaTransporteId, calificacion, comentario }) {
    const reserva = await prisma.reservaTransporte.findFirst({
      where: { id: reservaTransporteId, clienteId, estado: "COMPLETADA" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar viajes completados");

    const existente = await prisma.reviewTransporte.findUnique({ where: { reservaTransporteId } });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para este viaje");

    const configTransporteId = await _getConfigTransporteId(reserva.rutaTransporteId);
    return prisma.reviewTransporte.create({
      data: { configTransporteId, clienteId, reservaTransporteId, calificacion, comentario: comentario || null },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
    });
  },

  async reviewsTransporte(configTransporteId) {
    return prisma.reviewTransporte.findMany({
      where: { configTransporteId },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
      orderBy: { creadoAt: "desc" },
      take: 50,
    });
  },

  // ── EXPRESS ─────────────────────────────────────────────────
  async crearReviewExpress(clienteId, { pedidoExpressId, calificacion, comentario, fotoUrls }) {
    const pedido = await prisma.pedidoExpress.findFirst({
      where: { id: pedidoExpressId, clienteId, estado: "ENTREGADO" },
    });
    if (!pedido) throw new ErrorValidacion("Solo puedes reseñar pedidos entregados");

    const existente = await prisma.reviewExpress.findUnique({ where: { pedidoExpressId } });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para este pedido");

    return prisma.reviewExpress.create({
      data: {
        configExpressId: pedido.configExpressId, clienteId, pedidoExpressId, calificacion,
        comentario: comentario || null,
        fotoUrls: Array.isArray(fotoUrls) ? fotoUrls.slice(0, 6).filter(u => typeof u === "string") : [],
      },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
    });
  },

  async reviewsExpress(configExpressId) {
    return prisma.reviewExpress.findMany({
      where: { configExpressId },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
      orderBy: { creadoAt: "desc" },
      take: 50,
    });
  },

  // ── TOUR ────────────────────────────────────────────────────
  async crearReviewTour(clienteId, { reservaTourId, calificacion, comentario }) {
    const reserva = await prisma.reservaTour.findFirst({
      where: { id: reservaTourId, clienteId, estado: "COMPLETADA" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar tours completados");

    const existente = await prisma.reviewTour.findUnique({ where: { reservaTourId } });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para este tour");

    return prisma.reviewTour.create({
      data: { configTourId: reserva.configTourId, clienteId, reservaTourId, calificacion, comentario: comentario || null },
    });
  },

  async reviewsTour(configTourId) {
    return prisma.reviewTour.findMany({
      where: { configTourId },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
      orderBy: { creadoAt: "desc" },
      take: 50,
    });
  },

  // ── CULTURA ─────────────────────────────────────────────────
  async crearReviewCultura(clienteId, { reservaCulturalId, calificacion, comentario, fotoUrls, videoUrl }) {
    const reserva = await prisma.reservaCultural.findFirst({
      where: { id: reservaCulturalId, clienteId, estado: "USADA" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar entradas usadas");

    const existente = await prisma.reviewCultura.findUnique({ where: { reservaCulturalId } });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para esta reserva");

    return prisma.reviewCultura.create({
      data: {
        eventoCulturalId: reserva.eventoCulturalId,
        clienteId,
        reservaCulturalId,
        calificacion,
        comentario: comentario || null,
        fotoUrls: Array.isArray(fotoUrls) ? fotoUrls.slice(0, 6) : [],
        videoUrl: videoUrl || null,
      },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
    });
  },

  async reviewsCultura(eventoCulturalId) {
    return prisma.reviewCultura.findMany({
      where: { eventoCulturalId },
      include: { cliente: { select: { nombre: true, avatarUrl: true } } },
      orderBy: { creadoAt: "desc" },
      take: 50,
    });
  },

  async galeriaCultura({ page = 1, departamento } = {}) {
    const take = 20;
    const where = {
      OR: [{ fotoUrls: { isEmpty: false } }, { videoUrl: { not: null } }],
      ...(departamento ? { evento: { departamento } } : {}),
    };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.reviewCultura.findMany({
        where,
        skip,
        take,
        orderBy: { creadoAt: "desc" },
        include: {
          cliente: { select: { nombre: true } },
          evento: { select: { id: true, titulo: true, municipio: true, departamento: true } },
        },
      }),
      prisma.reviewCultura.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },
};

module.exports = ReviewService;
