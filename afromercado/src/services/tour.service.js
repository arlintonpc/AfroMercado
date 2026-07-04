const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");
const { notificarWhatsApp } = require("../utils/notificaciones");
const AlianzaService = require("./alianza.service");

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

const TOUR_LUGAR_INCLUDE = {
  media: {
    where: { activo: true },
    orderBy: [{ orden: "asc" }, { id: "asc" }],
  },
};

const TOUR_DETAIL_INCLUDE = {
  ...TOUR_INCLUDE,
  lugares: {
    where: { activo: true },
    orderBy: [{ orden: "asc" }, { id: "asc" }],
    include: TOUR_LUGAR_INCLUDE,
  },
};

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

function camposLugar(datos = {}) {
  const campos = {
    titulo: textoLimpio(datos.titulo, 120),
    descripcion: textoLimpio(datos.descripcion, 1000),
    tipo: textoLimpio(datos.tipo, 60),
    orden: datos.orden === undefined ? undefined : Number(datos.orden),
    duracionMinutos: numeroONull(datos.duracionMinutos),
    recomendaciones: textoLimpio(datos.recomendaciones, 700),
    latitud: numeroONull(datos.latitud),
    longitud: numeroONull(datos.longitud),
    destacado: boolOpcional(datos.destacado),
  };
  // rutaNombre: solo incluir si fue enviado explícitamente
  // Prisma rechaza campos desconocidos si el cliente no fue regenerado aún
  if ("rutaNombre" in datos) {
    campos.rutaNombre = textoLimpio(datos.rutaNombre, 80) ?? null;
  }
  return campos;
}

function camposConfigTour(datos = {}) {
  const data = {
    activo: boolOpcional(datos.activo),
    nombre: textoLimpio(datos.nombre, 140),
    descripcion: textoLimpio(datos.descripcion, 4000),
    duracionHoras: numeroONull(datos.duracionHoras),
    precioPersona: numeroONull(datos.precioPersona),
    maxParticipantes: numeroONull(datos.maxParticipantes),
    puntoEncuentro: textoLimpio(datos.puntoEncuentro, 500),
    confirmacionAuto: boolOpcional(datos.confirmacionAuto),
    horasLimiteConfirm: numeroONull(datos.horasLimiteConfirm),
    politicaCancelacion: textoLimpio(datos.politicaCancelacion, 1200),
    videoUrl: textoLimpio(datos.videoUrl, 1000),
    videoPosterUrl: textoLimpio(datos.videoPosterUrl, 1000),
  };

  if (Array.isArray(datos.fotos)) data.fotos = datos.fotos;
  if (Array.isArray(datos.servicios)) data.servicios = datos.servicios;
  if (Array.isArray(datos.idiomas)) data.idiomas = datos.idiomas;

  return limpiarUndefined(data);
}

function limpiarUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, valor]) => valor !== undefined));
}

function validarUrlPublica(url) {
  if (!url || !String(url).trim()) throw new ErrorValidacion("La URL del video es requerida");
  let parsed;
  try {
    parsed = new URL(String(url).trim());
  } catch (_) {
    throw new ErrorValidacion("La URL del video no es valida");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ErrorValidacion("Solo se permiten enlaces http o https");
  }
  return parsed.toString();
}

function detectarPlataforma(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("youtube.com") || host === "youtu.be") return "YOUTUBE";
    if (host.includes("instagram.com")) return "INSTAGRAM";
    if (host.includes("tiktok.com")) return "TIKTOK";
    if (host.includes("facebook.com") || host === "fb.watch") return "FACEBOOK";
    if (host.includes("vimeo.com")) return "VIMEO";
    return "WEB";
  } catch (_) {
    return "WEB";
  }
}

async function obtenerTourComercio(comercioId) {
  const tour = await prisma.configTour.findUnique({ where: { comercioId } });
  if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");
  return tour;
}

async function obtenerLugarDelComercio(comercioId, lugarId) {
  const lugar = await prisma.tourLugar.findFirst({
    where: { id: Number(lugarId), activo: true, configTour: { comercioId } },
    include: { configTour: true },
  });
  if (!lugar) throw new ErrorNoEncontrado("Lugar del tour no encontrado");
  return lugar;
}

