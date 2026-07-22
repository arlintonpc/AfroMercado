const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const FacturacionService = require("./facturacion.service");
const CulturaRepository = require("../repositories/cultura.repository");
const { validarUbicacion } = require("../utils/ubicacion");
const { assertPuedePublicar, comercioComprableEnPlataforma } = require("../utils/comercio-publicacion");

const TASA_COMISION_CULTURA = 0.10;
const ESTADOS_EVENTO = ["BORRADOR", "PUBLICADO", "FINALIZADO", "CANCELADO", "POSPUESTO"];
const MOTIVOS_DENUNCIA_PUBLICACION = ["CONTENIDO_INAPROPIADO", "SPAM", "DERECHOS_DE_AUTOR", "NO_RELACIONADO", "OTRO"];
// Vitrina de video (v0): qué vertical promociona la publicación de comercio.
// Allowlist en código sobre columna TEXT libre (mismo patrón que
// disputa.service.js::MODULOS_VALIDOS).
const MODULOS_ORIGEN_VITRINA_VALIDOS = ["PEDIDO", "EXPRESS", "HOTEL", "TOUR", "TRANSPORTE", "AGRO"];

// Limpia del objeto comercio los campos internos que no deben exponerse
// públicamente y agrega el booleano derivado `comprableEnPlataforma`
// (mismo criterio que producto.service.js::mapearComercioPublico).
function mapearComercioVitrina(publicacion) {
  if (!publicacion?.comercio) return publicacion;
  publicacion.comercio.comprableEnPlataforma = comercioComprableEnPlataforma(publicacion.comercio);
  delete publicacion.comercio.rut;
  delete publicacion.comercio.cuentaDispersion;
  delete publicacion.comercio.activo;
  delete publicacion.comercio.estadoRegistro;
  delete publicacion.comercio.fotoDocumentoUrl;
  delete publicacion.comercio.fotoDocumentoFrenteUrl;
  delete publicacion.comercio.fotoDocumentoReversoUrl;
  return publicacion;
}
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

    const eventos = await prisma.eventoCultural.findMany({
      where,
      include: EVENTO_INCLUDE,
      orderBy: [{ destacado: "desc" }, { fechaInicio: "asc" }],
    });

    // Inyección de Anuncios (Red de Display Cruzada)
    const campanas = await prisma.anuncioUbicacion.findMany({
      where: {
        activa: true,
        modulo: "CULTURA",
        formato: "BANNER",
        campana: { estado: "ACTIVA" },
      },
      include: { campana: true },
    });

    const shuffledBanners = campanas.sort(() => 0.5 - Math.random()).slice(0, 2);
    let itemsHibridos = [...eventos];

    if (shuffledBanners[0] && itemsHibridos.length >= 3) {
      itemsHibridos.splice(3, 0, {
        id: `banner-${shuffledBanners[0].id}`,
        esBannerDisplay: true,
        titulo: shuffledBanners[0].titulo,
        subtitulo: shuffledBanners[0].subtitulo,
        mediaUrl: shuffledBanners[0].mediaUrl,
        urlDestino: shuffledBanners[0].urlDestino,
        ctaTexto: shuffledBanners[0].ctaTexto,
        etiqueta: shuffledBanners[0].etiqueta,
      });
    }

    if (shuffledBanners[1] && itemsHibridos.length >= 7) {
      itemsHibridos.splice(7, 0, {
        id: `banner-${shuffledBanners[1].id}`,
        esBannerDisplay: true,
        titulo: shuffledBanners[1].titulo,
        subtitulo: shuffledBanners[1].subtitulo,
        mediaUrl: shuffledBanners[1].mediaUrl,
        urlDestino: shuffledBanners[1].urlDestino,
        ctaTexto: shuffledBanners[1].ctaTexto,
        etiqueta: shuffledBanners[1].etiqueta,
      });
    }

    return itemsHibridos;
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
    const reservas = await prisma.reservaCultural.findMany({
      where: { clienteId },
      include: { evento: { include: EVENTO_INCLUDE }, entrada: true },
      orderBy: { creadoAt: "desc" },
    });
    // Resena (Fase 3, Anexo B) no tiene relación directa a ReservaCultural
    // (entidadId no es FK real) — se resuelve con una sola consulta por lote.
    if (reservas.length === 0) return reservas;
    const resenas = await prisma.resena.findMany({
      where: { tipoEntidad: "RESERVA_CULTURAL", entidadId: { in: reservas.map(r => r.id) }, autorId: clienteId },
      select: { id: true, entidadId: true },
    });
    const resenaPorReserva = new Map(resenas.map(r => [r.entidadId, r]));
    return reservas.map(r => ({ ...r, review: resenaPorReserva.get(r.id) ?? null }));
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
  async misPublicacionesVitrina(usuarioId, query) {
    const comercio = await prisma.comercio.findUnique({ where: { usuarioId } });
    if (!comercio) throw new ErrorValidacion("No tienes un comercio asociado");
    
    const resultado = await CulturaRepository.listarMisPublicaciones(comercio.id, query?.page);
    
    // Mapear los contadores al primer nivel para el frontend
    const itemsMapeados = resultado.items.map(p => {
      const { _count, ...resto } = p;
      return {
        ...resto,
        totalLikes: _count?.likes ?? 0,
        totalComentarios: _count?.comentarios ?? 0,
        totalVistas: _count?.vistas ?? 0,
      };
    });
    
    return { ...resultado, items: itemsMapeados };
  },

  async actualizarMiPublicacion(usuarioId, id, datos) {
    const comercio = await prisma.comercio.findUnique({ where: { usuarioId } });
    if (!comercio) throw new ErrorValidacion("No tienes un comercio asociado");
    
    // Solo permitimos editar campos básicos (titulo, descripcion, moduloOrigen, productoId, activa)
    const data = limpiarUndefined({
      titulo: textoLimpio(datos.titulo, 160),
      descripcion: textoLimpio(datos.descripcion, 6000),
      moduloOrigen: datos.moduloOrigen && MODULOS_ORIGEN_VITRINA_VALIDOS.includes(datos.moduloOrigen) ? datos.moduloOrigen : undefined,
      productoId: numeroONull(datos.productoId),
      activa: boolOpcional(datos.activa),
    });

    try {
      return await CulturaRepository.actualizarMiPublicacion(id, comercio.id, data);
    } catch (e) {
      if (e.code === "P2025") throw new ErrorNoEncontrado("Publicación no encontrada o no te pertenece");
      throw e;
    }
  },

  async eliminarMiPublicacion(usuarioId, id) {
    const comercio = await prisma.comercio.findUnique({ where: { usuarioId } });
    if (!comercio) throw new ErrorValidacion("No tienes un comercio asociado");

    try {
      return await CulturaRepository.eliminarPublicacion(id, comercio.id);
    } catch (e) {
      if (e.code === "P2025") throw new ErrorNoEncontrado("Publicación no encontrada o no te pertenece");
      throw e;
    }
  },

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
    validarUbicacion(data.departamento, data.municipio);
    if (!data.fechaInicio) throw new ErrorValidacion("La fecha de inicio es obligatoria");
    return prisma.eventoCultural.create({
      data: { ...data, comercioId, fotos: data.fotos ?? [] },
      include: { entradas: true },
    });
  },

  async actualizarEvento(comercioId, eventoId, datos) {
    const eventoActual = await obtenerEventoDelComercio(comercioId, eventoId);
    const data = camposEvento(datos);
    if (data.departamento !== undefined || data.municipio !== undefined) {
      validarUbicacion(
        data.departamento ?? eventoActual.departamento,
        data.municipio ?? eventoActual.municipio
      );
    }
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
    validarUbicacion(data.departamento, data.municipio);
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
  async crearPublicacion(usuarioId, {
    titulo, descripcion, fotoUrls, videoUrl, videoPosterUrl, videoDuracionSegundos, videoPublicId,
    departamento, municipio, comercioId, moduloOrigen, productoId,
  }) {
    if (!titulo?.trim()) throw new ErrorValidacion("El título es obligatorio");
    if (!departamento?.trim()) throw new ErrorValidacion("El departamento es obligatorio");
    if (municipio?.trim()) validarUbicacion(departamento.trim(), municipio.trim());
    const fotos = Array.isArray(fotoUrls) ? fotoUrls.slice(0, 6) : [];
    if (fotos.length === 0 && !videoUrl) {
      throw new ErrorValidacion("Debes adjuntar al menos una foto o un video");
    }

    let comercioIdFinal = null;
    let moduloOrigenFinal = null;
    let comercioParaNotificar = null;
    if (comercioId) {
      const comercio = await prisma.comercio.findUnique({
        where: { id: Number(comercioId) },
        include: { cuentaDispersion: true },
      });
      if (!comercio || comercio.usuarioId !== usuarioId) {
        throw new ErrorProhibido("No puedes publicar en la vitrina de este comercio");
      }
      assertPuedePublicar(comercio);
      if (moduloOrigen !== undefined && moduloOrigen !== null) {
        if (!MODULOS_ORIGEN_VITRINA_VALIDOS.includes(moduloOrigen)) {
          throw new ErrorValidacion(`Módulo inválido. Opciones: ${MODULOS_ORIGEN_VITRINA_VALIDOS.join(", ")}`);
        }
        moduloOrigenFinal = moduloOrigen;
      }
      comercioIdFinal = comercio.id;
      comercioParaNotificar = comercio;
    }

    const publicacion = await CulturaRepository.crearPublicacion({
      autorId: usuarioId,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      fotoUrls: fotos,
      videoUrl: videoUrl || null,
      videoPosterUrl: videoPosterUrl || null,
      videoDuracionSegundos: numeroONull(videoDuracionSegundos),
      videoPublicId: videoPublicId || null,
      departamento: departamento.trim(),
      municipio: municipio?.trim() || null,
      comercioId: comercioIdFinal,
      moduloOrigen: moduloOrigenFinal,
      productoId: productoId ? Number(productoId) : null,
    });

    // Vitrina v0.2: avisa a los seguidores del comercio de la nueva publicación.
    // Fire-and-forget — nunca debe poder tumbar la creación de la publicación.
    if (comercioIdFinal) {
      setImmediate(async () => {
        try {
          const seguidores = await prisma.seguidorComercio.findMany({
            where: { comercioId: comercioIdFinal },
            select: { usuarioId: true },
          });
          const nombreComercio = comercioParaNotificar?.nombre || "Un comercio que sigues";
          for (const seguidor of seguidores) {
            if (seguidor.usuarioId === usuarioId) continue;
            await NotificacionService.crearYEnviar({
              usuarioId: seguidor.usuarioId,
              tipo: "VITRINA_NUEVA_PUBLICACION",
              titulo: `${nombreComercio} publicó algo nuevo`,
              mensaje: publicacion.titulo,
              url: "/vitrina",
            });
          }
        } catch (e) {
          console.error("[VITRINA] Error notificando seguidores:", e.message);
        }
      });
    }

    // Perfil público: avisa a los seguidores de la PERSONA autora de la nueva
    // publicación, tenga o no comercio asociado. Independiente del bloque de
    // arriba (que solo notifica a seguidores del comercio).
    setImmediate(async () => {
      try {
        const seguidoresPersona = await prisma.seguidorUsuario.findMany({
          where: { seguidoId: usuarioId },
          select: { seguidorId: true },
        });
        if (seguidoresPersona.length === 0) return;
        const autor = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } });
        for (const seguidor of seguidoresPersona) {
          await NotificacionService.crearYEnviar({
            usuarioId: seguidor.seguidorId,
            tipo: "PERFIL_NUEVA_PUBLICACION",
            titulo: `${autor?.nombre || "Alguien que sigues"} publicó algo nuevo`,
            mensaje: publicacion.titulo,
            url: comercioIdFinal ? "/vitrina" : "/cultura/galeria",
          });
        }
      } catch (e) {
        console.error("[PERFIL] Error notificando seguidores del autor:", e.message);
      }
    });

    return publicacion;
  },

  async listarPublicaciones(filtros = {}) {
    const resultado = await CulturaRepository.listarPublicaciones(filtros);
    const usuarioId = filtros.usuarioId;

    let siguiendoAutorSet = new Set();
    if (usuarioId) {
      const autorIds = [...new Set(resultado.items.map((p) => p.autor?.id).filter(Boolean))];
      if (autorIds.length > 0) {
        const siguiendo = await prisma.seguidorUsuario.findMany({
          where: { seguidorId: usuarioId, seguidoId: { in: autorIds } },
          select: { seguidoId: true },
        });
        siguiendoAutorSet = new Set(siguiendo.map((s) => s.seguidoId));
      }
    }

    return {
      ...resultado,
      items: resultado.items.map((p) => {
        const { _count, likes, ...resto } = p;
        if (resto.autor) {
          resto.autor.siguiendo = usuarioId ? siguiendoAutorSet.has(resto.autor.id) : false;
          resto.autor.totalSeguidores = resto.autor._count?.seguidoresUsuarios ?? 0;
          delete resto.autor._count;
        }
        return {
          ...resto,
          totalLikes: _count?.likes ?? 0,
          meGusta: Array.isArray(likes) && likes.length > 0,
        };
      }),
    };
  },

  // ── Vitrina de video (v0.2) — ranking heurístico ─────────────────
  // El repository ya no pagina en SQL: trae una ventana acotada (hasta 200)
  // de las publicaciones más recientes. Acá se calcula esFavorito/siguiendo,
  // se les asigna un puntaje heurístico simple (afinidad + engagement +
  // recencia) y RECIÉN ahí se pagina en memoria. Sin usuarioId (visitante
  // anónimo), el puntaje se reduce a recencia+engagement — mismo orden que
  // antes, no rompe el comportamiento para anónimos.
  async listarVitrina(filtros = {}) {
    const resultado = await CulturaRepository.listarVitrina(filtros);
    const usuarioId = filtros.usuarioId;
    const pagina = resultado.pagina;
    const take = Number(filtros.take) || 20;

    let favoritosSet = new Set();
    let siguiendoSet = new Set();
    let afinidadModulos = new Set();
    let siguiendoAutorSet = new Set();

    if (usuarioId && resultado.itemsVentana.length > 0) {
      const publicacionIds = resultado.itemsVentana.map((p) => p.id);
      const comercioIds = [...new Set(resultado.itemsVentana.map((p) => p.comercio?.id).filter(Boolean))];
      const autorIds = [...new Set(resultado.itemsVentana.map((p) => p.autor?.id).filter(Boolean))];

      const [favoritos, seguidores, likesUsuario, favoritosPublicacionesUsuario, vistasUsuario, siguiendoAutores] = await Promise.all([
        prisma.favorito.findMany({
          where: { usuarioId, tipoEntidad: "PUBLICACION_CULTURAL", entidadId: { in: publicacionIds } },
          select: { entidadId: true },
        }),
        comercioIds.length
          ? prisma.seguidorComercio.findMany({
              where: { usuarioId, comercioId: { in: comercioIds } },
              select: { comercioId: true },
            })
          : Promise.resolve([]),
        prisma.likePublicacionCultural.findMany({
          where: { usuarioId },
          select: { publicacionCulturalId: true },
        }),
        prisma.favorito.findMany({
          where: { usuarioId, tipoEntidad: "PUBLICACION_CULTURAL" },
          select: { entidadId: true },
        }),
        prisma.vistaPublicacionCultural.findMany({
          where: { usuarioId },
          select: { publicacionCulturalId: true },
          take: 50,
          orderBy: { createdAt: "desc" },
        }),
        autorIds.length
          ? prisma.seguidorUsuario.findMany({
              where: { seguidorId: usuarioId, seguidoId: { in: autorIds } },
              select: { seguidoId: true },
            })
          : Promise.resolve([]),
      ]);

      favoritosSet = new Set(favoritos.map((f) => f.entidadId));
      siguiendoSet = new Set(seguidores.map((s) => s.comercioId));
      siguiendoAutorSet = new Set(siguiendoAutores.map((s) => s.seguidoId));

      const idsInteractuados = [
        ...new Set([
          ...likesUsuario.map((l) => l.publicacionCulturalId),
          ...favoritosPublicacionesUsuario.map((f) => f.entidadId),
          ...vistasUsuario.map((v) => v.publicacionCulturalId),
        ]),
      ];
      if (idsInteractuados.length > 0) {
        const publicacionesInteractuadas = await prisma.publicacionCultural.findMany({
          where: { id: { in: idsInteractuados } },
          select: { moduloOrigen: true },
        });
        afinidadModulos = new Set(publicacionesInteractuadas.map((p) => p.moduloOrigen).filter(Boolean));
      }
    }

    const itemsMapeados = resultado.itemsVentana.map((p) => {
      const { _count, likes, ...resto } = p;
      mapearComercioVitrina(resto);
      if (resto.comercio) {
        resto.comercio.siguiendo = usuarioId ? siguiendoSet.has(resto.comercio.id) : false;
        resto.comercio.totalSeguidores = resto.comercio._count?.seguidores ?? 0;
        delete resto.comercio._count;
      }
      if (resto.autor) {
        resto.autor.siguiendo = usuarioId ? siguiendoAutorSet.has(resto.autor.id) : false;
        resto.autor.totalSeguidores = resto.autor._count?.seguidoresUsuarios ?? 0;
        delete resto.autor._count;
      }
      return {
        ...resto,
        totalLikes: _count?.likes ?? 0,
        totalComentarios: _count?.comentarios ?? 0,
        totalVistas: _count?.vistas ?? 0,
        meGusta: Array.isArray(likes) && likes.length > 0,
        esFavorito: favoritosSet.has(resto.id),
      };
    });

    // Puntaje heurístico simple y transparente (no es un motor de recomendación real):
    // seguir el comercio pesa más, luego afinidad de módulo, engagement (likes,
    // topeado) y un pequeño empujón a lo reciente. En empate, mantiene el orden
    // de creación (recencia) que ya traía la ventana.
    const itemsConPuntaje = itemsMapeados.map((item, index) => {
      const diasDesdeCreacion = (Date.now() - new Date(item.createdAt).getTime()) / 86400000;
      const puntaje =
        (item.comercio?.siguiendo ? 40 : 0) +
        (item.autor?.siguiendo ? 20 : 0) +
        (afinidadModulos.has(item.moduloOrigen) ? 15 : 0) +
        Math.min(item.totalLikes, 20) +
        Math.max(0, 10 - diasDesdeCreacion);
      return { item, puntaje, index };
    });

    itemsConPuntaje.sort((a, b) => (b.puntaje !== a.puntaje ? b.puntaje - a.puntaje : a.index - b.index));

    const inicio = (pagina - 1) * take;
    const itemsPagina = itemsConPuntaje.slice(inicio, inicio + take).map((x) => x.item);

    // ── Inyección de Anuncios (Video Historia) ──────────────────
    let itemsFinales = itemsPagina;
    if (itemsPagina.length > 0) {
      const configFrecuencia = await prisma.config.findUnique({ where: { clave: "vitrina_frecuencia_anuncios" } });
      const frecuencia = configFrecuencia ? parseInt(configFrecuencia.valor) || 5 : 5;

      const ahora = new Date();
      const campanas = await prisma.anuncioUbicacion.findMany({
        where: {
          activa: true,
          modulo: "VITRINA",
          formato: "VIDEO",
          campana: {
            estado: "ACTIVA",
            inicio: { lte: ahora },
            fin: { gte: ahora },
          },
        },
        include: { campana: true },
      });

      if (campanas.length > 0) {
        itemsFinales = [];
        let contadorAds = 0;
        for (let i = 0; i < itemsPagina.length; i++) {
          itemsFinales.push(itemsPagina[i]);
          const posicionGlobal = inicio + i + 1;
          if (posicionGlobal % frecuencia === 0) {
            const anuncio = campanas[contadorAds % campanas.length];
            contadorAds++;
            itemsFinales.push({
              id: `ad-${anuncio.id}-${posicionGlobal}`, // ID único para React key
              esAnuncio: true,
              campanaId: anuncio.campana.id,
              titulo: anuncio.titulo || anuncio.campana.nombre,
              descripcion: anuncio.subtitulo || "",
              videoUrl: anuncio.mediaUrl,
              imagenUrl: null, // es video
              ctaTexto: anuncio.ctaTexto || "Ver más",
              urlDestino: anuncio.urlDestino,
              etiqueta: anuncio.etiqueta || "Patrocinado",
              comercioId: anuncio.campana.comercioId || null,
              comercio: null,
              autor: null,
              createdAt: anuncio.createdAt,
              totalLikes: 0,
              totalComentarios: 0,
              meGusta: false,
              esFavorito: false,
            });
          }
        }
      }
    }

    return {
      items: itemsFinales,
      total: resultado.total,
      pagina,
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

  // ── REGISTRAR VISTA DE PUBLICACIÓN ──────────────────────────────

  async registrarVista(usuarioId, publicacionId, { sesionId, duracionSegundos } = {}) {
    const publicacion = await CulturaRepository.buscarPublicacionPorId(publicacionId);
    if (!publicacion || !publicacion.activa) throw new ErrorNoEncontrado("Publicación no encontrada");

    return prisma.vistaPublicacionCultural.create({
      data: {
        publicacionCulturalId: publicacionId,
        usuarioId: usuarioId || null,
        sesionId: sesionId || null,
        duracionSegundos: numeroONull(duracionSegundos),
      },
    });
  },

  // ── FAVORITOS DE PUBLICACIONES DE VITRINA ───────────────────────

  async toggleFavoritoPublicacion(usuarioId, publicacionId) {
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "PUBLICACION_CULTURAL", entidadId: publicacionId } },
    });
    if (existe) {
      await prisma.favorito.delete({ where: { id: existe.id } });
      return { esFavorito: false };
    }
    await prisma.favorito.create({ data: { usuarioId, tipoEntidad: "PUBLICACION_CULTURAL", entidadId: publicacionId } });
    return { esFavorito: true };
  },

  // ── COMPARTIDOS Y COMENTARIOS DE PUBLICACIONES ──────────────────────

  async registrarCompartido(publicacionId) {
    const publicacion = await CulturaRepository.buscarPublicacionPorId(publicacionId);
    if (!publicacion || !publicacion.activa) throw new ErrorNoEncontrado("Publicación no encontrada");

    await prisma.publicacionCultural.update({
      where: { id: publicacionId },
      data: { totalCompartidos: { increment: 1 } },
    });
    return { ok: true };
  },

  // Comentarios en hilos: solo un nivel de anidación (como Facebook/Instagram
  // clásico, no hilos infinitos) — se listan los comentarios raíz (fijados
  // primero, luego más recientes) y se les adjuntan sus respuestas en una
  // segunda consulta batched, sin N+1.
  async listarComentarios(publicacionId, { page = 1, limit = 20 } = {}) {
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const where = { publicacionCulturalId: publicacionId, respuestaAId: null };

    const [items, total] = await Promise.all([
      prisma.comentarioPublicacionCultural.findMany({
        where,
        take: Number(limit),
        skip: offset,
        orderBy: [{ fijado: "desc" }, { createdAt: "desc" }],
        include: { usuario: { select: { id: true, nombre: true, avatarUrl: true } } },
      }),
      prisma.comentarioPublicacionCultural.count({ where: { publicacionCulturalId: publicacionId } }),
    ]);

    const raizIds = items.map((c) => c.id);
    const respuestas = raizIds.length
      ? await prisma.comentarioPublicacionCultural.findMany({
          where: { respuestaAId: { in: raizIds } },
          orderBy: { createdAt: "asc" },
          include: { usuario: { select: { id: true, nombre: true, avatarUrl: true } } },
        })
      : [];

    const respuestasPorPadre = new Map();
    for (const r of respuestas) {
      if (!respuestasPorPadre.has(r.respuestaAId)) respuestasPorPadre.set(r.respuestaAId, []);
      respuestasPorPadre.get(r.respuestaAId).push(r);
    }

    const itemsConRespuestas = items.map((c) => ({ ...c, respuestas: respuestasPorPadre.get(c.id) ?? [] }));

    return { items: itemsConRespuestas, total, pagina: Number(page) };
  },

  async crearComentario(usuarioId, publicacionId, { texto, respuestaAId }) {
    const textoValidado = textoLimpio(texto, 1000);
    if (!textoValidado) throw new ErrorValidacion("El comentario no puede estar vacío");

    const publicacion = await CulturaRepository.buscarPublicacionPorId(publicacionId);
    if (!publicacion || !publicacion.activa) throw new ErrorNoEncontrado("Publicación no encontrada");

    let respuestaAIdFinal = null;
    if (respuestaAId) {
      const padre = await prisma.comentarioPublicacionCultural.findUnique({
        where: { id: Number(respuestaAId) },
        select: { id: true, publicacionCulturalId: true, respuestaAId: true },
      });
      if (!padre || padre.publicacionCulturalId !== publicacionId) {
        throw new ErrorValidacion("El comentario al que respondes no existe.");
      }
      // Si responden a una respuesta, se aplana al comentario raíz (mismo
      // límite de un nivel de anidación que usan Facebook/Instagram).
      respuestaAIdFinal = padre.respuestaAId ?? padre.id;
    }

    const comentario = await prisma.comentarioPublicacionCultural.create({
      data: {
        publicacionCulturalId: publicacionId,
        usuarioId,
        texto: textoValidado,
        respuestaAId: respuestaAIdFinal,
      },
      include: { usuario: { select: { id: true, nombre: true, avatarUrl: true } } },
    });

    return comentario;
  },

  // Fijar/desfijar un comentario — solo quien publicó la publicación puede
  // hacerlo (autorId, igual sea publicación personal o de vitrina de un
  // comercio, ya que crearPublicacion siempre guarda al usuario que publicó).
  async toggleFijarComentario(usuarioId, publicacionId, comentarioId) {
    const publicacion = await CulturaRepository.buscarPublicacionPorId(publicacionId);
    if (!publicacion) throw new ErrorNoEncontrado("Publicación no encontrada");
    if (publicacion.autorId !== usuarioId) {
      throw new ErrorProhibido("Solo quien publicó puede fijar comentarios.");
    }

    const comentario = await prisma.comentarioPublicacionCultural.findUnique({
      where: { id: comentarioId },
      select: { id: true, publicacionCulturalId: true, fijado: true, respuestaAId: true },
    });
    if (!comentario || comentario.publicacionCulturalId !== publicacionId) {
      throw new ErrorNoEncontrado("Comentario no encontrado");
    }
    if (comentario.respuestaAId) {
      throw new ErrorValidacion("Solo se pueden fijar comentarios de primer nivel.");
    }

    const actualizado = await prisma.comentarioPublicacionCultural.update({
      where: { id: comentarioId },
      data: { fijado: !comentario.fijado },
    });

    return { fijado: actualizado.fijado };
  },

  // ── FAVORITOS CULTURA ───────────────────────────────────────────

  async toggleFavoritoCultura(usuarioId, eventoCulturalId) {
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "EVENTO_CULTURAL", entidadId: eventoCulturalId } },
    });
    if (existe) {
      await prisma.favorito.delete({ where: { id: existe.id } });
      return { esFavorito: false };
    }
    await prisma.favorito.create({ data: { usuarioId, tipoEntidad: "EVENTO_CULTURAL", entidadId: eventoCulturalId } });
    return { esFavorito: true };
  },

  async misFavoritosCultura(usuarioId) {
    const favs = await prisma.favorito.findMany({
      where: { usuarioId, tipoEntidad: "EVENTO_CULTURAL" },
      orderBy: { createdAt: "desc" },
    });
    if (favs.length === 0) return [];
    const eventos = await prisma.eventoCultural.findMany({
      where: { id: { in: favs.map(f => f.entidadId) } },
      include: EVENTO_INCLUDE,
    });
    const porId = new Map(eventos.map(e => [e.id, e]));
    return favs.map(f => porId.get(f.entidadId)).filter(Boolean);
  },

  async esFavoritoCultura(usuarioId, eventoCulturalId) {
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "EVENTO_CULTURAL", entidadId: eventoCulturalId } },
    });
    return { esFavorito: !!existe };
  },
};

module.exports = CulturaService;
