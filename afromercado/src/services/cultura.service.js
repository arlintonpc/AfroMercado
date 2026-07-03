const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");

const TASA_COMISION_CULTURA = 0.10;
const ESTADOS_EVENTO = ["BORRADOR", "PUBLICADO", "FINALIZADO", "CANCELADO", "POSPUESTO"];

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CU-${ts}-${rnd}`;
}

function textoLimpio(valor, max = 180) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  return String(valor).trim().slice(0, max);
}

function numeroONull(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const num = Number(valor);
  return Number.isFinite(num) ? num : null;
}

function boolOpcional(valor) {
  if (valor === undefined) return undefined;
  if (typeof valor === "boolean") return valor;
  return ["true", "1", "si", "sí", "on"].includes(String(valor).toLowerCase());
}

function fechaOUndefined(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function limpiarUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function camposEvento(datos = {}) {
  const data = {
    titulo: textoLimpio(datos.titulo, 160),
    descripcion: textoLimpio(datos.descripcion, 6000),
    categoria: textoLimpio(datos.categoria, 80),
    departamento: textoLimpio(datos.departamento, 80),
    municipio: textoLimpio(datos.municipio, 80),
    lugar: textoLimpio(datos.lugar, 300),
    latitud: numeroONull(datos.latitud),
    longitud: numeroONull(datos.longitud),
    fechaInicio: fechaOUndefined(datos.fechaInicio),
    fechaFin: fechaOUndefined(datos.fechaFin),
    portadaUrl: textoLimpio(datos.portadaUrl, 1000),
    videoUrl: textoLimpio(datos.videoUrl, 1000),
    patrimonio: boolOpcional(datos.patrimonio),
    patrimonioNota: textoLimpio(datos.patrimonioNota, 200),
    gratuito: boolOpcional(datos.gratuito),
    destacado: boolOpcional(datos.destacado),
  };
  if (Array.isArray(datos.fotos)) data.fotos = datos.fotos;
  return limpiarUndefined(data);
}

function camposEntrada(datos = {}) {
  const data = {
    nombre: textoLimpio(datos.nombre, 120),
    descripcion: textoLimpio(datos.descripcion, 500),
    precio: numeroONull(datos.precio),
    cupo: numeroONull(datos.cupo),
    activa: boolOpcional(datos.activa),
    orden: datos.orden === undefined ? undefined : Number(datos.orden),
  };
  return limpiarUndefined(data);
}

const EVENTO_INCLUDE = {
  entradas: { where: { activa: true }, orderBy: { orden: "asc" } },
  comercio: { select: { id: true, nombre: true, municipio: true, whatsapp: true } },
};

async function obtenerEventoDelComercio(comercioId, eventoId) {
  const evento = await prisma.eventoCultural.findFirst({
    where: { id: Number(eventoId), comercioId },
  });
  if (!evento) throw new ErrorNoEncontrado("Evento cultural no encontrado");
  return evento;
}

// Al posponer o cancelar un evento, avisa a todos los compradores con reserva activa
async function notificarCambioEstadoSiAplica(evento, estado) {
  if (estado !== "POSPUESTO" && estado !== "CANCELADO") return;
  try {
    const reservas = await prisma.reservaCultural.findMany({
      where: { eventoCulturalId: evento.id, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
      include: { cliente: { select: { id: true, nombre: true, telefono: true } } },
    });
    const compradores = reservas.map((r) => r.cliente).filter(Boolean);
    if (compradores.length === 0) return;
    await NotificacionService.eventoCulturalCambioEstado({ evento, estado, compradores });
  } catch (e) {
    console.error("[CULTURA] Error notificando cambio de estado:", e.message);
  }
}

const CulturaService = {
  // ── PÚBLICO ──────────────────────────────────────────────────
  async listarAgenda({ departamento, municipio, categoria } = {}) {
    const inicioHoy = new Date(new Date().setHours(0, 0, 0, 0));
    const where = {
      estado: "PUBLICADO",
      OR: [
        { fechaFin: { gte: new Date() } },
        { fechaFin: null, fechaInicio: { gte: inicioHoy } },
      ],
    };
    if (departamento) where.departamento = { contains: departamento, mode: "insensitive" };
    if (municipio) where.municipio = { contains: municipio, mode: "insensitive" };
    if (categoria) where.categoria = { contains: categoria, mode: "insensitive" };

    return prisma.eventoCultural.findMany({
      where,
      include: EVENTO_INCLUDE,
      orderBy: [{ destacado: "desc" }, { fechaInicio: "asc" }],
    });
  },

  async obtenerEvento(id) {
    const evento = await prisma.eventoCultural.findUnique({
      where: { id: Number(id) },
      include: EVENTO_INCLUDE,
    });
    if (!evento || evento.estado !== "PUBLICADO") {
      throw new ErrorNoEncontrado("Evento cultural no encontrado");
    }
    return evento;
  },

  // ── CLIENTE ──────────────────────────────────────────────────
  async crearReserva(clienteId, { entradaCulturalId, cantidad, metodoPago, notasCliente, nombreContacto, telefonoContacto }) {
    const cant = Math.max(1, Number(cantidad) || 1);
    if (!nombreContacto || !telefonoContacto) {
      throw new ErrorValidacion("El nombre y el teléfono de contacto son obligatorios");
    }

    const entrada = await prisma.entradaCultural.findUnique({
      where: { id: Number(entradaCulturalId) },
      include: { evento: true },
    });
    if (!entrada || !entrada.activa) throw new ErrorValidacion("Entrada no disponible");
    if (entrada.evento.estado !== "PUBLICADO") throw new ErrorValidacion("Este evento no está disponible");

    const total = Number(entrada.precio) * cant;
    const comision = Math.round(total * TASA_COMISION_CULTURA);

    return prisma.$transaction(async (tx) => {
      // Reserva de cupo con UPDATE atómico (a prueba de sobreventa)
      const actualizadas = await tx.$executeRaw`
        UPDATE "EntradaCultural"
        SET "vendidas" = "vendidas" + ${cant}
        WHERE id = ${entrada.id}
          AND ("cupo" IS NULL OR ("cupo" - "vendidas") >= ${cant})
      `;
      if (actualizadas === 0) {
        throw new ErrorValidacion("No hay suficientes entradas disponibles");
      }

      return tx.reservaCultural.create({
        data: {
          codigo: generarCodigo(),
          eventoCulturalId: entrada.eventoCulturalId,
          entradaCulturalId: entrada.id,
          clienteId,
          cantidad: cant,
          total,
          comision,
          tasaComision: TASA_COMISION_CULTURA,
          estado: "PENDIENTE",
          metodoPago: metodoPago || "EFECTIVO",
          notasCliente: notasCliente || null,
          nombreContacto,
          telefonoContacto,
        },
        include: { evento: { include: EVENTO_INCLUDE }, entrada: true },
      });
    });
  },

  async misReservas(clienteId) {
    return prisma.reservaCultural.findMany({
      where: { clienteId },
      include: { evento: { include: EVENTO_INCLUDE }, entrada: true, review: { select: { id: true } } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReserva(clienteId, reservaId) {
    const reserva = await prisma.reservaCultural.findFirst({
      where: { id: Number(reservaId), clienteId },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) {
      throw new ErrorValidacion("Esta reserva no se puede cancelar");
    }
    return prisma.$transaction(async (tx) => {
      await tx.entradaCultural.update({
        where: { id: reserva.entradaCulturalId },
        data: { vendidas: { decrement: reserva.cantidad } },
      });
      return tx.reservaCultural.update({
        where: { id: reserva.id },
        data: { estado: "CANCELADA", updatedAt: new Date() },
      });
    });
  },

  // ── ORGANIZADOR (comercio) ───────────────────────────────────
  async misEventos(comercioId) {
    return prisma.eventoCultural.findMany({
      where: { comercioId },
      include: { entradas: { orderBy: { orden: "asc" } } },
      orderBy: { fechaInicio: "desc" },
    });
  },

  async crearEvento(comercioId, datos) {
    const data = camposEvento(datos);
    if (!data.titulo) throw new ErrorValidacion("El título del evento es obligatorio");
    if (!data.departamento || !data.municipio) {
      throw new ErrorValidacion("El departamento y el municipio son obligatorios");
    }
    if (!data.fechaInicio) throw new ErrorValidacion("La fecha de inicio es obligatoria");
    return prisma.eventoCultural.create({
      data: { ...data, comercioId, fotos: data.fotos ?? [] },
      include: { entradas: true },
    });
  },

  async actualizarEvento(comercioId, eventoId, datos) {
    await obtenerEventoDelComercio(comercioId, eventoId);
    const data = camposEvento(datos);
    // El organizador puede publicar, volver a borrador, posponer o cancelar; no finalizar (solo admin)
    if (datos.estado && ["BORRADOR", "PUBLICADO", "POSPUESTO", "CANCELADO"].includes(datos.estado)) {
      data.estado = datos.estado;
    }
    const evento = await prisma.eventoCultural.update({
      where: { id: Number(eventoId) },
      data: { ...data, updatedAt: new Date() },
      include: { entradas: { orderBy: { orden: "asc" } } },
    });
    if (data.estado) await notificarCambioEstadoSiAplica(evento, data.estado);
    return evento;
  },

  async crearEntrada(comercioId, eventoId, datos) {
    await obtenerEventoDelComercio(comercioId, eventoId);
    const data = camposEntrada(datos);
    if (!data.nombre) throw new ErrorValidacion("El nombre de la entrada es obligatorio");
    if (data.precio == null || data.precio < 0) throw new ErrorValidacion("El precio de la entrada no es válido");
    return prisma.entradaCultural.create({
      data: { ...data, eventoCulturalId: Number(eventoId) },
    });
  },

  async actualizarEntrada(comercioId, entradaId, datos) {
    const entrada = await prisma.entradaCultural.findFirst({
      where: { id: Number(entradaId), evento: { comercioId } },
    });
    if (!entrada) throw new ErrorNoEncontrado("Entrada no encontrada");
    return prisma.entradaCultural.update({
      where: { id: entrada.id },
      data: { ...camposEntrada(datos), updatedAt: new Date() },
    });
  },

  async eliminarEntrada(comercioId, entradaId) {
    const entrada = await prisma.entradaCultural.findFirst({
      where: { id: Number(entradaId), evento: { comercioId } },
    });
    if (!entrada) throw new ErrorNoEncontrado("Entrada no encontrada");
    // No se borran entradas ya vendidas: se desactivan para conservar el histórico
    if (entrada.vendidas > 0) {
      return prisma.entradaCultural.update({ where: { id: entrada.id }, data: { activa: false } });
    }
    await prisma.entradaCultural.delete({ where: { id: entrada.id } });
    return { ok: true };
  },

  async reservasOrganizador(comercioId, estado) {
    return prisma.reservaCultural.findMany({
      where: { evento: { comercioId }, ...(estado ? { estado } : {}) },
      include: {
        entrada: { select: { nombre: true } },
        evento: { select: { titulo: true } },
        cliente: { select: { id: true, nombre: true, email: true, telefono: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  // ── ADMIN ────────────────────────────────────────────────────
  async adminListar() {
    return prisma.eventoCultural.findMany({
      include: {
        entradas: { orderBy: { orden: "asc" } },
        comercio: { select: { id: true, nombre: true } },
        _count: { select: { reservas: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  async adminCrearEvento(datos) {
    // Eventos institucionales/patrimoniales de la plataforma (sin comercio organizador)
    const data = camposEvento(datos);
    if (!data.titulo) throw new ErrorValidacion("El título del evento es obligatorio");
    if (!data.departamento || !data.municipio) {
      throw new ErrorValidacion("El departamento y el municipio son obligatorios");
    }
    if (!data.fechaInicio) throw new ErrorValidacion("La fecha de inicio es obligatoria");
    if (datos.estado && ESTADOS_EVENTO.includes(datos.estado)) data.estado = datos.estado;
    return prisma.eventoCultural.create({
      data: { ...data, comercioId: null, fotos: data.fotos ?? [] },
      include: { entradas: true },
    });
  },

  async adminCambiarEstado(id, estado) {
    if (!ESTADOS_EVENTO.includes(estado)) throw new ErrorValidacion("Estado inválido");
    const evento = await prisma.eventoCultural.update({
      where: { id: Number(id) },
      data: { estado, updatedAt: new Date() },
    });
    await notificarCambioEstadoSiAplica(evento, estado);
    return evento;
  },
};

module.exports = CulturaService;
