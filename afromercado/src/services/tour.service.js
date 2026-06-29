const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TR-${ts}-${rnd}`;
}

async function notifTour(usuarioId, titulo, cuerpo, url) {
  if (!usuarioId) return;
  try {
    await prisma.notificacion.create({
      data: { usuarioId, tipo: "GENERAL", titulo, mensaje: cuerpo, url: url || null },
    });
    sseManager.enviar(usuarioId, "notificacion", { tipo: "TOUR", titulo, mensaje: cuerpo, url });
    await enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono: "/icon-192.svg" });
  } catch (e) {
    console.error("[NOTIF-TOUR]", e.message);
  }
}

const TOUR_INCLUDE = {
  comercio: {
    select: {
      id: true, nombre: true, municipio: true, departamento: true,
      latitud: true, longitud: true, logoUrl: true, calificacion: true,
      totalReviews: true, whatsapp: true, descripcion: true,
    },
  },
};

const TourService = {
  async listarTours({ municipio, departamento } = {}) {
    const comercioWhere = { verificado: true };
    if (municipio) comercioWhere.municipio = { contains: municipio, mode: "insensitive" };
    if (departamento) comercioWhere.departamento = { contains: departamento, mode: "insensitive" };

    return prisma.configTour.findMany({
      where: { activo: true, comercio: comercioWhere },
      include: TOUR_INCLUDE,
      orderBy: { creadoAt: "desc" },
    });
  },

  async obtenerTour(id) {
    const tour = await prisma.configTour.findUnique({
      where: { id },
      include: TOUR_INCLUDE,
    });
    if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");
    return tour;
  },

  async verificarDisponibilidad(configTourId, fecha) {
    const tour = await prisma.configTour.findUnique({ where: { id: configTourId } });
    if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");

    const fechaD = new Date(fecha);
    const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaD); fin.setHours(23, 59, 59, 999);

    const totalParticipantes = await prisma.reservaTour.aggregate({
      where: {
        configTourId,
        fechaTour: { gte: inicio, lte: fin },
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      },
      _sum: { participantes: true },
    });
    const ocupados = totalParticipantes._sum.participantes ?? 0;
    return { disponibles: Math.max(0, tour.maxParticipantes - ocupados), maxParticipantes: tour.maxParticipantes };
  },

  async crearReserva(clienteId, { configTourId, fechaTour, participantes, metodoPago, notasCliente, nombreContacto, telefonoContacto }) {
    const tour = await prisma.configTour.findUnique({ where: { id: configTourId }, include: TOUR_INCLUDE });
    if (!tour || !tour.activo) throw new ErrorValidacion("Tour no disponible");

    const disp = await TourService.verificarDisponibilidad(configTourId, fechaTour);
    if (disp.disponibles < participantes) throw new ErrorValidacion("No hay suficientes cupos disponibles");

    const total = Number(tour.precioPersona) * participantes;
    const estado = tour.confirmacionAuto ? "CONFIRMADA" : "PENDIENTE";

    const reserva = await prisma.reservaTour.create({
      data: {
        codigo: generarCodigo(),
        configTourId,
        clienteId,
        fechaTour: new Date(fechaTour),
        participantes,
        total,
        estado,
        metodoPago,
        notasCliente: notasCliente || null,
        nombreContacto,
        telefonoContacto,
      },
      include: { configTour: { include: TOUR_INCLUDE } },
    });

    // Notificar al operador del tour
    const operadorId = await prisma.comercio.findUnique({
      where: { id: tour.comercioId }, select: { usuarioId: true },
    }).then(c => c?.usuarioId);

    if (operadorId) {
      await notifTour(operadorId, "🗺️ Nueva reserva de tour", `${nombreContacto} reservó ${participantes} cupo(s) para ${tour.nombre}`, "/comerciante/tours");
    }
    if (estado === "CONFIRMADA") {
      await notifTour(clienteId, "✅ Tour confirmado", `Tu reserva para ${tour.nombre} está confirmada`, "/tours/mis-reservas");
    }
    return reserva;
  },

  async misReservas(clienteId) {
    return prisma.reservaTour.findMany({
      where: { clienteId },
      include: { configTour: { include: TOUR_INCLUDE } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReserva(clienteId, reservaId) {
    const reserva = await prisma.reservaTour.findFirst({
      where: { id: reservaId, clienteId },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) {
      throw new ErrorValidacion("Esta reserva no se puede cancelar");
    }
    return prisma.reservaTour.update({ where: { id: reservaId }, data: { estado: "CANCELADA", updatedAt: new Date() } });
  },

  // Operador
  async miTour(comercioId) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId }, include: TOUR_INCLUDE });
    if (!tour) {
      return prisma.configTour.create({
        data: { comercioId, nombre: "Mi Tour", precioPersona: 0, fotos: [], servicios: [], idiomas: [] },
        include: TOUR_INCLUDE,
      });
    }
    return tour;
  },

  async actualizarTour(comercioId, datos) {
    return prisma.configTour.update({ where: { comercioId }, data: { ...datos, updatedAt: new Date() } });
  },

  async reservasOperador(comercioId, estado) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) return [];
    return prisma.reservaTour.findMany({
      where: { configTourId: tour.id, ...(estado ? { estado } : {}) },
      include: { cliente: { select: { id: true, nombre: true, email: true, telefono: true } } },
      orderBy: { fechaTour: "desc" },
    });
  },

  async cambiarEstadoReserva(comercioId, reservaId, nuevoEstado) {
    const TRANSICIONES = {
      PENDIENTE:  ["CONFIRMADA", "RECHAZADA"],
      CONFIRMADA: ["COMPLETADA", "CANCELADA"],
    };
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");

    const reserva = await prisma.reservaTour.findFirst({
      where: { id: reservaId, configTourId: tour.id },
      include: { cliente: { select: { id: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

    const permitidos = TRANSICIONES[reserva.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ErrorValidacion(`No se puede pasar de ${reserva.estado} a ${nuevoEstado}`);
    }

    const actualizada = await prisma.reservaTour.update({
      where: { id: reservaId },
      data: { estado: nuevoEstado, updatedAt: new Date() },
    });

    const MSGS = {
      CONFIRMADA: ["✅ Tour confirmado", "Tu reserva de tour ha sido confirmada"],
      RECHAZADA:  ["❌ Tour rechazado",  "Lamentablemente el operador rechazó tu solicitud"],
      COMPLETADA: ["🎉 Tour completado","¡Gracias por participar en el tour!"],
      CANCELADA:  ["❌ Reserva cancelada","Tu reserva de tour fue cancelada"],
    };
    const [titulo, cuerpo] = MSGS[nuevoEstado] ?? [`Estado: ${nuevoEstado}`, ""];
    await notifTour(reserva.cliente.id, titulo, cuerpo, "/tours/mis-reservas");
    return actualizada;
  },

  async agregarFotos(comercioId, urls) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");
    return prisma.configTour.update({
      where: { comercioId },
      data: { fotos: [...tour.fotos, ...urls], updatedAt: new Date() },
    });
  },

  // Admin
  async adminListar() {
    return prisma.configTour.findMany({
      include: {
        comercio: { select: { id: true, nombre: true, municipio: true, departamento: true } },
        _count: { select: { reservas: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  async adminCambiarEstado(id, activo) {
    return prisma.configTour.update({ where: { id }, data: { activo } });
  },
};

module.exports = TourService;
