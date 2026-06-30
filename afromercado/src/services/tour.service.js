const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");
const { notificarWhatsApp } = require("../utils/notificaciones");

const TASA_COMISION_TOUR = 0.10;

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

  async crearReserva(clienteId, { configTourId, fechaTour, participantes, metodoPago, notasCliente, nombreContacto, telefonoContacto, codigoCupon }) {
    const tour = await prisma.configTour.findUnique({ where: { id: configTourId }, include: TOUR_INCLUDE });
    if (!tour || !tour.activo) throw new ErrorValidacion("Tour no disponible");

    const disp = await TourService.verificarDisponibilidad(configTourId, fechaTour);
    if (disp.disponibles < participantes) throw new ErrorValidacion("No hay suficientes cupos disponibles");

    const total = Number(tour.precioPersona) * participantes;

    let montoDescuento = 0;
    let cuponAplicado = null;
    if (codigoCupon) {
      try {
        const validacion = await TourService.validarCuponTour(codigoCupon, tour.id, participantes, clienteId);
        montoDescuento = validacion.descuento;
        cuponAplicado = validacion.cupon;
      } catch (e) { /* cupón inválido, ignorar */ }
    }
    const totalFinal = Number(total) - montoDescuento;
    const comision = Math.round(totalFinal * TASA_COMISION_TOUR);

    const estado = tour.confirmacionAuto ? "CONFIRMADA" : "PENDIENTE";

    const reserva = await prisma.reservaTour.create({
      data: {
        codigo: generarCodigo(),
        configTourId,
        clienteId,
        fechaTour: new Date(fechaTour),
        participantes,
        total: totalFinal,
        comision,
        tasaComision: TASA_COMISION_TOUR,
        montoDescuento: montoDescuento > 0 ? montoDescuento : null,
        codigoCupon: cuponAplicado?.codigo ?? null,
        estado,
        metodoPago,
        notasCliente: notasCliente || null,
        nombreContacto,
        telefonoContacto,
      },
      include: { configTour: { include: TOUR_INCLUDE } },
    });

    if (cuponAplicado) {
      await prisma.cuponTourUso.create({
        data: { cuponTourId: cuponAplicado.id, clienteId, reservaTourId: reserva.id },
      });
      await prisma.cuponTour.update({
        where: { id: cuponAplicado.id },
        data: { usosActuales: { increment: 1 } },
      });
    }

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

    // WhatsApp fire-and-forget
    setImmediate(async () => {
      try {
        const operadorWA = tour.comercio?.whatsapp;
        if (operadorWA) {
          await notificarWhatsApp(operadorWA,
            `🗺️ *Nueva reserva de tour*\n` +
            `Código: *${reserva.codigo}*\n` +
            `Tour: ${tour.nombre}\n` +
            `Fecha: ${new Date(fechaTour).toLocaleDateString('es-CO')}\n` +
            `Participantes: ${participantes}\n` +
            `Total: $${Number(totalFinal).toLocaleString('es-CO')}\n` +
            `Contacto: ${nombreContacto} · ${telefonoContacto}`
          );
        }
      } catch (e) { console.error('[WHATSAPP-TOUR]', e.message); }
    });

    return reserva;
  },

  async misReservas(clienteId) {
    return prisma.reservaTour.findMany({
      where: { clienteId },
      include: { configTour: { include: TOUR_INCLUDE }, review: { select: { id: true } } },
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

  // ── CUPONES TOUR ─────────────────────────────────────────────

  async validarCuponTour(codigo, configTourId, participantes, clienteId) {
    const cupon = await prisma.cuponTour.findFirst({
      where: {
        codigo: codigo.trim().toUpperCase(),
        activo: true,
        fin:    { gte: new Date() },
        inicio: { lte: new Date() },
        OR: [{ configTourId: null }, { configTourId }],
      },
    });
    if (!cupon) throw new ErrorValidacion("Cupón inválido o expirado");
    if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
      throw new ErrorValidacion("Este cupón ya alcanzó su límite de usos");
    }
    if (cupon.minimoPersonas && participantes < cupon.minimoPersonas) {
      throw new ErrorValidacion(`Mínimo ${cupon.minimoPersonas} personas para usar este cupón`);
    }
    if (clienteId) {
      const yaUso = await prisma.cuponTourUso.findFirst({ where: { cuponTourId: cupon.id, clienteId } });
      if (yaUso) throw new ErrorValidacion("Ya usaste este cupón anteriormente");
    }
    const tour = await prisma.configTour.findUnique({ where: { id: configTourId } });
    const subtotal = Number(tour.precioPersona) * participantes;
    const descuento = cupon.tipo === "PORCENTAJE"
      ? Math.round(subtotal * Number(cupon.valor) / 100)
      : Math.min(Number(cupon.valor), subtotal);
    return { cupon, descuento, subtotalConDescuento: subtotal - descuento };
  },

  async listarCuponesTour(comercioId) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) return [];
    return prisma.cuponTour.findMany({
      where: { configTourId: tour.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usos: true } } },
    });
  },

  async crearCuponTour(comercioId, datos) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) throw new ErrorValidacion("No tienes un tour configurado");
    const { codigo, tipo, valor, minimoPersonas, usosMaximos, inicio, fin } = datos;
    if (!codigo?.trim()) throw new ErrorValidacion("El código es requerido");
    if (!valor || Number(valor) <= 0) throw new ErrorValidacion("El valor debe ser positivo");
    if (tipo === "PORCENTAJE" && Number(valor) > 100) throw new ErrorValidacion("El porcentaje no puede superar 100");
    return prisma.cuponTour.create({
      data: {
        codigo: codigo.trim().toUpperCase(),
        tipo: tipo ?? "PORCENTAJE",
        valor: Number(valor),
        minimoPersonas: minimoPersonas ? Number(minimoPersonas) : null,
        usosMaximos: usosMaximos ? Number(usosMaximos) : null,
        activo: true,
        inicio: new Date(inicio),
        fin:    new Date(fin),
        configTourId: tour.id,
      },
    });
  },

  async eliminarCuponTour(comercioId, cuponId) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");
    const cupon = await prisma.cuponTour.findFirst({ where: { id: cuponId, configTourId: tour.id } });
    if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado");
    return prisma.cuponTour.update({ where: { id: cuponId }, data: { activo: false } });
  },

  // ── FAVORITOS TOUR ────────────────────────────────────────────

  async toggleFavoritoTour(usuarioId, configTourId) {
    const existe = await prisma.favoritoTour.findUnique({
      where: { usuarioId_configTourId: { usuarioId, configTourId } },
    });
    if (existe) {
      await prisma.favoritoTour.delete({ where: { id: existe.id } });
      return { esFavorito: false };
    }
    await prisma.favoritoTour.create({ data: { usuarioId, configTourId } });
    return { esFavorito: true };
  },

  async misFavoritosTour(usuarioId) {
    const favs = await prisma.favoritoTour.findMany({
      where: { usuarioId },
      include: {
        configTour: {
          include: {
            comercio: { select: { id: true, nombre: true, municipio: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return favs.map(f => f.configTour);
  },

  async esFavoritoTour(usuarioId, configTourId) {
    const existe = await prisma.favoritoTour.findUnique({
      where: { usuarioId_configTourId: { usuarioId, configTourId } },
    });
    return { esFavorito: !!existe };
  },

  // ── ESTADÍSTICAS TOUR ─────────────────────────────────────────

  async estadisticasTour(comercioId) {
    const tour = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!tour) return null;

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

    const [mesCurrent, mesAnterior, proximas, totalReservas, ultimas6m] = await Promise.all([
      prisma.reservaTour.aggregate({
        where: { configTourId: tour.id, estado: { in: ["CONFIRMADA", "COMPLETADA"] }, creadoAt: { gte: inicioMes } },
        _count: { id: true },
        _sum: { total: true, comision: true, participantes: true },
      }),
      prisma.reservaTour.aggregate({
        where: { configTourId: tour.id, estado: { in: ["CONFIRMADA", "COMPLETADA"] }, creadoAt: { gte: inicioMesAnterior, lte: finMesAnterior } },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.reservaTour.findMany({
        where: { configTourId: tour.id, estado: "CONFIRMADA", fechaTour: { gte: hoy } },
        orderBy: { fechaTour: "asc" },
        take: 5,
        select: { id: true, codigo: true, fechaTour: true, participantes: true, total: true, nombreContacto: true },
      }),
      prisma.reservaTour.count({
        where: { configTourId: tour.id, estado: { in: ["CONFIRMADA", "COMPLETADA"] } },
      }),
      prisma.reservaTour.findMany({
        where: { configTourId: tour.id, estado: { in: ["CONFIRMADA", "COMPLETADA"] },
                 creadoAt: { gte: new Date(Date.now() - 180 * 86400000) } },
        select: { creadoAt: true, total: true },
      }),
    ]);

    const porMes = {};
    for (const r of ultimas6m) {
      const key = `${r.creadoAt.getFullYear()}-${String(r.creadoAt.getMonth() + 1).padStart(2, '0')}`;
      if (!porMes[key]) porMes[key] = { reservas: 0, ingresos: 0 };
      porMes[key].reservas++;
      porMes[key].ingresos += Number(r.total);
    }

    return {
      mes: {
        reservas: mesCurrent._count.id,
        ingresos: Number(mesCurrent._sum.total ?? 0),
        comision: Number(mesCurrent._sum.comision ?? 0),
        participantes: mesCurrent._sum.participantes ?? 0,
      },
      mesAnterior: {
        reservas: mesAnterior._count.id,
        ingresos: Number(mesAnterior._sum.total ?? 0),
      },
      totalHistorico: totalReservas,
      proximasReservas: proximas,
      porMes: Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, data]) => ({ mes, ...data })),
    };
  },

  // ── VIDEO TOUR ────────────────────────────────────────────────

  async subirVideoTour(comercioId, videoUrl, posterUrl, duracion) {
    const config = await prisma.configTour.findUnique({ where: { comercioId } });
    if (!config) throw new Error("Config tour no encontrada");
    return prisma.configTour.update({
      where: { comercioId },
      data: { videoUrl, videoPosterUrl: posterUrl },
    });
  },

  async quitarVideoTour(comercioId) {
    return prisma.configTour.update({
      where: { comercioId },
      data: { videoUrl: null, videoPosterUrl: null },
    });
  },
};

module.exports = TourService;
