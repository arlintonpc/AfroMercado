const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const { recalcularCalificacionComercio } = require("../utils/resena");

const CLIENTE_SELECT = { autor: { select: { nombre: true, avatarUrl: true } } };

function _cliente(r) {
  return r.autor ? { nombre: r.autor.nombre, avatarUrl: r.autor.avatarUrl } : undefined;
}

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

    const existente = await prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "RESERVA_HOTEL", entidadId: reservaHotelId, autorId: clienteId } },
    });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para esta estadía");

    const cfg = await prisma.configHotel.findUnique({ where: { id: reserva.configHotelId } });
    const resena = await prisma.resena.create({
      data: {
        tipoEntidad: "RESERVA_HOTEL", entidadId: reservaHotelId, comercioId: cfg?.comercioId ?? null,
        autorId: clienteId, calificacion, comentario: comentario || null,
      },
    });
    if (cfg) await recalcularCalificacionComercio(prisma, cfg.comercioId);

    return {
      id: resena.id, configHotelId: reserva.configHotelId, clienteId, reservaHotelId,
      calificacion: resena.calificacion, comentario: resena.comentario, creadoAt: resena.createdAt,
    };
  },

  async reviewsHotel(configHotelId) {
    const cfg = await prisma.configHotel.findUnique({ where: { id: configHotelId }, select: { comercioId: true } });
    if (!cfg) return [];
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "RESERVA_HOTEL", comercioId: cfg.comercioId },
      include: CLIENTE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(r => ({
      id: r.id, configHotelId, clienteId: r.autorId, reservaHotelId: r.entidadId,
      calificacion: r.calificacion, comentario: r.comentario, creadoAt: r.createdAt, cliente: _cliente(r),
    }));
  },

  // ── TRANSPORTE ──────────────────────────────────────────────
  async crearReviewTransporte(clienteId, { reservaTransporteId, calificacion, comentario }) {
    const reserva = await prisma.reservaTransporte.findFirst({
      where: { id: reservaTransporteId, clienteId, estado: "COMPLETADA" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar viajes completados");

    const existente = await prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "RESERVA_TRANSPORTE", entidadId: reservaTransporteId, autorId: clienteId } },
    });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para este viaje");

    const configTransporteId = await _getConfigTransporteId(reserva.rutaTransporteId);
    const cfg = await prisma.configTransporte.findUnique({ where: { id: configTransporteId }, select: { comercioId: true } });
    const resena = await prisma.resena.create({
      data: {
        tipoEntidad: "RESERVA_TRANSPORTE", entidadId: reservaTransporteId, comercioId: cfg?.comercioId ?? null,
        autorId: clienteId, calificacion, comentario: comentario || null,
      },
      include: CLIENTE_SELECT,
    });
    if (cfg) await recalcularCalificacionComercio(prisma, cfg.comercioId);

    return {
      id: resena.id, configTransporteId, clienteId, reservaTransporteId,
      calificacion: resena.calificacion, comentario: resena.comentario, creadoAt: resena.createdAt, cliente: _cliente(resena),
    };
  },

  async reviewsTransporte(configTransporteId) {
    const cfg = await prisma.configTransporte.findUnique({ where: { id: configTransporteId }, select: { comercioId: true } });
    if (!cfg) return [];
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "RESERVA_TRANSPORTE", comercioId: cfg.comercioId },
      include: CLIENTE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(r => ({
      id: r.id, configTransporteId, clienteId: r.autorId, reservaTransporteId: r.entidadId,
      calificacion: r.calificacion, comentario: r.comentario, creadoAt: r.createdAt, cliente: _cliente(r),
    }));
  },

  // ── EXPRESS ─────────────────────────────────────────────────
  async crearReviewExpress(clienteId, { pedidoExpressId, calificacion, comentario, fotoUrls }) {
    const pedido = await prisma.pedidoExpress.findFirst({
      where: { id: pedidoExpressId, clienteId, estado: "ENTREGADO" },
    });
    if (!pedido) throw new ErrorValidacion("Solo puedes reseñar pedidos entregados");

    const existente = await prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "PEDIDO_EXPRESS", entidadId: pedidoExpressId, autorId: clienteId } },
    });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para este pedido");

    const resena = await prisma.resena.create({
      data: {
        tipoEntidad: "PEDIDO_EXPRESS", entidadId: pedidoExpressId, comercioId: pedido.comercioId,
        autorId: clienteId, calificacion, comentario: comentario || null,
        fotoUrls: Array.isArray(fotoUrls) ? fotoUrls.slice(0, 6).filter(u => typeof u === "string") : [],
      },
      include: CLIENTE_SELECT,
    });
    await recalcularCalificacionComercio(prisma, pedido.comercioId);

    return {
      id: resena.id, configExpressId: pedido.configExpressId, clienteId, pedidoExpressId,
      calificacion: resena.calificacion, comentario: resena.comentario, fotoUrls: resena.fotoUrls,
      creadoAt: resena.createdAt, cliente: _cliente(resena),
    };
  },

  async reviewsExpress(configExpressId) {
    const cfg = await prisma.configExpress.findUnique({ where: { id: configExpressId }, select: { comercioId: true } });
    if (!cfg) return [];
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "PEDIDO_EXPRESS", comercioId: cfg.comercioId },
      include: CLIENTE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(r => ({
      id: r.id, configExpressId, clienteId: r.autorId, pedidoExpressId: r.entidadId,
      calificacion: r.calificacion, comentario: r.comentario, fotoUrls: r.fotoUrls,
      creadoAt: r.createdAt, cliente: _cliente(r),
    }));
  },

  // ── TOUR ────────────────────────────────────────────────────
  async crearReviewTour(clienteId, { reservaTourId, calificacion, comentario }) {
    const reserva = await prisma.reservaTour.findFirst({
      where: { id: reservaTourId, clienteId, estado: "COMPLETADA" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar tours completados");

    const existente = await prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "RESERVA_TOUR", entidadId: reservaTourId, autorId: clienteId } },
    });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para este tour");

    const cfg = await prisma.configTour.findUnique({ where: { id: reserva.configTourId }, select: { comercioId: true } });
    const resena = await prisma.resena.create({
      data: {
        tipoEntidad: "RESERVA_TOUR", entidadId: reservaTourId, comercioId: cfg?.comercioId ?? null,
        autorId: clienteId, calificacion, comentario: comentario || null,
      },
    });
    if (cfg) await recalcularCalificacionComercio(prisma, cfg.comercioId);

    return {
      id: resena.id, configTourId: reserva.configTourId, clienteId, reservaTourId,
      calificacion: resena.calificacion, comentario: resena.comentario, creadoAt: resena.createdAt,
    };
  },

  async reviewsTour(configTourId) {
    const cfg = await prisma.configTour.findUnique({ where: { id: configTourId }, select: { comercioId: true } });
    if (!cfg) return [];
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "RESERVA_TOUR", comercioId: cfg.comercioId },
      include: CLIENTE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(r => ({
      id: r.id, configTourId, clienteId: r.autorId, reservaTourId: r.entidadId,
      calificacion: r.calificacion, comentario: r.comentario, creadoAt: r.createdAt, cliente: _cliente(r),
    }));
  },

  // ── CULTURA ─────────────────────────────────────────────────
  async crearReviewCultura(clienteId, { reservaCulturalId, calificacion, comentario, fotoUrls, videoUrl }) {
    const reserva = await prisma.reservaCultural.findFirst({
      where: { id: reservaCulturalId, clienteId, estado: "USADA" },
    });
    if (!reserva) throw new ErrorValidacion("Solo puedes reseñar entradas usadas");

    const existente = await prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "RESERVA_CULTURAL", entidadId: reservaCulturalId, autorId: clienteId } },
    });
    if (existente) throw new ErrorValidacion("Ya dejaste una reseña para esta reserva");

    const evento = await prisma.eventoCultural.findUnique({ where: { id: reserva.eventoCulturalId }, select: { comercioId: true } });
    const resena = await prisma.resena.create({
      data: {
        tipoEntidad: "RESERVA_CULTURAL", entidadId: reservaCulturalId, comercioId: evento?.comercioId ?? null,
        autorId: clienteId, calificacion, comentario: comentario || null,
        fotoUrls: Array.isArray(fotoUrls) ? fotoUrls.slice(0, 6) : [],
        videoUrl: videoUrl || null,
      },
      include: CLIENTE_SELECT,
    });
    if (evento?.comercioId) await recalcularCalificacionComercio(prisma, evento.comercioId);

    return {
      id: resena.id, eventoCulturalId: reserva.eventoCulturalId, clienteId, reservaCulturalId,
      calificacion: resena.calificacion, comentario: resena.comentario, fotoUrls: resena.fotoUrls,
      videoUrl: resena.videoUrl, creadoAt: resena.createdAt, cliente: _cliente(resena),
    };
  },

  async reviewsCultura(eventoCulturalId) {
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "RESERVA_CULTURAL", entidadId: { in: await _reservasDelEvento(eventoCulturalId) } },
      include: CLIENTE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(r => ({
      id: r.id, eventoCulturalId, clienteId: r.autorId, reservaCulturalId: r.entidadId,
      calificacion: r.calificacion, comentario: r.comentario, fotoUrls: r.fotoUrls,
      videoUrl: r.videoUrl, creadoAt: r.createdAt, cliente: _cliente(r),
    }));
  },

  async galeriaCultura({ page = 1, departamento } = {}) {
    const take = 20;
    const where = {
      tipoEntidad: "RESERVA_CULTURAL",
      OR: [{ fotoUrls: { isEmpty: false } }, { videoUrl: { not: null } }],
    };
    // El filtro por departamento requiere el evento (no está en Resena) —
    // se resuelve con una subconsulta de reservas de eventos de ese departamento.
    if (departamento) {
      where.entidadId = { in: await _reservasPorDepartamento(departamento) };
    }
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [rows, total] = await Promise.all([
      prisma.resena.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { autor: { select: { nombre: true } } },
      }),
      prisma.resena.count({ where }),
    ]);
    const reservaIds = rows.map(r => r.entidadId);
    const reservas = reservaIds.length ? await prisma.reservaCultural.findMany({
      where: { id: { in: reservaIds } },
      select: { id: true, eventoCulturalId: true, evento: { select: { id: true, titulo: true, municipio: true, departamento: true } } },
    }) : [];
    const eventoPorReserva = new Map(reservas.map(r => [r.id, r.evento]));
    const items = rows.map(r => ({
      id: r.id, eventoCulturalId: eventoPorReserva.get(r.entidadId)?.id, clienteId: r.autorId, reservaCulturalId: r.entidadId,
      calificacion: r.calificacion, comentario: r.comentario, fotoUrls: r.fotoUrls, videoUrl: r.videoUrl,
      creadoAt: r.createdAt, cliente: r.autor ? { nombre: r.autor.nombre } : undefined,
      evento: eventoPorReserva.get(r.entidadId) ?? null,
    }));
    return { items, total, pagina: Math.max(1, Number(page)) };
  },
};

async function _reservasDelEvento(eventoCulturalId) {
  const reservas = await prisma.reservaCultural.findMany({ where: { eventoCulturalId }, select: { id: true } });
  return reservas.map(r => r.id);
}

async function _reservasPorDepartamento(departamento) {
  const reservas = await prisma.reservaCultural.findMany({
    where: { evento: { departamento } },
    select: { id: true },
  });
  return reservas.map(r => r.id);
}

module.exports = ReviewService;
