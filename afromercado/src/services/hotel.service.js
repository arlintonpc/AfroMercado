const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const ConfigRepository = require("../repositories/config.repository");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");
const { enviarEmail } = require("../utils/email");
const emailHotel = require("../utils/templates/email-hotel");

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

    // Verificar bloqueos manuales
    const cfg = await prisma.configHotel.findUnique({ where: { id: tipo.configHotelId } });
    let bloqueado = false;
    if (cfg) {
      const rawBloqueos = await ConfigRepository.obtener(`HOTEL_BLOQUEOS_${cfg.id}`);
      const bloqueos = rawBloqueos ? JSON.parse(rawBloqueos) : [];
      bloqueado = bloqueos.some(b =>
        (b.habitacionId === null || b.habitacionId === habitacionTipoId) &&
        b.fechaInicio < fechaSalida.toISOString().slice(0, 10) &&
        b.fechaFin > fechaEntrada.toISOString().slice(0, 10)
      );
    }

    const disponibles = bloqueado ? 0 : tipo.cantidad - reservasSolapadas;
    return { disponibles, total: tipo.cantidad, tipo };
  },

  // ── CLIENTE ──────────────────────────────────────────────────

  async crearReserva(clienteId, datos) {
    const { habitacionTipoId, fechaEntrada, fechaSalida, huespedes, metodoPago, notasCliente, nombreHuesped, telefonoHuesped } = datos;

    const entrada = new Date(fechaEntrada);
    const salida  = new Date(fechaSalida);
    if (isNaN(entrada) || isNaN(salida)) throw new ErrorValidacion("Fechas inválidas");
    if (entrada < new Date(new Date().toDateString())) throw new ErrorValidacion("La fecha de entrada no puede ser en el pasado");
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
        configHotel: { include: { comercio: { include: { usuario: { select: { email: true, nombre: true } } } } } },
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

    // Email al hotelero (fire and forget)
    const emailHotelero = reserva.configHotel.comercio.usuario?.email;
    if (emailHotelero) {
      setImmediate(() => {
        enviarEmail({
          to: emailHotelero,
          subject: `Nueva reserva — ${nombreHuesped} · ${tipo.nombre} — AfroMercado`,
          html: emailHotel.reservaNueva({
            nombreHotelero: reserva.configHotel.comercio.usuario.nombre || "Hotelero",
            nombreHuesped,
            habitacion: tipo.nombre,
            fechaEntrada: entrada,
            fechaSalida:  salida,
            noches,
            total,
          }),
        }).catch((err) => console.error("[EMAIL-HOTEL]", err.message));
      });
    }

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
        review: { select: { id: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReservaCliente(reservaId, clienteId) {
    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, clienteId },
      include: {
        configHotel: {
          select: { horasLibresCancelacion: true, pctPenalidadCancelacion: true },
        },
      },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (["CHECKIN", "CHECKOUT", "CANCELADA", "RECHAZADA"].includes(reserva.estado)) {
      throw new ErrorValidacion("No se puede cancelar una reserva en este estado");
    }

    // Calcular penalización
    const ahora = new Date();
    const horasRestantes = (reserva.fechaEntrada - ahora) / (1000 * 60 * 60);
    const totalPagado = Number(reserva.total);
    const horasLibres = reserva.configHotel?.horasLibresCancelacion ?? 48;
    const pctPenalidad = reserva.configHotel?.pctPenalidadCancelacion ?? 0;

    let montoPenalidad = 0;
    let montoReembolso = totalPagado;

    if (horasRestantes < horasLibres && pctPenalidad > 0) {
      montoPenalidad = Math.round(totalPagado * pctPenalidad / 100);
      montoReembolso = totalPagado - montoPenalidad;
    }

    return prisma.reservaHotel.update({
      where: { id: reservaId },
      data: {
        estado: "CANCELADA",
        montoPenalidad,
        montoReembolso,
        updatedAt: new Date(),
      },
    });
  },

  // Consultar política de cancelación sin cancelar
  async consultarPoliticaCancelacion(reservaId, clienteId) {
    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, clienteId },
      include: {
        configHotel: {
          select: { horasLibresCancelacion: true, pctPenalidadCancelacion: true },
        },
      },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

    const ahora = new Date();
    const horasRestantes = Math.max(0, (reserva.fechaEntrada - ahora) / (1000 * 60 * 60));
    const totalPagado = Number(reserva.total);
    const horasLibres = reserva.configHotel?.horasLibresCancelacion ?? 48;
    const pctPenalidad = reserva.configHotel?.pctPenalidadCancelacion ?? 0;

    const dentroPlazoGratuito = horasRestantes >= horasLibres;
    let montoPenalidad = 0;
    let montoReembolso = totalPagado;

    if (!dentroPlazoGratuito && pctPenalidad > 0) {
      montoPenalidad = Math.round(totalPagado * pctPenalidad / 100);
      montoReembolso = totalPagado - montoPenalidad;
    }

    return {
      horasRestantes: Math.round(horasRestantes * 10) / 10,
      penalizacionPct: pctPenalidad,
      montoPenalidad,
      montoReembolso,
      dentro_plazo_gratuito: dentroPlazoGratuito,
    };
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
    const {
      activo, confirmacionAuto, horasLimiteConfirm, servicios, politicaCancelacion,
      checkInHora, checkOutHora,
      // Política de pagos
      permitePagarAlLlegar, permiteDeposito30, permiteTotal,
      // Política de cancelación con penalización
      horasLibresCancelacion, pctPenalidadCancelacion,
    } = datos;
    return prisma.configHotel.upsert({
      where:  { comercioId },
      update: {
        activo, confirmacionAuto, horasLimiteConfirm, servicios, politicaCancelacion,
        checkInHora, checkOutHora,
        permitePagarAlLlegar, permiteDeposito30, permiteTotal,
        horasLibresCancelacion, pctPenalidadCancelacion,
        updatedAt: new Date(),
      },
      create: {
        comercioId,
        activo:                  activo                  ?? false,
        confirmacionAuto:        confirmacionAuto        ?? false,
        horasLimiteConfirm:      horasLimiteConfirm      ?? 2,
        servicios:               servicios               ?? [],
        politicaCancelacion,
        checkInHora:             checkInHora             ?? "15:00",
        checkOutHora:            checkOutHora            ?? "12:00",
        permitePagarAlLlegar:    permitePagarAlLlegar    ?? true,
        permiteDeposito30:       permiteDeposito30       ?? true,
        permiteTotal:            permiteTotal            ?? true,
        horasLibresCancelacion:  horasLibresCancelacion  ?? 48,
        pctPenalidadCancelacion: pctPenalidadCancelacion ?? 0,
      },
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
  async agregarFotosHabitacion(comercioId, habitacionId, urls) {
    const hab = await prisma.habitacionTipo.findFirst({
      where: { id: habitacionId, configHotel: { comercioId } },
    });
    if (!hab) throw new ErrorNoEncontrado("Habitación no encontrada");
    return prisma.habitacionTipo.update({
      where: { id: habitacionId },
      data:  { fotos: [...hab.fotos, ...urls] },
    });
  },

  async subirVideoHabitacion(comercioId, habitacionId, videoUrl, posterUrl = null, duracion = null) {
    const hab = await prisma.habitacionTipo.findFirst({
      where: { id: habitacionId, configHotel: { comercioId } },
    });
    if (!hab) throw new ErrorNoEncontrado("Habitación no encontrada");
    return prisma.habitacionTipo.update({
      where: { id: habitacionId },
      data: {
        videoUrl,
        ...(posterUrl && { videoPosterUrl: posterUrl }),
        ...(duracion   && { videoDuracionSeg: Math.round(duracion) }),
      },
    });
  },

  async quitarVideoHabitacion(comercioId, habitacionId) {
    const hab = await prisma.habitacionTipo.findFirst({
      where: { id: habitacionId, configHotel: { comercioId } },
    });
    if (!hab) throw new ErrorNoEncontrado("Habitación no encontrada");
    return prisma.habitacionTipo.update({
      where: { id: habitacionId },
      data: { videoUrl: null, videoPosterUrl: null, videoDuracionSeg: null },
    });
  },

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

  // ── BLOQUEOS MANUALES ─────────────────────────────────────────

  async listarBloqueos(comercioId) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    const raw = await ConfigRepository.obtener(`HOTEL_BLOQUEOS_${cfg.id}`);
    return raw ? JSON.parse(raw) : [];
  },

  async crearBloqueo(comercioId, { habitacionId, fechaInicio, fechaFin, motivo }) {
    if (!fechaInicio || !fechaFin) throw new ErrorValidacion("Fechas requeridas");
    if (fechaFin <= fechaInicio) throw new ErrorValidacion("Fecha fin debe ser posterior");
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");
    const clave = `HOTEL_BLOQUEOS_${cfg.id}`;
    const raw = await ConfigRepository.obtener(clave);
    const bloqueos = raw ? JSON.parse(raw) : [];
    const nuevo = {
      id: Date.now().toString(36),
      habitacionId: habitacionId ?? null,
      fechaInicio,
      fechaFin,
      motivo: motivo || null,
    };
    bloqueos.push(nuevo);
    await ConfigRepository.guardar(clave, JSON.stringify(bloqueos));
    return nuevo;
  },

  async eliminarBloqueo(comercioId, bloqueoId) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");
    const clave = `HOTEL_BLOQUEOS_${cfg.id}`;
    const raw = await ConfigRepository.obtener(clave);
    const bloqueos = raw ? JSON.parse(raw) : [];
    const filtrados = bloqueos.filter(b => b.id !== bloqueoId);
    await ConfigRepository.guardar(clave, JSON.stringify(filtrados));
    return { ok: true };
  },

  // ── ADMIN ──────────────────────────────────────────────────────
  async adminListarHoteles() {
    const hoteles = await prisma.configHotel.findMany({
      include: {
        comercio: { select: { id: true, nombre: true, municipio: true, departamento: true, logoUrl: true } },
        habitaciones: { select: { id: true, nombre: true, cantidad: true, precioPorNoche: true } },
        _count: { select: { reservas: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
    return hoteles;
  },

  async adminCambiarEstado(configHotelId, activo) {
    return prisma.configHotel.update({
      where: { id: configHotelId },
      data:  { activo },
    });
  },

  async adminReservasHotel(configHotelId) {
    return prisma.reservaHotel.findMany({
      where: { configHotelId },
      include: {
        cliente: { select: { id: true, nombre: true, email: true } },
        habitacionTipo: { select: { nombre: true } },
      },
      orderBy: { creadoAt: "desc" },
      take: 100,
    });
  },

  // ── PAGO DIGITAL (WOMPI) ──────────────────────────────────────

  async iniciarPagoHotel(clienteId, reservaId) {
    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, clienteId },
      include: {
        habitacionTipo: { select: { nombre: true } },
        configHotel: {
          include: {
            comercio: {
              include: {
                usuario: { select: { email: true, nombre: true, telefono: true } },
              },
            },
          },
        },
      },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (["CANCELADA", "RECHAZADA"].includes(reserva.estado)) {
      throw new ErrorValidacion("No se puede pagar esta reserva");
    }

    // Porcentaje de depósito configurable (default 30%)
    const pctRaw = await ConfigRepository.obtener("HOTEL_DEPOSITO_PORCENT");
    const pct = Number(pctRaw) || 30;
    const montoDeposito = Math.round(Number(reserva.total) * pct / 100);
    if (montoDeposito < 1) throw new ErrorValidacion("El monto del depósito es muy bajo");

    const referencia = `HOTEL-${reserva.id}-${Date.now()}`;
    const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    const WompiProvider = require("./payments/providers/wompi.provider");
    const resultado = await WompiProvider.crearCheckout({
      pago: {
        monto: montoDeposito,
        moneda: "COP",
        providerReference: referencia,
        expiraAt: expira,
      },
      pedido: {
        id: reserva.id,
        comprador: {
          email: reserva.configHotel.comercio.usuario?.email,
          nombre: reserva.nombreHuesped,
          telefono: reserva.telefonoHuesped,
        },
      },
    });

    // Guardamos la referencia en Config para el webhook
    await ConfigRepository.guardar(
      `HOTEL_PAGO_${referencia}`,
      JSON.stringify({ reservaId: reserva.id, monto: montoDeposito, pct })
    );

    // Reemplazamos el redirect-url por la página de mis-reservas del hotel
    let checkoutUrl = resultado.checkoutUrl;
    try {
      const url = new URL(checkoutUrl);
      url.searchParams.set(
        "redirect-url",
        `${process.env.FRONTEND_URL || "https://afromercado.vercel.app"}/hoteles/mis-reservas?pago=ok&reserva=${reserva.id}`
      );
      checkoutUrl = url.toString();
    } catch { /* si la URL no es parseable, se devuelve la original */ }

    return { checkoutUrl, referencia, montoDeposito, pct };
  },

  async confirmarPagoHotel(referencia, estadoWompi) {
    const raw = await ConfigRepository.obtener(`HOTEL_PAGO_${referencia}`);
    if (!raw) return null; // no es una reserva de hotel

    const { reservaId, monto, pct } = JSON.parse(raw);
    const APROBADOS = ["APPROVED", "CONFIRMED", "PAID", "SUCCESSFUL"];
    const FALLIDOS  = ["DECLINED", "REJECTED", "FAILED", "ERROR", "CANCELLED", "EXPIRED"];

    if (APROBADOS.includes(String(estadoWompi).toUpperCase())) {
      const reserva = await prisma.reservaHotel.findUnique({
        where: { id: reservaId },
        include: {
          configHotel: {
            include: { comercio: { select: { usuarioId: true, nombre: true } } },
          },
          cliente: { select: { id: true, nombre: true } },
        },
      });
      if (!reserva || reserva.estado === "CONFIRMADA") return reserva;

      await prisma.reservaHotel.update({
        where: { id: reservaId },
        data: { estado: "CONFIRMADA", metodoPago: `WOMPI_${pct}PCT`, updatedAt: new Date() },
      });

      await notifHotel(
        reserva.cliente.id,
        "Pago recibido — Reserva confirmada",
        `Tu depósito del ${pct}% fue procesado. ¡Reserva confirmada!`,
        "/hoteles/mis-reservas"
      );
      await notifHotel(
        reserva.configHotel.comercio.usuarioId,
        "Pago de depósito recibido",
        `${reserva.nombreHuesped} pagó el depósito. Reserva confirmada.`,
        "/comerciante/hoteles"
      );

      await ConfigRepository.guardar(
        `HOTEL_PAGO_${referencia}`,
        JSON.stringify({ reservaId, monto, pct, confirmado: true })
      );
      return reserva;
    }

    if (FALLIDOS.includes(String(estadoWompi).toUpperCase())) {
      console.log(`[HOTEL-PAGO] Pago fallido para reserva ${reservaId}`);
    }

    return null;
  },
};

module.exports = HotelService;
