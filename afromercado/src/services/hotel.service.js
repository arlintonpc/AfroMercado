const crypto = require("crypto");
const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const ConfigRepository = require("../repositories/config.repository");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");
const { enviarEmail } = require("../utils/email");
const emailHotel = require("../utils/templates/email-hotel");
const { notificarReservaHotel, notificarClienteReserva } = require("../utils/notificaciones");

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
    include: {
      temporadas: {
        where: { activo: true },
        orderBy: { inicio: "asc" },
      },
    },
  },
};

const ESTADOS_HABITACION_FISICA = new Set(["LIBRE", "OCUPADA", "LIMPIEZA", "MANTENIMIENTO", "BLOQUEADA"]);
const ESTADOS_RESERVA_OCUPAN_HABITACION = ["PENDIENTE", "CONFIRMADA", "CHECKIN"];
const MODALIDADES_RESERVA_HOTEL = new Set(["NOCHE", "HORAS"]);

function normalizarModalidadReserva(modalidad) {
  const normalizada = String(modalidad || "NOCHE").trim().toUpperCase();
  if (!MODALIDADES_RESERVA_HOTEL.has(normalizada)) {
    throw new ErrorValidacion("Modalidad de reserva no valida");
  }
  return normalizada;
}

function normalizarEstadoHabitacionFisica(estado) {
  const normalizado = String(estado || "LIBRE").trim().toUpperCase();
  if (!ESTADOS_HABITACION_FISICA.has(normalizado)) {
    throw new ErrorValidacion("Estado de habitacion fisica no valido");
  }
  return normalizado;
}

function construirFechaHora(fecha, hora, nombreCampo) {
  if (!fecha) throw new ErrorValidacion(`${nombreCampo} es obligatorio`);
  const valor = String(fecha);
  const fechaFinal = valor.includes("T") ? valor : `${valor}T${hora || "00:00"}`;
  const parsed = new Date(fechaFinal);
  if (Number.isNaN(parsed.getTime())) throw new ErrorValidacion(`${nombreCampo} no es valido`);
  return parsed;
}

function prepararRangoReservaHotel(datos = {}) {
  const modalidad = normalizarModalidadReserva(datos.modalidad || "NOCHE");
  if (modalidad === "HORAS") {
    const entrada = construirFechaHora(datos.fechaEntrada, datos.horaEntrada, "Fecha/hora de entrada");
    const salida = construirFechaHora(datos.fechaSalida || datos.fechaEntrada, datos.horaSalida, "Fecha/hora de salida");
    if (salida <= entrada) throw new ErrorValidacion("La hora de salida debe ser posterior a la de entrada");
    const duracionHoras = Math.round(((salida.getTime() - entrada.getTime()) / 3600000) * 100) / 100;
    return { modalidad, entrada, salida, noches: 1, duracionHoras };
  }

  const entrada = new Date(datos.fechaEntrada);
  const salida = new Date(datos.fechaSalida);
  if (Number.isNaN(entrada.getTime()) || Number.isNaN(salida.getTime())) {
    throw new ErrorValidacion("Fechas invalidas");
  }
  if (salida <= entrada) throw new ErrorValidacion("La fecha de salida debe ser posterior a la de entrada");
  const noches = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000);
  return { modalidad, entrada, salida, noches, duracionHoras: null };
}

function rangoConBuffer(fechaEntrada, fechaSalida, minutosBuffer = 0) {
  const bufferMs = Math.max(0, Number(minutosBuffer) || 0) * 60 * 1000;
  return {
    inicio: new Date(fechaEntrada.getTime() - bufferMs),
    fin: new Date(fechaSalida.getTime() + bufferMs),
  };
}

async function verificarDisponibilidadInterna(db, habitacionTipoId, fechaEntrada, fechaSalida, { bloquearTipo = false, modalidad = "NOCHE" } = {}) {
  if (bloquearTipo) {
    await db.$queryRaw`SELECT id FROM "HabitacionTipo" WHERE id = ${Number(habitacionTipoId)} FOR UPDATE`;
  }

  const tipo = await db.habitacionTipo.findUnique({
    where: { id: Number(habitacionTipoId) },
    include: { configHotel: true },
  });
  if (!tipo || !tipo.activo) throw new ErrorNoEncontrado("Tipo de habitacion no disponible");
  const modalidadNormalizada = normalizarModalidadReserva(modalidad);
  if (modalidadNormalizada === "HORAS") {
    if (tipo.configHotel?.permiteReservasPorHora === false || tipo.permitePorHoras === false) {
      throw new ErrorValidacion("Esta habitacion no permite reservas por horas");
    }
    if (!tipo.precioPorHora || Number(tipo.precioPorHora) <= 0) {
      throw new ErrorValidacion("Esta habitacion aun no tiene precio por hora");
    }
  }

  const rangoConsulta = modalidadNormalizada === "HORAS"
    ? rangoConBuffer(fechaEntrada, fechaSalida, tipo.configHotel?.minutosLimpiezaEntreReservas ?? 30)
    : { inicio: fechaEntrada, fin: fechaSalida };

  const reservasSolapadas = await db.reservaHotel.count({
    where: {
      habitacionTipoId: Number(habitacionTipoId),
      estado: { in: ["PENDIENTE", "CONFIRMADA", "CHECKIN"] },
      fechaEntrada: { lt: rangoConsulta.fin },
      fechaSalida:  { gt: rangoConsulta.inicio },
    },
  });

  let bloqueado = false;
  const rawBloqueos = await ConfigRepository.obtener(`HOTEL_BLOQUEOS_${tipo.configHotelId}`);
  const bloqueos = rawBloqueos ? JSON.parse(rawBloqueos) : [];
  bloqueado = bloqueos.some(b =>
    (b.habitacionId === null || b.habitacionId === Number(habitacionTipoId)) &&
    b.fechaInicio < fechaSalida.toISOString().slice(0, 10) &&
    b.fechaFin > fechaEntrada.toISOString().slice(0, 10)
  );

  const habitacionesFisicas = await db.habitacionFisica.findMany({
    where: {
      configHotelId: tipo.configHotelId,
      habitacionTipoId: Number(habitacionTipoId),
      activo: true,
      estado: { notIn: ["MANTENIMIENTO", "BLOQUEADA"] },
    },
    select: { id: true },
  });

  if (habitacionesFisicas.length > 0) {
    const ids = habitacionesFisicas.map(h => h.id);
    const reservasAsignadas = await db.reservaHotel.findMany({
      where: {
        habitacionFisicaId: { in: ids },
        estado: { in: ESTADOS_RESERVA_OCUPAN_HABITACION },
        fechaEntrada: { lt: rangoConsulta.fin },
        fechaSalida:  { gt: rangoConsulta.inicio },
      },
      select: { habitacionFisicaId: true },
    });
    const ocupadas = new Set(reservasAsignadas.map(r => r.habitacionFisicaId).filter(Boolean));
    const reservasSinAsignar = await db.reservaHotel.count({
      where: {
        habitacionTipoId: Number(habitacionTipoId),
        habitacionFisicaId: null,
        estado: { in: ESTADOS_RESERVA_OCUPAN_HABITACION },
        fechaEntrada: { lt: rangoConsulta.fin },
        fechaSalida:  { gt: rangoConsulta.inicio },
      },
    });
    const disponiblesFisicos = habitacionesFisicas.length - ocupadas.size - reservasSinAsignar;
    return {
      disponibles: bloqueado ? 0 : Math.max(0, disponiblesFisicos),
      total: habitacionesFisicas.length,
      tipo,
      modalidad: modalidadNormalizada,
      fuente: "FISICA",
    };
  }

  const disponibles = bloqueado ? 0 : tipo.cantidad - reservasSolapadas;
  return { disponibles, total: tipo.cantidad, tipo, modalidad: modalidadNormalizada, fuente: "TIPO" };
}

