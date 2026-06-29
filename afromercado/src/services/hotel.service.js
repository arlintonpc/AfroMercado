const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `HT-${ts}-${rnd}`;
}

async function notifHotel(usuarioId, titulo, cuerpo, url) {
  if (!usuarioId) return;
  try {
    await prisma.notificacion.create({
      data: { usuarioId, tipo: "GENERAL", titulo, mensaje: cuerpo, url: url || null },
    });
    sseManager.enviar(usuarioId, "notificacion", { tipo: "HOTEL", titulo, mensaje: cuerpo, url });
    await enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono: "/icon-192.svg" });
  } catch (e) {
    console.error("[NOTIF-HOTEL]", e.message);
  }
}

const HOTEL_INCLUDE = {
  comercio: {
    select: {
      id: true, nombre: true, municipio: true, departamento: true,
      latitud: true, longitud: true, logoUrl: true, calificacion: true,
      totalReviews: true, whatsapp: true, descripcion: true,
    },
  },
  habitaciones: {
    where: { activo: true },
    orderBy: { precioPorNoche: "asc" },
  },
};

const HotelService = {
  // ── PÚBLICO ──────────────────────────────────────────────────

  async listarHoteles({ municipio, departamento } = {}) {
    const comercioWhere = {};
    if (municipio)    comercioWhere.municipio    = { contains: municipio,    mode: "insensitive" };
    if (departamento) comercioWhere.departamento = { contains: departamento, mode: "insensitive" };

    const where = { activo: true };
    if (Object.keys(comercioWhere).length > 0) where.comercio = comercioWhere;

    const hoteles = await prisma.configHotel.findMany({
      where,
      include: HOTEL_INCLUDE,
      orderBy: { creadoAt: "desc" },
    });
    return hoteles;
  },

  async obtenerHotel(configHotelId) {
    const hotel = await prisma.configHotel.findUnique({
      where: { id: configHotelId },
      include: HOTEL_INCLUDE,
    });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");
    return hotel;
  },

  async obtenerHotelPorComercio(comercioId) {
    const hotel = await prisma.configHotel.findUnique({
      where: { comercioId },
      include: HOTEL_INCLUDE,
    });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");
    return hotel;
  },

  // Verifica disponibilidad de un tipo de habitación en un rango de fechas
  async verificarDisponibilidad(habitacionTipoId, fechaEntrada, fechaSalida) {
    const tipo = await prisma.habitacionTipo.findUnique({
      where: { id: habitacionTipoId },
    });
    if (!tipo || !tipo.activo) throw new ErrorNoEncontrado("Tipo de habitación no disponible");

    // Contar reservas activas que se solapan con el rango pedido
    const reservasSolapadas = await prisma.reservaHotel.count({
      where: {
        habitacionTipoId,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "CHECKIN"] },
        fechaEntrada: { lt: fechaSalida },
        fechaSalida:  { gt: fechaEntrada },
      },
    });

    const disponibles = tipo.cantidad - reservasSolapadas;
    return { disponibles, total: tipo.cantidad, tipo };
  },

  // ── CLIENTE ──────────────────────────────────────────────────

  async crearReserva(clienteId, datos) {
    const { habitacionTipoId, fechaEntrada, fechaSalida, huespedes, metodoPago, notasCliente, nombreHuesped, telefonoHuesped } = datos;

    const entrada = new Date(fechaEntrada);
    const salida  = new Date(fechaSalida);
    if (isNaN(entrada) || isNaN(salida)) throw new ErrorValidacion("Fechas inválidas");
    if (salida <= entrada) throw new ErrorValidacion("La fecha de salida debe ser posterior a la de entrada");
    const noches = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));

    const { disponibles, tipo } = await this.verificarDisponibilidad(habitacionTipoId, entrada, salida);
    if (disponibles <= 0) throw new ErrorValidacion("No hay disponibilidad para esas fechas");

    const total = Number(tipo.precioPorNoche) * noches;

    const hotel = await prisma.configHotel.findUnique({ where: { id: tipo.configHotelId } });
    const estadoInicial = hotel?.confirmacionAuto ? "CONFIRMADA" : "PENDIENTE";

    const reserva = await prisma.reservaHotel.create({
      data: {
        codigo: generarCodigo(),
        configHotelId: tipo.configHotelId,
        habitacionTipoId,
        clienteId,
        fechaEntrada: entrada,
        fechaSalida:  salida,
        huespedes:    Number(huespedes) || 1,
        total,
        estado:       estadoInicial,
        metodoPago:   metodoPago || "EFECTIVO",
        notasCliente: notasCliente || null,
        nombreHuesped,
        telefonoHuesped,
      },
      include: {
        habitacionTipo: true,
        configHotel: { include: { comercio: { select: { usuarioId: true, nombre: true } } } },
      },
    });

    // Notificar al hotelero
    const hoteleroId = reserva.configHotel.comercio.usuarioId;
    await notifHotel(
      hoteleroId,
      estadoInicial === "CONFIRMADA" ? "✅ Nueva reserva confirmada" : "🏨 Nueva solicitud de reserva",
      `${nombreHuesped} · ${tipo.nombre} · ${noches} noche(s)`,
      "/comerciante/hoteles"
    );

    return reserva;
  },

  async misReservas(clienteId) {
    return prisma.reservaHotel.findMany({
      where: { clienteId },
      include: {
        habitacionTipo: { select: { nombre: true, fotos: true, precioPorNoche: true } },
        configHotel: {
          select: {
            id: true, checkInHora: true, checkOutHora: true,
            comercio: { select: { nombre: true, municipio: true, logoUrl: true } },
          },
        },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReservaCliente(reservaId, clienteId) {
    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, clienteId },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (["CHECKIN", "CHECKOUT", "CANCELADA", "RECHAZADA"].includes(reserva.estado)) {
      throw new ErrorValidacion("No se puede cancelar una reserva en este estado");
    }
    return prisma.reservaHotel.update({
      where: { id: reservaId },
      data:  { estado: "CANCELADA", updatedAt: new Date() },
    });
  },

  // ── HOTELERO ─────────────────────────────────────────────────

  async obtenerOCrearConfig(comercioId) {
    let cfg = await prisma.configHotel.findUnique({
      where: { comercioId },
      include: { habitaciones: { orderBy: { creadoAt: "asc" } } },
    });
    if (!cfg) {
      cfg = await prisma.configHotel.create({
        data: { comercioId },
        include: { habitaciones: true },
      });
    }
    return cfg;
  },

  async actualizarConfig(comercioId, datos) {
    const { activo, confirmacionAuto, horasLimiteConfirm, servicios, politicaCancelacion, checkInHora, checkOutHora } = datos;
    return prisma.configHotel.upsert({
      where:  { comercioId },
      update: { activo, confirmacionAuto, horasLimiteConfirm, servicios, politicaCancelacion, checkInHora, checkOutHora, updatedAt: new Date() },
      create: { comercioId, activo: activo ?? false, confirmacionAuto: confirmacionAuto ?? false,
                horasLimiteConfirm: horasLimiteConfirm ?? 2, servicios: servicios ?? [],
                politicaCancelacion, checkInHora: checkInHora ?? "15:00", checkOutHora: checkOutHora ?? "12:00" },
      include: { habitaciones: true },
    });
  },

  async agregarHabitacion(comercioId, datos) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configura el hotel primero");
    const { nombre, descripcion, capacidad, precioPorNoche, cantidad, fotos, serviciosExtra } = datos;
    if (!nombre || !precioPorNoche) throw new ErrorValidacion("Nombre y precio son obligatorios");
    return prisma.habitacionTipo.create({
      data: {
        configHotelId: cfg.id,
        nombre,
        descripcion: descripcion || null,
        capacidad:   Number(capacidad) || 2,
        precioPorNoche: Number(precioPorNoche),
        cantidad:    Number(cantidad) || 1,
        fotos:       fotos ?? [],
        serviciosExtra: serviciosExtra ?? [],
      },
    });
  },

  async actualizarHabitacion(comercioId, habitacionId, datos) {
    const hab = await prisma.habitacionTipo.findFirst({
      where: { id: habitacionId, configHotel: { comercioId } },
    });
    if (!hab) throw new ErrorNoEncontrado("Habitación no encontrada");
    const { nombre, descripcion, capacidad, precioPorNoche, cantidad, fotos, serviciosExtra, activo } = datos;
    return prisma.habitacionTipo.update({
      where: { id: habitacionId },
      data:  { nombre, descripcion, capacidad: Number(capacidad), precioPorNoche: Number(precioPorNoche),
                cantidad: Number(cantidad), fotos, serviciosExtra, activo },
    });
  },

  async eliminarHabitacion(comercioId, habitacionId) {
    const hab = await prisma.habitacionTipo.findFirst({
      where: { id: habitacionId, configHotel: { comercioId } },
    });
    if (!hab) throw new ErrorNoEncontrado("Habitación no encontrada");
    // Soft-delete: desactivar
    return prisma.habitacionTipo.update({ where: { id: habitacionId }, data: { activo: false } });
  },

  async reservasHotelero(comercioId, { estado, page = 1 } = {}) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    const where = { configHotelId: cfg.id };
    if (estado) where.estado = estado;
    return prisma.reservaHotel.findMany({
      where,
      include: {
        habitacionTipo: { select: { nombre: true } },
        cliente: { select: { nombre: true, email: true, telefono: true } },
      },
      orderBy: { creadoAt: "desc" },
      take: 50,
      skip: (page - 1) * 50,
    });
  },

  async cambiarEstadoReserva(comercioId, reservaId, nuevoEstado) {
    const TRANSICIONES = {
      PENDIENTE:  ["CONFIRMADA", "RECHAZADA"],
      CONFIRMADA: ["CHECKIN", "CANCELADA"],
      CHECKIN:    ["CHECKOUT"],
    };
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");

    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, configHotelId: cfg.id },
      include: { cliente: { select: { id: true, nombre: true } }, habitacionTipo: { select: { nombre: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

    const permitidos = TRANSICIONES[reserva.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ErrorValidacion(`No se puede pasar de ${reserva.estado} a ${nuevoEstado}`);
    }

    const actualizada = await prisma.reservaHotel.update({
      where: { id: reservaId },
      data:  { estado: nuevoEstado, updatedAt: new Date() },
    });

    // Notificar al cliente
    const MSGS = {
      CONFIRMADA: ["✅ Reserva confirmada", "Tu reserva ha sido confirmada por el hotel"],
      RECHAZADA:  ["❌ Reserva rechazada",  "Lamentablemente el hotel rechazó tu solicitud"],
      CHECKIN:    ["🏨 Check-in registrado","¡Bienvenido! Tu check-in ha sido registrado"],
      CHECKOUT:   ["👋 Check-out completado","Gracias por hospedarte. ¡Hasta pronto!"],
      CANCELADA:  ["❌ Reserva cancelada",  "Tu reserva fue cancelada"],
    };
    const [titulo, cuerpo] = MSGS[nuevoEstado] ?? [`Estado: ${nuevoEstado}`, ""];
    await notifHotel(reserva.cliente.id, titulo, cuerpo, "/hoteles/mis-reservas");

    return actualizada;
  },

  // Ocupación: habitaciones y reservas activas para un hotel (para el panel calendario)
  async ocupacion(comercioId) {
    const cfg = await prisma.configHotel.findUnique({
      where: { comercioId },
      include: {
        habitaciones: { where: { activo: true } },
      },
    });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");

    const reservasActivas = await prisma.reservaHotel.findMany({
      where: {
        configHotelId: cfg.id,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "CHECKIN"] },
      },
      include: { habitacionTipo: { select: { nombre: true } }, cliente: { select: { nombre: true } } },
      orderBy: { fechaEntrada: "asc" },
    });

    return { habitaciones: cfg.habitaciones, reservas: reservasActivas };
  },
};

module.exports = HotelService;
