const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TX-${ts}-${rnd}`;
}

async function notif(usuarioId, titulo, cuerpo, url) {
  if (!usuarioId) return;
  try {
    await prisma.notificacion.create({
      data: { usuarioId, tipo: "GENERAL", titulo, mensaje: cuerpo, url: url || null },
    });
    sseManager.enviar(usuarioId, "notificacion", { tipo: "TRANSPORTE", titulo, mensaje: cuerpo, url });
    await enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono: "/icon-192.svg" });
  } catch (e) { console.error("[NOTIF-TRANSPORTE]", e.message); }
}

const TRANSPORTE_INCLUDE = {
  comercio: {
    select: {
      id: true, nombre: true, municipio: true, departamento: true,
      latitud: true, longitud: true, logoUrl: true, calificacion: true,
      totalReviews: true, whatsapp: true,
    },
  },
};

const TransporteService = {
  async listar({ municipio, departamento } = {}) {
    const comercioWhere = { verificado: true };
    if (municipio) comercioWhere.municipio = { contains: municipio, mode: "insensitive" };
    if (departamento) comercioWhere.departamento = { contains: departamento, mode: "insensitive" };

    return prisma.configTransporte.findMany({
      where: { activo: true, comercio: comercioWhere },
      include: { ...TRANSPORTE_INCLUDE, rutas: { where: { activo: true }, orderBy: { horario: "asc" } } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async obtener(id) {
    const t = await prisma.configTransporte.findUnique({
      where: { id },
      include: { ...TRANSPORTE_INCLUDE, rutas: { where: { activo: true }, orderBy: { horario: "asc" } } },
    });
    if (!t) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");
    return t;
  },

  async verificarDisponibilidad(rutaId, fecha) {
    const ruta = await prisma.rutaTransporte.findUnique({ where: { id: rutaId } });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");

    const fechaD = new Date(fecha);
    const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaD); fin.setHours(23, 59, 59, 999);

    const reservados = await prisma.reservaTransporte.aggregate({
      where: { rutaTransporteId: rutaId, fechaViaje: { gte: inicio, lte: fin }, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
      _sum: { asientos: true },
    });
    const ocupados = reservados._sum.asientos ?? 0;
    return { disponibles: Math.max(0, ruta.capacidad - ocupados), capacidad: ruta.capacidad };
  },

  async crearReserva(clienteId, { rutaTransporteId, fechaViaje, asientos, metodoPago, notasCliente, nombreContacto, telefonoContacto }) {
    const ruta = await prisma.rutaTransporte.findUnique({
      where: { id: rutaTransporteId },
      include: { configTransporte: { include: TRANSPORTE_INCLUDE } },
    });
    if (!ruta || !ruta.activo) throw new ErrorValidacion("Ruta no disponible");

    const disp = await TransporteService.verificarDisponibilidad(rutaTransporteId, fechaViaje);
    if (disp.disponibles < asientos) throw new ErrorValidacion("No hay suficientes asientos disponibles");

    const total = Number(ruta.precioAsiento) * asientos;

    const reserva = await prisma.reservaTransporte.create({
      data: {
        codigo: generarCodigo(),
        rutaTransporteId,
        clienteId,
        fechaViaje: new Date(fechaViaje),
        asientos,
        total,
        estado: "PENDIENTE",
        metodoPago,
        notasCliente: notasCliente || null,
        nombreContacto,
        telefonoContacto,
      },
      include: { ruta: { include: { configTransporte: { include: TRANSPORTE_INCLUDE } } } },
    });

    const operadorId = await prisma.comercio.findUnique({
      where: { id: ruta.configTransporte.comercioId }, select: { usuarioId: true },
    }).then(c => c?.usuarioId);
    if (operadorId) {
      await notif(operadorId, "🛥️ Nueva reserva de transporte", `${nombreContacto} reservó ${asientos} asiento(s) en ${ruta.origen} → ${ruta.destino}`, "/comerciante/transportes");
    }
    return reserva;
  },

  async misReservas(clienteId) {
    return prisma.reservaTransporte.findMany({
      where: { clienteId },
      include: { ruta: { include: { configTransporte: { include: TRANSPORTE_INCLUDE } } } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReserva(clienteId, reservaId) {
    const reserva = await prisma.reservaTransporte.findFirst({ where: { id: reservaId, clienteId } });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) throw new ErrorValidacion("No se puede cancelar");
    return prisma.reservaTransporte.update({ where: { id: reservaId }, data: { estado: "CANCELADA", updatedAt: new Date() } });
  },

  // Operador
  async miConfig(comercioId) {
    const cfg = await prisma.configTransporte.findUnique({
      where: { comercioId },
      include: { rutas: { orderBy: { creadoAt: "asc" } } },
    });
    if (!cfg) {
      return prisma.configTransporte.create({
        data: { comercioId, nombre: "Mi Servicio de Transporte", fotos: [] },
        include: { rutas: true },
      });
    }
    return cfg;
  },

  async actualizarConfig(comercioId, datos) {
    return prisma.configTransporte.update({ where: { comercioId }, data: { ...datos, updatedAt: new Date() } });
  },

  async agregarRuta(comercioId, datos) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuración no encontrada");
    return prisma.rutaTransporte.create({ data: { ...datos, configTransporteId: cfg.id } });
  },

  async actualizarRuta(comercioId, rutaId, datos) {
    const ruta = await prisma.rutaTransporte.findFirst({
      where: { id: rutaId, configTransporte: { comercioId } },
    });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");
    return prisma.rutaTransporte.update({ where: { id: rutaId }, data: datos });
  },

  async eliminarRuta(comercioId, rutaId) {
    const ruta = await prisma.rutaTransporte.findFirst({
      where: { id: rutaId, configTransporte: { comercioId } },
    });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");
    return prisma.rutaTransporte.update({ where: { id: rutaId }, data: { activo: false } });
  },

  async reservasOperador(comercioId, estado) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    return prisma.reservaTransporte.findMany({
      where: { ruta: { configTransporteId: cfg.id }, ...(estado ? { estado } : {}) },
      include: { ruta: true, cliente: { select: { id: true, nombre: true, email: true } } },
      orderBy: { fechaViaje: "desc" },
    });
  },

  async cambiarEstado(comercioId, reservaId, nuevoEstado) {
    const TRANSICIONES = {
      PENDIENTE:  ["CONFIRMADA", "RECHAZADA"],
      CONFIRMADA: ["COMPLETADA", "CANCELADA"],
    };
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuración no encontrada");

    const reserva = await prisma.reservaTransporte.findFirst({
      where: { id: reservaId, ruta: { configTransporteId: cfg.id } },
      include: { cliente: { select: { id: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

    const permitidos = TRANSICIONES[reserva.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) throw new ErrorValidacion(`No se puede pasar de ${reserva.estado} a ${nuevoEstado}`);

    const actualizada = await prisma.reservaTransporte.update({
      where: { id: reservaId }, data: { estado: nuevoEstado, updatedAt: new Date() },
    });

    const MSGS = {
      CONFIRMADA: ["✅ Viaje confirmado", "Tu reserva de transporte fue confirmada"],
      RECHAZADA:  ["❌ Reserva rechazada", "No pudimos confirmar tu reserva de transporte"],
      COMPLETADA: ["✅ Viaje completado", "¡Gracias por viajar con nosotros!"],
      CANCELADA:  ["❌ Reserva cancelada", "Tu reserva de transporte fue cancelada"],
    };
    const [titulo, cuerpo] = MSGS[nuevoEstado] ?? [`Estado: ${nuevoEstado}`, ""];
    await notif(reserva.cliente.id, titulo, cuerpo, "/transportes/mis-reservas");
    return actualizada;
  },

  async agregarFotos(comercioId, urls) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuración no encontrada");
    return prisma.configTransporte.update({
      where: { comercioId },
      data: { fotos: [...cfg.fotos, ...urls], updatedAt: new Date() },
    });
  },

  // Admin
  async adminListar() {
    return prisma.configTransporte.findMany({
      include: {
        comercio: { select: { id: true, nombre: true, municipio: true, departamento: true } },
        rutas: { where: { activo: true }, select: { id: true } },
        _count: { select: { rutas: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  async adminCambiarEstado(id, activo) {
    return prisma.configTransporte.update({ where: { id }, data: { activo } });
  },

  // ── VIDEO TRANSPORTE ──────────────────────────────────────────

  async subirVideoTransporte(comercioId, videoUrl, posterUrl, duracion) {
    const config = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!config) throw new Error("Config transporte no encontrada");
    return prisma.configTransporte.update({
      where: { comercioId },
      data: { videoUrl, videoPosterUrl: posterUrl },
    });
  },

  async quitarVideoTransporte(comercioId) {
    return prisma.configTransporte.update({
      where: { comercioId },
      data: { videoUrl: null, videoPosterUrl: null },
    });
  },
};

module.exports = TransporteService;