// Acepta tanto el cliente prisma normal como un `tx` de prisma.$transaction,
// para poder reutilizarla dentro de crearReserva sin duplicar la lógica de conteo.
async function verificarDisponibilidadInterna(cliente, configTourId, fecha) {
  const tour = await cliente.configTour.findUnique({ where: { id: configTourId } });
  if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");

  const fechaD = new Date(fecha);
  const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
  const fin    = new Date(fechaD); fin.setHours(23, 59, 59, 999);

  const totalParticipantes = await cliente.reservaTour.aggregate({
    where: {
      configTourId,
      fechaTour: { gte: inicio, lte: fin },
      estado: { in: ["PENDIENTE", "CONFIRMADA"] },
    },
    _sum: { participantes: true },
  });
  const ocupados = totalParticipantes._sum.participantes ?? 0;
  return { disponibles: Math.max(0, tour.maxParticipantes - ocupados), maxParticipantes: tour.maxParticipantes };
}

const TourService = {
  async listarTours({ municipio, departamento } = {}) {
    const comercioWhere = { verificado: true };
    if (municipio) comercioWhere.municipio = { contains: municipio, mode: "insensitive" };
    if (departamento) comercioWhere.departamento = { contains: departamento, mode: "insensitive" };

    return prisma.configTour.findMany({
      where: { activo: true, comercio: comercioWhere },
      include: TOUR_DETAIL_INCLUDE,
      orderBy: { creadoAt: "desc" },
    });
  },

  async obtenerTour(id) {
    const tour = await prisma.configTour.findUnique({
      where: { id },
      include: TOUR_DETAIL_INCLUDE,
    });
    if (!tour) throw new ErrorNoEncontrado("Tour no encontrado");
    return tour;
  },

  async verificarDisponibilidad(configTourId, fecha) {
    return verificarDisponibilidadInterna(prisma, configTourId, fecha);
  },

  async crearReserva(clienteId, { configTourId, fechaTour, participantes, metodoPago, notasCliente, nombreContacto, telefonoContacto, codigoCupon }) {
    const cantidadParticipantes = Number(participantes);
    if (!Number.isFinite(cantidadParticipantes) || cantidadParticipantes < 1) {
      throw new ErrorValidacion("La cantidad de participantes no es válida");
    }

    const { reserva, tour, cuponAplicado } = await prisma.$transaction(async (tx) => {
      // bloquea la fila del tour para serializar reservas concurrentes sobre el mismo cupo
      await tx.$queryRaw`SELECT id FROM "ConfigTour" WHERE id = ${configTourId} FOR UPDATE`;

      const tour = await tx.configTour.findUnique({ where: { id: configTourId }, include: TOUR_INCLUDE });
      if (!tour || !tour.activo) throw new ErrorValidacion("Tour no disponible");

      const disp = await verificarDisponibilidadInterna(tx, configTourId, fechaTour);
      if (disp.disponibles < cantidadParticipantes) {
        throw new ErrorValidacion(
          disp.disponibles > 0
            ? `Solo quedan ${disp.disponibles} cupo(s) disponibles para esta fecha`
            : "No quedan cupos disponibles para esta fecha"
        );
      }

      const total = Number(tour.precioPersona) * cantidadParticipantes;

      let montoDescuento = 0;
      let cuponAplicado = null;
      let cuponEsAlianza = false;
      if (codigoCupon) {
        try {
          const validacion = await TourService.validarCuponTour(codigoCupon, tour.id, cantidadParticipantes, clienteId, tour.comercioId);
          montoDescuento = validacion.descuento;
          cuponAplicado = validacion.cupon;
          cuponEsAlianza = !!validacion.esAlianza;
        } catch (e) { /* cupón inválido, ignorar */ }
      }
      const totalFinal = Number(total) - montoDescuento;
      const comision = Math.round(totalFinal * TASA_COMISION_TOUR);

      const estado = tour.confirmacionAuto ? "CONFIRMADA" : "PENDIENTE";

      const reserva = await tx.reservaTour.create({
        data: {
          codigo: generarCodigo(),
          configTourId,
          clienteId,
          fechaTour: new Date(fechaTour),
          participantes: cantidadParticipantes,
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

      // Un descuento de alianza no tiene fila CuponTour propia que actualizar.
      if (cuponAplicado && !cuponEsAlianza) {
        await tx.cuponTourUso.create({
          data: { cuponTourId: cuponAplicado.id, clienteId, reservaTourId: reserva.id },
        });
        await tx.cuponTour.update({
          where: { id: cuponAplicado.id },
          data: { usosActuales: { increment: 1 } },
        });
      }

      return { reserva, tour, cuponAplicado };
    });

    // Notificar al operador del tour
    const operadorId = await prisma.comercio.findUnique({
      where: { id: tour.comercioId }, select: { usuarioId: true },
    }).then(c => c?.usuarioId);

    if (operadorId) {
      await notifTour(operadorId, "🗺️ Nueva reserva de tour", `${nombreContacto} reservó ${reserva.participantes} cupo(s) para ${tour.nombre}`, "/comerciante/tours");
    }
    if (reserva.estado === "CONFIRMADA") {
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
            `Participantes: ${reserva.participantes}\n` +
            `Total: $${Number(reserva.total).toLocaleString('es-CO')}\n` +
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
    const tour = await prisma.configTour.findUnique({ where: { comercioId }, include: TOUR_DETAIL_INCLUDE });
    if (!tour) {
      return prisma.configTour.create({
        data: { comercioId, nombre: "Mi Tour", precioPersona: 0, fotos: [], servicios: [], idiomas: [] },
        include: TOUR_DETAIL_INCLUDE,
      });
    }
    return tour;
  },

  async actualizarTour(comercioId, datos) {
    const data = camposConfigTour(datos);
    return prisma.configTour.update({ where: { comercioId }, data: { ...data, updatedAt: new Date() } });
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
    const fotosActuales = Array.isArray(tour.fotos) ? tour.fotos : [];
    return prisma.configTour.update({
      where: { comercioId },
      data: { fotos: [...fotosActuales, ...urls], updatedAt: new Date() },
    });
  },

  // Ruta / lugares del tour
  async lugaresTour(comercioId) {
    const tour = await obtenerTourComercio(comercioId);
    return prisma.tourLugar.findMany({
      where: { configTourId: tour.id, activo: true },
      include: TOUR_LUGAR_INCLUDE,
      orderBy: [{ orden: "asc" }, { id: "asc" }],
    });
  },

  async crearLugarTour(comercioId, datos) {
    const tour = await obtenerTourComercio(comercioId);
    const total = await prisma.tourLugar.count({ where: { configTourId: tour.id, activo: true } });
    if (total >= 30) throw new ErrorValidacion("Puedes publicar hasta 30 lugares por tour");

    const data = limpiarUndefined(camposLugar(datos));
    if (!data.titulo) throw new ErrorValidacion("El nombre del lugar es requerido");

    const ultimo = await prisma.tourLugar.findFirst({
      where: { configTourId: tour.id },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    return prisma.tourLugar.create({
      data: {
        ...data,
        orden: Number.isFinite(data.orden) ? data.orden : (ultimo?.orden ?? -1) + 1,
        configTourId: tour.id,
      },
      include: TOUR_LUGAR_INCLUDE,
    });
  },

  async actualizarLugarTour(comercioId, lugarId, datos) {
    await obtenerLugarDelComercio(comercioId, lugarId);
    const data = limpiarUndefined(camposLugar(datos));
    if (data.titulo !== undefined && !data.titulo) {
      throw new ErrorValidacion("El nombre del lugar es requerido");
    }
    return prisma.tourLugar.update({
      where: { id: Number(lugarId) },
      data: { ...data, updatedAt: new Date() },
      include: TOUR_LUGAR_INCLUDE,
    });
  },

  async eliminarLugarTour(comercioId, lugarId) {
    await obtenerLugarDelComercio(comercioId, lugarId);
    return prisma.$transaction(async (tx) => {
      await tx.tourLugarMedia.updateMany({
        where: { tourLugarId: Number(lugarId) },
        data: { activo: false, updatedAt: new Date() },
      });
      return tx.tourLugar.update({
        where: { id: Number(lugarId) },
        data: { activo: false, updatedAt: new Date() },
      });
    });
  },

  async reordenarLugaresTour(comercioId, ids = []) {
    const tour = await obtenerTourComercio(comercioId);
    const lugarIds = ids.map((id) => Number(id)).filter(Boolean);
    if (!lugarIds.length) throw new ErrorValidacion("Debes enviar el orden de los lugares");

    const existentes = await prisma.tourLugar.findMany({
      where: { configTourId: tour.id, activo: true, id: { in: lugarIds } },
      select: { id: true },
    });
    if (existentes.length !== lugarIds.length) {
      throw new ErrorValidacion("El orden incluye lugares invalidos");
    }

    await prisma.$transaction(
      lugarIds.map((id, index) => prisma.tourLugar.update({ where: { id }, data: { orden: index } })),
    );
    return TourService.lugaresTour(comercioId);
  },

  async agregarFotosLugar(comercioId, lugarId, urls) {
    const lugar = await obtenerLugarDelComercio(comercioId, lugarId);
    const actuales = await prisma.tourLugarMedia.count({
      where: { tourLugarId: lugar.id, tipo: "FOTO", activo: true },
    });
    if (actuales + urls.length > 24) throw new ErrorValidacion("Cada lugar puede tener hasta 24 fotos");

    await prisma.tourLugarMedia.createMany({
      data: urls.map((url, index) => ({
        tourLugarId: lugar.id,
        tipo: "FOTO",
        url,
        orden: actuales + index,
      })),
    });

    return prisma.tourLugar.findUnique({ where: { id: lugar.id }, include: TOUR_LUGAR_INCLUDE });
  },

  async eliminarMediaLugar(comercioId, lugarId, mediaId) {
    const lugar = await obtenerLugarDelComercio(comercioId, lugarId);
    const media = await prisma.tourLugarMedia.findFirst({
      where: { id: Number(mediaId), tourLugarId: lugar.id, activo: true },
    });
    if (!media) throw new ErrorNoEncontrado("Media del lugar no encontrada");
    await prisma.tourLugarMedia.update({
      where: { id: media.id },
      data: { activo: false, updatedAt: new Date() },
    });
    return prisma.tourLugar.findUnique({ where: { id: lugar.id }, include: TOUR_LUGAR_INCLUDE });
  },

  async subirVideoLugar(comercioId, lugarId, video) {
    const lugar = await obtenerLugarDelComercio(comercioId, lugarId);
    const orden = await prisma.tourLugarMedia.count({ where: { tourLugarId: lugar.id, activo: true } });
    return prisma.$transaction(async (tx) => {
      await tx.tourLugarMedia.updateMany({
        where: { tourLugarId: lugar.id, tipo: "VIDEO", activo: true },
        data: { activo: false, updatedAt: new Date() },
      });
      await tx.tourLugarMedia.create({
        data: {
          tourLugarId: lugar.id,
          tipo: "VIDEO",
          url: video.videoUrl,
          posterUrl: video.posterUrl || null,
          titulo: textoLimpio(video.titulo, 120),
          descripcion: textoLimpio(video.descripcion, 500),
          orden,
          publicId: video.publicId || null,
          duracionSegundos: numeroONull(video.duracion),
          bytes: video.bytes ? Number(video.bytes) : null,
          formato: video.formato || null,
          mimeType: video.mimeType || null,
        },
      });
      return tx.tourLugar.findUnique({ where: { id: lugar.id }, include: TOUR_LUGAR_INCLUDE });
    });
  },

  async quitarVideoLugar(comercioId, lugarId) {
    const lugar = await obtenerLugarDelComercio(comercioId, lugarId);
    await prisma.tourLugarMedia.updateMany({
      where: { tourLugarId: lugar.id, tipo: "VIDEO", activo: true },
      data: { activo: false, updatedAt: new Date() },
    });
    return prisma.tourLugar.findUnique({ where: { id: lugar.id }, include: TOUR_LUGAR_INCLUDE });
  },

  async guardarVideoLinkLugar(comercioId, lugarId, datos) {
    const lugar = await obtenerLugarDelComercio(comercioId, lugarId);
    const url = validarUrlPublica(datos.url || datos.videoUrl);
    const enlaces = await prisma.tourLugarMedia.count({
      where: { tourLugarId: lugar.id, tipo: "VIDEO_LINK", activo: true },
    });
    if (enlaces >= 8) throw new ErrorValidacion("Cada lugar puede tener hasta 8 enlaces de video");

    await prisma.tourLugarMedia.create({
      data: {
        tourLugarId: lugar.id,
        tipo: "VIDEO_LINK",
        url,
        titulo: textoLimpio(datos.titulo, 120),
        descripcion: textoLimpio(datos.descripcion, 500),
        plataforma: textoLimpio(datos.plataforma, 40) || detectarPlataforma(url),
        orden: await prisma.tourLugarMedia.count({ where: { tourLugarId: lugar.id, activo: true } }),
      },
    });
    return prisma.tourLugar.findUnique({ where: { id: lugar.id }, include: TOUR_LUGAR_INCLUDE });
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

  async validarCuponTour(codigo, configTourId, participantes, clienteId, comercioId) {
    const cupon = await prisma.cuponTour.findFirst({
      where: {
        codigo: codigo.trim().toUpperCase(),
        activo: true,
        fin:    { gte: new Date() },
        inicio: { lte: new Date() },
        OR: [{ configTourId: null }, { configTourId }],
      },
    });
    if (!cupon) {
      // Fallback: no es un CuponTour propio, ¿es un código de alianza
      // comercial vigente para este comercio en el módulo TOUR?
      if (comercioId) {
        const alianza = await AlianzaService.validarCodigoAlianza(codigo, comercioId, "TOUR");
        if (alianza) {
          const tourAlianza = await prisma.configTour.findUnique({ where: { id: configTourId } });
          const subtotalAlianza = Number(tourAlianza.precioPersona) * participantes;
          const descuentoAlianza = alianza.tipoDescuento === "PORCENTAJE"
            ? Math.round(subtotalAlianza * Number(alianza.valorDescuento) / 100)
            : Math.min(Number(alianza.valorDescuento), subtotalAlianza);
          return {
            cupon: { codigo: String(codigo).trim().toUpperCase() },
            descuento: descuentoAlianza,
            subtotalConDescuento: subtotalAlianza - descuentoAlianza,
            esAlianza: true,
          };
        }
      }
      throw new ErrorValidacion("Cupón inválido o expirado");
    }
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

  async estadisticasTour(comercioId, { desde, hasta } = {}) {
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

    const resultado = {
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

    // Rango de fechas puntual (opcional, para consultas contables)
    if (desde && hasta) {
      const inicioRango = new Date(`${desde}T00:00:00-05:00`);
      const finRango = new Date(`${hasta}T23:59:59-05:00`);

      const rangoStats = await prisma.reservaTour.aggregate({
        where: { configTourId: tour.id, estado: { in: ["CONFIRMADA", "COMPLETADA"] }, creadoAt: { gte: inicioRango, lte: finRango } },
        _count: { id: true },
        _sum: { total: true, comision: true, participantes: true },
      });

      resultado.rango = {
        reservas: rangoStats._count.id,
        ingresos: Number(rangoStats._sum.total ?? 0),
        comision: Number(rangoStats._sum.comision ?? 0),
        participantes: rangoStats._sum.participantes ?? 0,
        desde,
        hasta,
      };
    }

    return resultado;
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

  async guardarVideoLinkTour(comercioId, videoUrl) {
    return prisma.configTour.update({ where: { comercioId }, data: { videoUrl, videoPosterUrl: null } });
  },
};

module.exports = TourService;
