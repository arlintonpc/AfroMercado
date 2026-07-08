const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const FacturacionService = require("./facturacion.service");
const CulturaRepository = require("../repositories/cultura.repository");

const TASA_COMISION_CULTURA = 0.10;
const ESTADOS_EVENTO = ["BORRADOR", "PUBLICADO", "FINALIZADO", "CANCELADO", "POSPUESTO"];
const MOTIVOS_DENUNCIA_PUBLICACION = ["CONTENIDO_INAPROPIADO", "SPAM", "DERECHOS_DE_AUTOR", "NO_RELACIONADO", "OTRO"];
const ESTADOS_RESERVA_CULTURA_TRANSICIONES = {
  PENDIENTE: ["CONFIRMADA", "RECHAZADA", "CANCELADA"],
  CONFIRMADA: ["USADA", "CANCELADA"],
};
const ESTADOS_RESERVA_CULTURA_EQUIVALENTES = {
  COMPLETADA: "USADA",
};

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

function enteroPositivoRequerido(valor, nombreCampo) {
  const num = Number(valor);
  if (!Number.isInteger(num) || num < 1) {
    throw new ErrorValidacion(`El ${nombreCampo} no es valido`);
  }
  return num;
}

function normalizarEstadoReservaCultural(estado) {
  const normalizado = String(estado || "").trim().toUpperCase();
  return ESTADOS_RESERVA_CULTURA_EQUIVALENTES[normalizado] || normalizado;
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
  async listarAgenda({ departamento, municipio, categoria, search, patrimonio, fechaDesde, fechaHasta } = {}) {
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
    if (search && String(search).trim()) {
      where.titulo = { contains: String(search).trim(), mode: "insensitive" };
    }
    const esPatrimonio = boolOpcional(patrimonio);
    if (esPatrimonio === true) where.patrimonio = true;

    const desde = fechaOUndefined(fechaDesde);
    const hasta = fechaOUndefined(fechaHasta);
    if (desde || hasta) {
      where.fechaInicio = {
        ...(where.fechaInicio || {}),
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lte: hasta } : {}),
      };
    }

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
    const cant = enteroPositivoRequerido(cantidad, "cantidad");
    const entradaId = enteroPositivoRequerido(entradaCulturalId, "entrada cultural");
    if (!nombreContacto || !telefonoContacto) {
      throw new ErrorValidacion("El nombre y el teléfono de contacto son obligatorios");
    }

    const entrada = await prisma.entradaCultural.findUnique({
      where: { id: entradaId },
      include: { evento: true },
    });
    if (!entrada || !entrada.activa) throw new ErrorValidacion("Entrada no disponible");
    if (entrada.evento.estado !== "PUBLICADO") throw new ErrorValidacion("Este evento no está disponible");

    const total = Number(entrada.precio) * cant;
    const comision = Math.round(total * TASA_COMISION_CULTURA);

    const reserva = await prisma.$transaction(async (tx) => {
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

    FacturacionService.emitirParaReferencia("CULTURA", reserva.id).catch((e) =>
      console.error(`[FACTURACION] emisión fallida para ReservaCultural #${reserva.id}, quedará en reintento:`, e.message)
    );

    return reserva;
  },

  async misReservas(clienteId) {
    return prisma.reservaCultural.findMany({
      where: { clienteId },
      include: { evento: { include: EVENTO_INCLUDE }, entrada: true, review: { select: { id: true } } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReserva(clienteId, reservaId) {
    return prisma.$transaction(async (tx) => {
      const reserva = await tx.reservaCultural.findFirst({
        where: { id: enteroPositivoRequerido(reservaId, "reserva"), clienteId },
      });
      if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

      const actualizadas = await tx.reservaCultural.updateMany({
        where: {
          id: reserva.id,
          clienteId,
          estado: { in: ["PENDIENTE", "CONFIRMADA"] },
        },
        data: { estado: "CANCELADA", updatedAt: new Date() },
      });
      if (actualizadas.count === 0) {
        throw new ErrorValidacion("Esta reserva no se puede cancelar");
      }

      await tx.entradaCultural.update({
        where: { id: reserva.entradaCulturalId },
        data: { vendidas: { decrement: reserva.cantidad } },
      });
      return tx.reservaCultural.findUnique({
        where: { id: reserva.id },
        include: { evento: { include: EVENTO_INCLUDE }, entrada: true },
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
  async cambiarEstadoReserva(comercioId, reservaId, nuevoEstado) {
    const estadoNormalizado = normalizarEstadoReservaCultural(nuevoEstado);
    if (!["CONFIRMADA", "RECHAZADA", "CANCELADA", "USADA"].includes(estadoNormalizado)) {
      throw new ErrorValidacion("Estado invalido");
    }

    return prisma.$transaction(async (tx) => {
      const reserva = await tx.reservaCultural.findFirst({
        where: {
          id: enteroPositivoRequerido(reservaId, "reserva"),
          evento: { comercioId },
        },
        include: {
          cliente: { select: { id: true, nombre: true, telefono: true } },
          entrada: true,
          evento: { select: { id: true, titulo: true } },
        },
      });

      if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

      const permitidos = ESTADOS_RESERVA_CULTURA_TRANSICIONES[reserva.estado] ?? [];
      if (!permitidos.includes(estadoNormalizado)) {
        throw new ErrorValidacion(`No se puede pasar de ${reserva.estado} a ${estadoNormalizado}`);
      }

      const actualizadas = await tx.reservaCultural.updateMany({
        where: {
          id: reserva.id,
          estado: reserva.estado,
          eventoCulturalId: reserva.eventoCulturalId,
        },
        data: { estado: estadoNormalizado, updatedAt: new Date() },
      });

      if (actualizadas.count === 0) {
        throw new ErrorValidacion("La reserva ya fue modificada");
      }

      if (estadoNormalizado === "CANCELADA") {
        await tx.entradaCultural.update({
          where: { id: reserva.entradaCulturalId },
          data: { vendidas: { decrement: reserva.cantidad } },
        });
      }

      return tx.reservaCultural.findUnique({
        where: { id: reserva.id },
        include: {
          evento: { include: EVENTO_INCLUDE },
          entrada: true,
          cliente: { select: { id: true, nombre: true, telefono: true } },
        },
      });
    });
  },

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

  // ── COMPARTE TU CHOCÓ (publicaciones comunitarias) ───────────
  // Cualquier usuario autenticado publica sin moderación previa; control
  // solo reactivo vía denuncias (ver sección de denuncias más abajo).
  async crearPublicacion(usuarioId, { titulo, descripcion, fotoUrls, videoUrl, departamento, municipio }) {
    if (!titulo?.trim()) throw new ErrorValidacion("El título es obligatorio");
    if (!departamento?.trim()) throw new ErrorValidacion("El departamento es obligatorio");
    const fotos = Array.isArray(fotoUrls) ? fotoUrls.slice(0, 6) : [];
    if (fotos.length === 0 && !videoUrl) {
      throw new ErrorValidacion("Debes adjuntar al menos una foto o un video");
    }
    return CulturaRepository.crearPublicacion({
      autorId: usuarioId,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      fotoUrls: fotos,
      videoUrl: videoUrl || null,
      departamento: departamento.trim(),
      municipio: municipio?.trim() || null,
    });
  },

  async listarPublicaciones(filtros = {}) {
    const resultado = await CulturaRepository.listarPublicaciones(filtros);
    return {
      ...resultado,
      items: resultado.items.map((p) => {
        const { _count, likes, ...resto } = p;
        return {
          ...resto,
          totalLikes: _count?.likes ?? 0,
          meGusta: Array.isArray(likes) && likes.length > 0,
        };
      }),
    };
  },

  // ── Denuncias de publicaciones ───────────────────────────────
  async denunciarPublicacion(usuarioId, publicacionId, { motivo, descripcion }) {
    if (!MOTIVOS_DENUNCIA_PUBLICACION.includes(motivo)) {
      throw new ErrorValidacion(`Motivo inválido. Opciones: ${MOTIVOS_DENUNCIA_PUBLICACION.join(", ")}`);
    }
    const publicacion = await CulturaRepository.buscarPublicacionPorId(publicacionId);
    if (!publicacion || !publicacion.activa) throw new ErrorNoEncontrado("Publicación no encontrada");
    if (publicacion.autorId === usuarioId) throw new ErrorValidacion("No puedes denunciar tu propia publicación");
    const existente = await CulturaRepository.buscarDenunciaPublicacion(publicacionId, usuarioId);
    if (existente) throw new ErrorValidacion("Ya denunciaste esta publicación");
    return CulturaRepository.crearDenunciaPublicacion({
      publicacionCulturalId: publicacionId,
      denuncianteId: usuarioId,
      motivo,
      descripcion: descripcion?.trim() || null,
    });
  },

  async listarDenunciasPublicacionPendientes() {
    return CulturaRepository.listarDenunciasPublicacionPendientes();
  },

  async resolverDenunciaPublicacion(adminId, denunciaId, { accion, motivo }) {
    if (!["DESESTIMAR", "OCULTAR"].includes(accion)) throw new ErrorValidacion("Acción inválida");
    const denuncia = await CulturaRepository.buscarDenunciaPublicacionPorId(denunciaId);
    if (!denuncia) throw new ErrorNoEncontrado("Denuncia no encontrada");
    if (denuncia.estado !== "PENDIENTE") throw new ErrorValidacion("Esta denuncia ya fue resuelta");

    if (accion === "DESESTIMAR") {
      return CulturaRepository.actualizarDenunciaPublicacion(denunciaId, {
        estado: "DESESTIMADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo?.trim() || null,
      });
    }

    // OCULTAR
    await CulturaRepository.ocultarPublicacion(denuncia.publicacionCulturalId);
    return CulturaRepository.actualizarDenunciaPublicacion(denunciaId, {
      estado: "PUBLICACION_OCULTADA",
      revisadoPor: adminId,
      revisadoAt: new Date(),
      notaRevision: motivo?.trim() || null,
    });
  },

  // ── LIKES DE PUBLICACIONES CULTURALES ────────────────────────

  async toggleLikePublicacion(usuarioId, publicacionId) {
    const existe = await prisma.likePublicacionCultural.findUnique({
      where: { usuarioId_publicacionCulturalId: { usuarioId, publicacionCulturalId: publicacionId } },
    });
    if (existe) {
      await prisma.likePublicacionCultural.delete({ where: { id: existe.id } });
    } else {
      await prisma.likePublicacionCultural.create({ data: { usuarioId, publicacionCulturalId: publicacionId } });
    }
    const totalLikes = await prisma.likePublicacionCultural.count({ where: { publicacionCulturalId: publicacionId } });
    return { meGusta: !existe, totalLikes };
  },

  // ── FAVORITOS CULTURA ───────────────────────────────────────────

  async toggleFavoritoCultura(usuarioId, eventoCulturalId) {
    const existe = await prisma.favoritoCultura.findUnique({
      where: { usuarioId_eventoCulturalId: { usuarioId, eventoCulturalId } },
    });
    if (existe) {
      await prisma.favoritoCultura.delete({ where: { id: existe.id } });
      return { esFavorito: false };
    }
    await prisma.favoritoCultura.create({ data: { usuarioId, eventoCulturalId } });
    return { esFavorito: true };
  },

  async misFavoritosCultura(usuarioId) {
    const favs = await prisma.favoritoCultura.findMany({
      where: { usuarioId },
      include: { evento: { include: EVENTO_INCLUDE } },
      orderBy: { createdAt: "desc" },
    });
    return favs.map(f => f.evento);
  },

  async esFavoritoCultura(usuarioId, eventoCulturalId) {
    const existe = await prisma.favoritoCultura.findUnique({
      where: { usuarioId_eventoCulturalId: { usuarioId, eventoCulturalId } },
    });
    return { esFavorito: !!existe };
  },
};

module.exports = CulturaService;