async function validarHabitacionFisicaDisponible(db, {
  configHotelId,
  habitacionTipoId,
  habitacionFisicaId,
  fechaEntrada,
  fechaSalida,
  reservaId = null,
  modalidad = "NOCHE",
}) {
  const fisica = await db.habitacionFisica.findFirst({
    where: {
      id: Number(habitacionFisicaId),
      configHotelId: Number(configHotelId),
      habitacionTipoId: Number(habitacionTipoId),
      activo: true,
    },
  });
  if (!fisica) throw new ErrorNoEncontrado("Habitacion fisica no encontrada");
  if (["MANTENIMIENTO", "BLOQUEADA"].includes(fisica.estado)) {
    throw new ErrorValidacion(`La habitacion ${fisica.nombre} no esta disponible (${fisica.estado.toLowerCase()})`);
  }
  const modalidadNormalizada = normalizarModalidadReserva(modalidad);
  let rangoConsulta = { inicio: fechaEntrada, fin: fechaSalida };
  if (modalidadNormalizada === "HORAS") {
    const cfg = await db.configHotel.findUnique({
      where: { id: Number(configHotelId) },
      select: { minutosLimpiezaEntreReservas: true },
    });
    rangoConsulta = rangoConBuffer(fechaEntrada, fechaSalida, cfg?.minutosLimpiezaEntreReservas ?? 30);
  }

  const reservaSolapada = await db.reservaHotel.findFirst({
    where: {
      habitacionFisicaId: fisica.id,
      estado: { in: ESTADOS_RESERVA_OCUPAN_HABITACION },
      fechaEntrada: { lt: rangoConsulta.fin },
      fechaSalida:  { gt: rangoConsulta.inicio },
      ...(reservaId ? { NOT: { id: Number(reservaId) } } : {}),
    },
    select: { id: true, codigo: true },
  });
  if (reservaSolapada) {
    throw new ErrorValidacion(`La habitacion ${fisica.nombre} ya tiene una reserva en ese rango`);
  }
  return fisica;
}

async function buscarHabitacionFisicaDisponible(db, reserva) {
  const habitaciones = await db.habitacionFisica.findMany({
    where: {
      configHotelId: reserva.configHotelId,
      habitacionTipoId: reserva.habitacionTipoId,
      activo: true,
      estado: { notIn: ["MANTENIMIENTO", "BLOQUEADA"] },
    },
    orderBy: [{ piso: "asc" }, { nombre: "asc" }],
  });
  const modalidad = normalizarModalidadReserva(reserva.modalidad || "NOCHE");
  let rangoConsulta = { inicio: reserva.fechaEntrada, fin: reserva.fechaSalida };
  if (modalidad === "HORAS") {
    const cfg = await db.configHotel.findUnique({
      where: { id: Number(reserva.configHotelId) },
      select: { minutosLimpiezaEntreReservas: true },
    });
    rangoConsulta = rangoConBuffer(reserva.fechaEntrada, reserva.fechaSalida, cfg?.minutosLimpiezaEntreReservas ?? 30);
  }

  for (const fisica of habitaciones) {
    const solapada = await db.reservaHotel.findFirst({
      where: {
        habitacionFisicaId: fisica.id,
        estado: { in: ESTADOS_RESERVA_OCUPAN_HABITACION },
        fechaEntrada: { lt: rangoConsulta.fin },
        fechaSalida:  { gt: rangoConsulta.inicio },
        NOT: { id: reserva.id },
      },
      select: { id: true },
    });
    if (!solapada) return fisica;
  }
  return null;
}

