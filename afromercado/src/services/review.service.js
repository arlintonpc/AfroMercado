const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

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
};

module.exports = ReviewService;