async function validarCuponHotelInterno(db, codigo, configHotelId, noches, clienteId, totalOriginal, { bloquear = false } = {}) {
  const ahora = new Date();
  const codigoNormalizado = String(codigo || "").trim().toUpperCase();
  let cupon = await db.cuponHotel.findFirst({
    where: {
      codigo: codigoNormalizado,
      activo: true,
      inicio: { lte: ahora },
      fin:    { gte: ahora },
      OR: [
        { configHotelId: null },
        { configHotelId },
      ],
    },
  });

  if (!cupon) throw new ErrorValidacion("Cupon no valido o expirado");
  if (bloquear) {
    await db.$queryRaw`SELECT id FROM "CuponHotel" WHERE id = ${cupon.id} FOR UPDATE`;
    cupon = await db.cuponHotel.findUnique({ where: { id: cupon.id } });
    if (!cupon || !cupon.activo || cupon.inicio > ahora || cupon.fin < ahora) {
      throw new ErrorValidacion("Cupon no valido o expirado");
    }
  }

  if (cupon.minimoNoches && noches < cupon.minimoNoches) {
    throw new ErrorValidacion(`Este cupon requiere minimo ${cupon.minimoNoches} noche(s)`);
  }

  if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
    throw new ErrorValidacion("El cupon ha alcanzado el limite de usos");
  }

  if (clienteId) {
    const usoExistente = await db.cuponHotelUso.findFirst({
      where: { cuponHotelId: cupon.id, clienteId },
    });
    if (usoExistente) throw new ErrorValidacion("Ya usaste este cupon");
  }

  let descuento;
  if (cupon.tipo === "PORCENTAJE") {
    descuento = Math.round(totalOriginal * Number(cupon.valor) / 100 * 100) / 100;
  } else {
    descuento = Math.min(Number(cupon.valor), totalOriginal);
  }

  const totalConDescuento = totalOriginal - descuento;
  return { cupon, descuento, totalConDescuento };
}

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
  async verificarDisponibilidad(habitacionTipoId, fechaEntrada, fechaSalida, opciones = {}) {
    return verificarDisponibilidadInterna(prisma, habitacionTipoId, fechaEntrada, fechaSalida, opciones);
  },

  // ── CLIENTE ──────────────────────────────────────────────────

  async crearReserva(clienteId, datos) {
    const { habitacionTipoId, huespedes, metodoPago, notasCliente, nombreHuesped, telefonoHuesped, codigoCupon } = datos;
    const { modalidad, entrada, salida, noches, duracionHoras } = prepararRangoReservaHotel(datos);

    const limitePasado = modalidad === "HORAS" ? new Date() : new Date(new Date().toDateString());
    if (entrada < limitePasado) {
      throw new ErrorValidacion("La fecha de entrada no puede ser en el pasado");
    }

    const metodoPagoFinal = metodoPago || "EFECTIVO";
    const pagoOnline = String(metodoPagoFinal).startsWith("WOMPI");

    const resultado = await prisma.$transaction(async (tx) => {
      const { disponibles, tipo } = await verificarDisponibilidadInterna(tx, habitacionTipoId, entrada, salida, {
        bloquearTipo: true,
        modalidad,
      });
      if (disponibles <= 0) throw new ErrorValidacion("No hay disponibilidad para ese rango");
      if (!tipo.configHotel?.activo) throw new ErrorValidacion("Este hotel no esta activo para recibir reservas");

      if (modalidad === "HORAS") {
        if (!tipo.configHotel.permiteReservasPorHora || !tipo.permitePorHoras) {
          throw new ErrorValidacion("Esta habitacion no permite reservas por horas");
        }
        const minimoHoras = Number(tipo.duracionMinHoras) || 1;
        const maximoHoras = tipo.duracionMaxHoras ? Number(tipo.duracionMaxHoras) : null;
        if (duracionHoras < minimoHoras) {
          throw new ErrorValidacion(`La reserva por horas debe ser de minimo ${minimoHoras} hora(s)`);
        }
        if (maximoHoras && duracionHoras > maximoHoras) {
          throw new ErrorValidacion(`La reserva por horas no puede superar ${maximoHoras} hora(s)`);
        }
      }

      if (metodoPagoFinal === "EFECTIVO" && tipo.configHotel.permitePagarAlLlegar === false) {
        throw new ErrorValidacion("Este hotel no acepta pago al llegar");
      }
      if (pagoOnline && tipo.configHotel.permiteDeposito30 === false) {
        throw new ErrorValidacion("Este hotel no acepta deposito online por ahora");
      }

      let totalOriginal = 0;
      if (modalidad === "HORAS") {
        totalOriginal = Math.round(Number(tipo.precioPorHora) * Number(duracionHoras) * 100) / 100;
      } else {
        const temporadaHab = await tx.temporadaHotel.findFirst({
          where: {
            activo: true,
            habitacionTipoId: Number(habitacionTipoId),
            inicio: { lte: salida },
            fin:   { gte: entrada },
          },
        });
        const temporadaHotel = !temporadaHab ? await tx.temporadaHotel.findFirst({
          where: {
            activo: true,
            habitacionTipoId: null,
            configHotelId: tipo.configHotelId,
            inicio: { lte: salida },
            fin:   { gte: entrada },
          },
        }) : null;
        const temporada = temporadaHab || temporadaHotel;
        const precioPorNoche = temporada ? Number(temporada.precioPorNoche) : Number(tipo.precioPorNoche);
        totalOriginal = precioPorNoche * noches;
      }

      let montoDescuento = 0;
      let cuponValidado = null;
      if (codigoCupon) {
        const cuponResultado = await validarCuponHotelInterno(
          tx,
          codigoCupon,
          tipo.configHotelId,
          modalidad === "HORAS" ? 1 : noches,
          clienteId,
          totalOriginal,
          { bloquear: true }
        );
        montoDescuento = cuponResultado.descuento;
        cuponValidado = cuponResultado.cupon;
      }

      const totalFinal = totalOriginal - montoDescuento;
      const tasaComision = 0.1;
      const comision = Math.round(totalFinal * tasaComision * 100) / 100;
      const estadoInicial = pagoOnline ? "PENDIENTE" : (tipo.configHotel.confirmacionAuto ? "CONFIRMADA" : "PENDIENTE");

      const reserva = await tx.reservaHotel.create({
        data: {
          codigo: generarCodigo(),
          configHotelId: tipo.configHotelId,
          habitacionTipoId: Number(habitacionTipoId),
          clienteId,
          fechaEntrada: entrada,
          fechaSalida:  salida,
          modalidad,
          duracionHoras: modalidad === "HORAS" ? duracionHoras : null,
          huespedes:    Number(huespedes) || 1,
          total:        totalFinal,
          estado:       estadoInicial,
          metodoPago:   metodoPagoFinal,
          notasCliente: notasCliente || null,
          nombreHuesped,
          telefonoHuesped,
          montoDescuento: montoDescuento || null,
          codigoCupon:    codigoCupon || null,
          comision,
          tasaComision,
        },
        include: {
          habitacionTipo: true,
          configHotel: { include: { comercio: { include: { usuario: { select: { email: true, nombre: true } } } } } },
        },
      });

      if (cuponValidado) {
        await tx.cuponHotelUso.create({
          data: {
            cuponHotelId:   cuponValidado.id,
            clienteId,
            reservaHotelId: reserva.id,
          },
        });
        await tx.cuponHotel.update({
          where: { id: cuponValidado.id },
          data:  { usosActuales: { increment: 1 } },
        });
      }

      return { reserva, tipo, totalFinal, estadoInicial };
    });

    const { reserva, tipo, totalFinal, estadoInicial } = resultado;
    const resumenTiempo = modalidad === "HORAS" ? `${duracionHoras} hora(s)` : `${noches} noche(s)`;

    // Notificar al hotelero
    const hoteleroId = reserva.configHotel.comercio.usuarioId;
    await notifHotel(
      hoteleroId,
      estadoInicial === "CONFIRMADA" ? "Nueva reserva confirmada" : "Nueva solicitud de reserva",
      `${nombreHuesped} - ${tipo.nombre} - ${resumenTiempo}`,
      "/comerciante/hoteles"
    );

    // Email al hotelero (fire and forget)
    const emailHotelero = reserva.configHotel.comercio.usuario?.email;
    if (emailHotelero) {
      setImmediate(() => {
        enviarEmail({
          to: emailHotelero,
          subject: `Nueva reserva - ${nombreHuesped} - ${tipo.nombre} - AfroMercado`,
          html: emailHotel.reservaNueva({
            nombreHotelero: reserva.configHotel.comercio.usuario.nombre || "Hotelero",
            nombreHuesped,
            habitacion: tipo.nombre,
            fechaEntrada: entrada,
            fechaSalida:  salida,
            noches,
            total: totalFinal,
          }),
        }).catch((err) => console.error("[EMAIL-HOTEL]", err.message));
      });
    }

    setImmediate(() => {
      notificarReservaHotel({
        hotelWhatsapp: reserva.configHotel.comercio.whatsapp,
        reserva,
        habitacion: tipo,
        comercioNombre: reserva.configHotel.comercio.nombre,
      }).catch(() => {});
    });

    setImmediate(() => {
      notificarClienteReserva({
        telefonoCliente: telefonoHuesped,
        reserva,
        habitacion: tipo,
        comercioNombre: reserva.configHotel.comercio.nombre,
      }).catch(() => {});
    });

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
      include: {
        habitaciones: {
          orderBy: { creadoAt: "asc" },
          include: { unidadesFisicas: { where: { activo: true }, orderBy: [{ piso: "asc" }, { nombre: "asc" }] } },
        },
        habitacionesFisicas: {
          where: { activo: true },
          include: { habitacionTipo: { select: { id: true, nombre: true } } },
          orderBy: [{ piso: "asc" }, { nombre: "asc" }],
        },
      },
    });
    if (!cfg) {
      cfg = await prisma.configHotel.create({
        data: { comercioId },
        include: { habitaciones: true, habitacionesFisicas: true },
      });
    }
    return cfg;
  },

  async actualizarConfig(comercioId, datos) {
    const {
      activo, confirmacionAuto, horasLimiteConfirm, servicios, politicaCancelacion,
      checkInHora, checkOutHora,
      permiteReservasPorHora, minutosLimpiezaEntreReservas,
      // Política de pagos
      permitePagarAlLlegar, permiteDeposito30, permiteTotal,
      // Política de cancelación con penalización
      horasLibresCancelacion, pctPenalidadCancelacion,
      // RNT (solo el hotelero puede actualizar su número, no el estado de verificación)
      rnt,
    } = datos;
    return prisma.configHotel.upsert({
      where:  { comercioId },
      update: {
        activo, confirmacionAuto, horasLimiteConfirm, servicios, politicaCancelacion,
        checkInHora, checkOutHora,
        permiteReservasPorHora,
        minutosLimpiezaEntreReservas: minutosLimpiezaEntreReservas !== undefined ? Number(minutosLimpiezaEntreReservas) : undefined,
        permitePagarAlLlegar, permiteDeposito30, permiteTotal,
        horasLibresCancelacion, pctPenalidadCancelacion,
        rnt,
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
        permiteReservasPorHora:  permiteReservasPorHora  ?? false,
        minutosLimpiezaEntreReservas: minutosLimpiezaEntreReservas !== undefined ? Number(minutosLimpiezaEntreReservas) : 30,
        permitePagarAlLlegar:    permitePagarAlLlegar    ?? true,
        permiteDeposito30:       permiteDeposito30       ?? true,
        permiteTotal:            permiteTotal            ?? true,
        horasLibresCancelacion:  horasLibresCancelacion  ?? 48,
        pctPenalidadCancelacion: pctPenalidadCancelacion ?? 0,
        rnt:                     rnt                     ?? null,
      },
      include: {
        habitaciones: {
          include: { unidadesFisicas: { where: { activo: true }, orderBy: [{ piso: "asc" }, { nombre: "asc" }] } },
        },
        habitacionesFisicas: {
          where: { activo: true },
          include: { habitacionTipo: { select: { id: true, nombre: true } } },
          orderBy: [{ piso: "asc" }, { nombre: "asc" }],
        },
      },
    });
  },

  async agregarHabitacion(comercioId, datos) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configura el hotel primero");
    const {
      nombre, descripcion, capacidad, precioPorNoche, cantidad, fotos, serviciosExtra,
      precioPorHora, permitePorHoras, duracionMinHoras, duracionMaxHoras,
    } = datos;
    if (!nombre || !precioPorNoche) throw new ErrorValidacion("Nombre y precio son obligatorios");
    if (permitePorHoras && (!precioPorHora || Number(precioPorHora) <= 0)) {
      throw new ErrorValidacion("Define un precio por hora valido para activar reservas por horas");
    }
    return prisma.habitacionTipo.create({
      data: {
        configHotelId: cfg.id,
        nombre,
        descripcion: descripcion || null,
        capacidad:   Number(capacidad) || 2,
        precioPorNoche: Number(precioPorNoche),
        precioPorHora: precioPorHora ? Number(precioPorHora) : null,
        permitePorHoras: !!permitePorHoras,
        duracionMinHoras: Number(duracionMinHoras) || 2,
        duracionMaxHoras: duracionMaxHoras ? Number(duracionMaxHoras) : null,
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
    const {
      nombre, descripcion, capacidad, precioPorNoche, cantidad, fotos, serviciosExtra, activo,
      precioPorHora, permitePorHoras, duracionMinHoras, duracionMaxHoras,
    } = datos;
    const permitePorHorasFinal = permitePorHoras !== undefined ? !!permitePorHoras : hab.permitePorHoras;
    const precioPorHoraFinal = precioPorHora !== undefined ? Number(precioPorHora) : Number(hab.precioPorHora || 0);
    if (permitePorHorasFinal && (!precioPorHoraFinal || precioPorHoraFinal <= 0)) {
      throw new ErrorValidacion("Define un precio por hora valido para activar reservas por horas");
    }
    const data = {
      nombre,
      descripcion,
      capacidad: capacidad !== undefined ? Number(capacidad) : undefined,
      precioPorNoche: precioPorNoche !== undefined ? Number(precioPorNoche) : undefined,
      precioPorHora: precioPorHora !== undefined ? (precioPorHora ? Number(precioPorHora) : null) : undefined,
      permitePorHoras: permitePorHoras !== undefined ? !!permitePorHoras : undefined,
      duracionMinHoras: duracionMinHoras !== undefined ? (Number(duracionMinHoras) || 2) : undefined,
      duracionMaxHoras: duracionMaxHoras !== undefined ? (duracionMaxHoras ? Number(duracionMaxHoras) : null) : undefined,
      cantidad: cantidad !== undefined ? Number(cantidad) : undefined,
      fotos,
      serviciosExtra,
      activo,
    };
    return prisma.habitacionTipo.update({
      where: { id: habitacionId },
      data,
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

  async habitacionesFisicas(comercioId) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    return prisma.habitacionFisica.findMany({
      where: { configHotelId: cfg.id, activo: true },
      include: { habitacionTipo: { select: { id: true, nombre: true, capacidad: true } } },
      orderBy: [{ piso: "asc" }, { zona: "asc" }, { nombre: "asc" }],
    });
  },

  async crearHabitacionFisica(comercioId, datos) {
    const { habitacionTipoId, nombre, piso, zona, estado, notas } = datos;
    if (!habitacionTipoId || !nombre) {
      throw new ErrorValidacion("Tipo de habitacion y nombre/numero son obligatorios");
    }
    const tipo = await prisma.habitacionTipo.findFirst({
      where: { id: Number(habitacionTipoId), configHotel: { comercioId }, activo: true },
      include: { configHotel: true },
    });
    if (!tipo) throw new ErrorNoEncontrado("Tipo de habitacion no encontrado");

    try {
      return await prisma.habitacionFisica.create({
        data: {
          configHotelId: tipo.configHotelId,
          habitacionTipoId: tipo.id,
          nombre: String(nombre).trim(),
          piso: piso ? String(piso).trim() : null,
          zona: zona ? String(zona).trim() : null,
          estado: normalizarEstadoHabitacionFisica(estado || "LIBRE"),
          notas: notas || null,
        },
        include: { habitacionTipo: { select: { id: true, nombre: true, capacidad: true } } },
      });
    } catch (e) {
      if (e.code === "P2002") throw new ErrorValidacion("Ya existe una habitacion fisica con ese nombre para este tipo");
      throw e;
    }
  },

  async actualizarHabitacionFisica(comercioId, habitacionFisicaId, datos) {
    const actual = await prisma.habitacionFisica.findFirst({
      where: { id: Number(habitacionFisicaId), configHotel: { comercioId } },
    });
    if (!actual) throw new ErrorNoEncontrado("Habitacion fisica no encontrada");

    let habitacionTipoId = actual.habitacionTipoId;
    if (datos.habitacionTipoId && Number(datos.habitacionTipoId) !== actual.habitacionTipoId) {
      const tipo = await prisma.habitacionTipo.findFirst({
        where: { id: Number(datos.habitacionTipoId), configHotel: { comercioId }, activo: true },
      });
      if (!tipo) throw new ErrorNoEncontrado("Tipo de habitacion no encontrado");
      habitacionTipoId = tipo.id;
    }

    try {
      return await prisma.habitacionFisica.update({
        where: { id: actual.id },
        data: {
          habitacionTipoId,
          nombre: datos.nombre !== undefined ? String(datos.nombre).trim() : undefined,
          piso: datos.piso !== undefined ? (datos.piso ? String(datos.piso).trim() : null) : undefined,
          zona: datos.zona !== undefined ? (datos.zona ? String(datos.zona).trim() : null) : undefined,
          estado: datos.estado !== undefined ? normalizarEstadoHabitacionFisica(datos.estado) : undefined,
          notas: datos.notas !== undefined ? (datos.notas || null) : undefined,
          activo: datos.activo !== undefined ? !!datos.activo : undefined,
          updatedAt: new Date(),
        },
        include: { habitacionTipo: { select: { id: true, nombre: true, capacidad: true } } },
      });
    } catch (e) {
      if (e.code === "P2002") throw new ErrorValidacion("Ya existe una habitacion fisica con ese nombre para este tipo");
      throw e;
    }
  },

  async cambiarEstadoHabitacionFisica(comercioId, habitacionFisicaId, estado) {
    return this.actualizarHabitacionFisica(comercioId, habitacionFisicaId, { estado });
  },

  async eliminarHabitacionFisica(comercioId, habitacionFisicaId) {
    return this.actualizarHabitacionFisica(comercioId, habitacionFisicaId, { activo: false });
  },

  async asignarHabitacionFisicaReserva(comercioId, reservaId, habitacionFisicaId) {
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");

    return prisma.$transaction(async (tx) => {
      const reserva = await tx.reservaHotel.findFirst({
        where: { id: Number(reservaId), configHotelId: cfg.id },
      });
      if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
      if (["CANCELADA", "RECHAZADA", "CHECKOUT"].includes(reserva.estado)) {
        throw new ErrorValidacion("No se puede asignar habitacion a una reserva cerrada");
      }
      const fisica = await validarHabitacionFisicaDisponible(tx, {
        configHotelId: reserva.configHotelId,
        habitacionTipoId: reserva.habitacionTipoId,
        habitacionFisicaId,
        fechaEntrada: reserva.fechaEntrada,
        fechaSalida: reserva.fechaSalida,
        reservaId: reserva.id,
        modalidad: reserva.modalidad || "NOCHE",
      });
      const actualizada = await tx.reservaHotel.update({
        where: { id: reserva.id },
        data: { habitacionFisicaId: fisica.id, updatedAt: new Date() },
        include: {
          habitacionTipo: { select: { nombre: true } },
          habitacionFisica: { select: { id: true, nombre: true, piso: true, zona: true, estado: true } },
          cliente: { select: { nombre: true, email: true, telefono: true } },
        },
      });
      if (reserva.estado === "CHECKIN") {
        await tx.habitacionFisica.update({ where: { id: fisica.id }, data: { estado: "OCUPADA" } });
        if (reserva.habitacionFisicaId && reserva.habitacionFisicaId !== fisica.id) {
          await tx.habitacionFisica.update({
            where: { id: reserva.habitacionFisicaId },
            data: { estado: "LIMPIEZA", updatedAt: new Date() },
          });
        }
      } else if (reserva.habitacionFisicaId && reserva.habitacionFisicaId !== fisica.id) {
        const activaAnterior = await tx.reservaHotel.findFirst({
          where: {
            habitacionFisicaId: reserva.habitacionFisicaId,
            estado: { in: ["CONFIRMADA", "CHECKIN"] },
            NOT: { id: reserva.id },
          },
          select: { id: true },
        });
        if (!activaAnterior) {
          await tx.habitacionFisica.update({
            where: { id: reserva.habitacionFisicaId },
            data: { estado: "LIBRE", updatedAt: new Date() },
          });
        }
      }
      return actualizada;
    });
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
        habitacionFisica: { select: { id: true, nombre: true, piso: true, zona: true, estado: true } },
        cliente: { select: { nombre: true, email: true, telefono: true } },
      },
      orderBy: { creadoAt: "desc" },
      take: 50,
      skip: (page - 1) * 50,
    });
  },

  async cambiarEstadoReserva(comercioId, reservaId, nuevoEstado, opciones = {}) {
    const TRANSICIONES = {
      PENDIENTE:  ["CONFIRMADA", "RECHAZADA"],
      CONFIRMADA: ["CHECKIN", "CANCELADA"],
      CHECKIN:    ["CHECKOUT"],
    };
    const cfg = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");

    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, configHotelId: cfg.id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        habitacionTipo: { select: { nombre: true } },
        habitacionFisica: { select: { id: true, nombre: true, estado: true } },
      },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

    const permitidos = TRANSICIONES[reserva.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ErrorValidacion(`No se puede pasar de ${reserva.estado} a ${nuevoEstado}`);
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      let habitacionFisicaId = reserva.habitacionFisicaId || null;

      if (nuevoEstado === "CHECKIN") {
        if (opciones.habitacionFisicaId) {
          const fisica = await validarHabitacionFisicaDisponible(tx, {
            configHotelId: reserva.configHotelId,
            habitacionTipoId: reserva.habitacionTipoId,
            habitacionFisicaId: opciones.habitacionFisicaId,
            fechaEntrada: reserva.fechaEntrada,
            fechaSalida: reserva.fechaSalida,
            reservaId: reserva.id,
            modalidad: reserva.modalidad || "NOCHE",
          });
          habitacionFisicaId = fisica.id;
        } else if (!habitacionFisicaId) {
          const fisica = await buscarHabitacionFisicaDisponible(tx, reserva);
          if (fisica) habitacionFisicaId = fisica.id;
        }

        if (habitacionFisicaId) {
          await tx.habitacionFisica.update({
            where: { id: habitacionFisicaId },
            data: { estado: "OCUPADA", updatedAt: new Date() },
          });
        }
      }

      const data = { estado: nuevoEstado, updatedAt: new Date() };
      if (habitacionFisicaId) data.habitacionFisicaId = habitacionFisicaId;

      const updated = await tx.reservaHotel.update({
        where: { id: reservaId },
        data,
        include: {
          habitacionTipo: { select: { nombre: true } },
          habitacionFisica: { select: { id: true, nombre: true, piso: true, zona: true, estado: true } },
          cliente: { select: { nombre: true, email: true, telefono: true } },
        },
      });

      if (nuevoEstado === "CHECKOUT" && reserva.habitacionFisicaId) {
        await tx.habitacionFisica.update({
          where: { id: reserva.habitacionFisicaId },
          data: { estado: "LIMPIEZA", updatedAt: new Date() },
        });
      }

      if (["CANCELADA", "RECHAZADA"].includes(nuevoEstado) && reserva.habitacionFisicaId) {
        const activa = await tx.reservaHotel.findFirst({
          where: {
            habitacionFisicaId: reserva.habitacionFisicaId,
            estado: { in: ["CONFIRMADA", "CHECKIN"] },
            NOT: { id: reserva.id },
          },
          select: { id: true },
        });
        if (!activa) {
          await tx.habitacionFisica.update({
            where: { id: reserva.habitacionFisicaId },
            data: { estado: "LIBRE", updatedAt: new Date() },
          });
        }
      }

      return updated;
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

  async guardarVideoLinkHabitacion(comercioId, habitacionId, videoUrl) {
    const hab = await prisma.habitacionTipo.findFirst({
      where: { id: habitacionId, configHotel: { comercioId } },
    });
    if (!hab) throw new ErrorNoEncontrado("Habitación no encontrada");
    return prisma.habitacionTipo.update({
      where: { id: habitacionId },
      data: { videoUrl, videoPosterUrl: null, videoDuracionSeg: null },
    });
  },

  async ocupacion(comercioId) {
    const cfg = await prisma.configHotel.findUnique({
      where: { comercioId },
      include: {
        habitaciones: { where: { activo: true } },
        habitacionesFisicas: {
          where: { activo: true },
          include: { habitacionTipo: { select: { id: true, nombre: true, capacidad: true } } },
          orderBy: [{ piso: "asc" }, { zona: "asc" }, { nombre: "asc" }],
        },
      },
    });
    if (!cfg) throw new ErrorNoEncontrado("Hotel no encontrado");

    const reservasActivas = await prisma.reservaHotel.findMany({
      where: {
        configHotelId: cfg.id,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "CHECKIN"] },
      },
      include: {
        habitacionTipo: { select: { nombre: true } },
        habitacionFisica: { select: { id: true, nombre: true, piso: true, zona: true, estado: true } },
        cliente: { select: { nombre: true } },
      },
      orderBy: { fechaEntrada: "asc" },
    });

    return { habitaciones: cfg.habitaciones, habitacionesFisicas: cfg.habitacionesFisicas, reservas: reservasActivas };
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
    if (!String(reserva.metodoPago || "").startsWith("WOMPI")) {
      throw new ErrorValidacion("Esta reserva no requiere pago online");
    }
    if (reserva.configHotel.permiteDeposito30 === false) {
      throw new ErrorValidacion("Este hotel no acepta deposito online por ahora");
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

  // ── CUPONES DE HOTEL ──────────────────────────────────────────

  async validarCuponHotel(codigo, configHotelId, noches, clienteId, totalOriginal) {
    return validarCuponHotelInterno(prisma, codigo, configHotelId, noches, clienteId, totalOriginal);
  },

  async crearCuponHotel(comercioId, datos) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel || !hotel.activo) throw new ErrorValidacion("No tienes un hotel activo");

    const { codigo, tipo = "PORCENTAJE", valor, minimoNoches, usosMaximos, inicio, fin } = datos;
    if (!codigo || !valor || !inicio || !fin) throw new ErrorValidacion("Faltan campos requeridos: codigo, valor, inicio, fin");

    return prisma.cuponHotel.create({
      data: {
        codigo:       codigo.trim().toUpperCase(),
        tipo,
        valor:        Number(valor),
        minimoNoches: minimoNoches ? Number(minimoNoches) : null,
        usosMaximos:  usosMaximos  ? Number(usosMaximos)  : null,
        inicio:       new Date(inicio),
        fin:          new Date(fin),
        configHotelId: hotel.id,
      },
    });
  },

  async listarCuponesHotel(comercioId) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");

    return prisma.cuponHotel.findMany({
      where:   { configHotelId: hotel.id },
      orderBy: { createdAt: "desc" },
    });
  },

  async eliminarCuponHotel(comercioId, cuponId) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");

    const cupon = await prisma.cuponHotel.findFirst({
      where: { id: cuponId, configHotelId: hotel.id },
    });
    if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado");

    return prisma.cuponHotel.update({
      where: { id: cuponId },
      data:  { activo: false },
    });
  },

  // ── TEMPORADAS ────────────────────────────────────────────────

  async crearTemporada(comercioId, datos) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");
    const { nombre, inicio, fin, precioPorNoche, habitacionTipoId } = datos;
    if (!nombre || !inicio || !fin || !precioPorNoche) throw new ErrorValidacion("Faltan campos requeridos");
    if (new Date(fin) <= new Date(inicio)) throw new ErrorValidacion("La fecha de fin debe ser posterior al inicio");
    if (habitacionTipoId) {
      const hab = await prisma.habitacionTipo.findFirst({ where: { id: Number(habitacionTipoId), configHotelId: hotel.id } });
      if (!hab) throw new ErrorValidacion("Habitación no pertenece a este hotel");
    }
    return prisma.temporadaHotel.create({
      data: {
        configHotelId: hotel.id,
        habitacionTipoId: habitacionTipoId ? Number(habitacionTipoId) : null,
        nombre,
        inicio: new Date(inicio),
        fin: new Date(fin),
        precioPorNoche: Number(precioPorNoche),
      },
    });
  },

  async listarTemporadas(comercioId) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");
    return prisma.temporadaHotel.findMany({
      where: { configHotelId: hotel.id },
      include: { habitacionTipo: { select: { nombre: true } } },
      orderBy: { inicio: "asc" },
    });
  },

  async eliminarTemporada(comercioId, temporadaId) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");
    const t = await prisma.temporadaHotel.findFirst({ where: { id: temporadaId, configHotelId: hotel.id } });
    if (!t) throw new ErrorNoEncontrado("Temporada no encontrada");
    await prisma.temporadaHotel.update({ where: { id: temporadaId }, data: { activo: false } });
  },

  // ── FAVORITOS ─────────────────────────────────────────────────

  async toggleFavorito(usuarioId, configHotelId) {
    const existe = await prisma.favoritoHotel.findUnique({
      where: { usuarioId_configHotelId: { usuarioId, configHotelId } },
    });
    if (existe) {
      await prisma.favoritoHotel.delete({ where: { id: existe.id } });
      return { favorito: false };
    } else {
      await prisma.favoritoHotel.create({ data: { usuarioId, configHotelId } });
      return { favorito: true };
    }
  },

  async misFavoritosHotel(usuarioId) {
    const favs = await prisma.favoritoHotel.findMany({
      where: { usuarioId },
      include: { configHotel: { include: HOTEL_INCLUDE } },
      orderBy: { createdAt: "desc" },
    });
    return favs.map(f => f.configHotel);
  },

  async esFavoritoHotel(usuarioId, configHotelId) {
    const existe = await prisma.favoritoHotel.findUnique({
      where: { usuarioId_configHotelId: { usuarioId, configHotelId } },
    });
    return { favorito: !!existe };
  },

  // ── ESTADÍSTICAS DEL HOTELERO ─────────────────────────────────

  async estadisticasHotelero(comercioId) {
    const hotel = await prisma.configHotel.findUnique({ where: { comercioId } });
    if (!hotel) throw new ErrorNoEncontrado("Hotel no encontrado");

    const ahora     = new Date();
    const hace6m    = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes    = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

    // Reservas de los últimos 6 meses
    const reservas = await prisma.reservaHotel.findMany({
      where: {
        configHotelId: hotel.id,
        creadoAt: { gte: hace6m },
        estado: { notIn: ["CANCELADA", "RECHAZADA"] },
      },
      select: {
        id: true, total: true, estado: true, creadoAt: true,
        fechaEntrada: true, fechaSalida: true, habitacionTipoId: true,
        montoDescuento: true, comision: true,
      },
    });

    // Agrupar ingresos por mes (últimos 6 meses)
    const ingresosPorMes = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      ingresosPorMes[key] = 0;
    }
    for (const r of reservas) {
      const d = new Date(r.creadoAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in ingresosPorMes) {
        ingresosPorMes[key] += Number(r.total) - Number(r.montoDescuento || 0);
      }
    }

    // Reservas activas este mes
    const reservasMesActual = await prisma.reservaHotel.count({
      where: {
        configHotelId: hotel.id,
        creadoAt: { gte: inicioMes, lte: finMes },
        estado: { notIn: ["CANCELADA", "RECHAZADA"] },
      },
    });

    // Tasa de ocupación por habitación (días ocupados / días en el mes)
    const habitaciones = await prisma.habitacionTipo.findMany({
      where: { configHotelId: hotel.id, activo: true },
      select: { id: true, nombre: true, cantidad: true },
    });

    const diasEnMes = finMes.getDate();
    const ocupacionPorHab = await Promise.all(habitaciones.map(async (h) => {
      const reservasHab = await prisma.reservaHotel.findMany({
        where: {
          habitacionTipoId: h.id,
          estado: { notIn: ["CANCELADA", "RECHAZADA"] },
          fechaEntrada: { lt: finMes },
          fechaSalida:  { gt: inicioMes },
        },
        select: { fechaEntrada: true, fechaSalida: true },
      });
      let diasOcupados = 0;
      for (const r of reservasHab) {
        const entrada = new Date(Math.max(new Date(r.fechaEntrada).getTime(), inicioMes.getTime()));
        const salida  = new Date(Math.min(new Date(r.fechaSalida).getTime(),  finMes.getTime()));
        const dias = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000);
        if (dias > 0) diasOcupados += dias;
      }
      const tasaOcupacion = Math.min(100, Math.round((diasOcupados / (diasEnMes * h.cantidad)) * 100));
      return { id: h.id, nombre: h.nombre, tasaOcupacion, diasOcupados };
    }));

    // Totales
    const ingresoTotal6m = Object.values(ingresosPorMes).reduce((a, b) => a + b, 0);
    const totalReservas  = reservas.length;
    const cancelaciones  = await prisma.reservaHotel.count({
      where: { configHotelId: hotel.id, estado: "CANCELADA", creadoAt: { gte: hace6m } },
    });

    return {
      ingresosPorMes: Object.entries(ingresosPorMes).map(([mes, ingreso]) => ({ mes, ingreso })),
      ingresoTotal6m,
      reservasMesActual,
      totalReservas6m: totalReservas,
      cancelaciones6m: cancelaciones,
      ocupacionPorHab,
      tasaOcupacionPromedio: ocupacionPorHab.length
        ? Math.round(ocupacionPorHab.reduce((a, b) => a + b.tasaOcupacion, 0) / ocupacionPorHab.length)
        : 0,
    };
  },

  // ── CHECK-IN ONLINE ───────────────────────────────────────────

  async generarTokenCheckin(reservaId, clienteId) {
    const reserva = await prisma.reservaHotel.findFirst({
      where: { id: reservaId, clienteId },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (["CANCELADA", "CHECKOUT"].includes(reserva.estado)) {
      throw new ErrorValidacion("No se puede generar token para una reserva en estado " + reserva.estado);
    }
    // Idempotente: si ya tiene token, retornarlo
    if (reserva.tokenCheckin) {
      return { token: reserva.tokenCheckin, reserva };
    }
    const token = crypto.randomBytes(16).toString("hex");
    const actualizada = await prisma.reservaHotel.update({
      where: { id: reservaId },
      data: { tokenCheckin: token },
    });
    return { token, reserva: actualizada };
  },

  async obtenerReservaPorToken(token) {
    const reserva = await prisma.reservaHotel.findUnique({
      where: { tokenCheckin: token },
      include: {
        habitacionTipo: true,
        configHotel: { include: { comercio: true } },
      },
    });
    if (!reserva) throw new ErrorNoEncontrado("Token de check-in no válido");
    return reserva;
  },

  async realizarCheckinOnline(token, datos) {
    const reserva = await prisma.reservaHotel.findUnique({
      where: { tokenCheckin: token },
      include: {
        configHotel: { include: { comercio: { select: { usuarioId: true } } } },
      },
    });
    if (!reserva) throw new ErrorNoEncontrado("Token de check-in no válido");
    if (["CANCELADA", "CHECKOUT"].includes(reserva.estado)) {
      throw new ErrorValidacion("No se puede hacer check-in en una reserva en estado " + reserva.estado);
    }
    if (!datos.docTipo || !datos.docNumero) {
      throw new ErrorValidacion("El tipo y número de documento son obligatorios");
    }
    // Idempotente: si ya hizo check-in, retornar sin modificar
    if (reserva.checkinOnlineAt) {
      return reserva;
    }
    const actualizada = await prisma.reservaHotel.update({
      where: { tokenCheckin: token },
      data: {
        checkinOnlineAt:       new Date(),
        docTipo:               datos.docTipo,
        docNumero:             datos.docNumero,
        horaEstimadaLlegada:   datos.horaEstimadaLlegada   || null,
        solicitudesEspeciales: datos.solicitudesEspeciales || null,
      },
      include: {
        habitacionTipo: true,
        configHotel: { include: { comercio: true } },
      },
    });
    // Notificar al hotelero
    const hoteleroId = reserva.configHotel.comercio.usuarioId;
    await notifHotel(
      hoteleroId,
      "Check-in online recibido",
      `${actualizada.nombreHuesped} completó el check-in online · ${actualizada.docTipo} ${actualizada.docNumero}`,
      "/comerciante/hoteles"
    );
    return actualizada;
  },
};

module.exports = HotelService;
