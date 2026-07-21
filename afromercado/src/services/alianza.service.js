// ============================================================
//  Alianzas comerciales — cupón compartido entre comercios de
//  distintos módulos (Express, Hotel, Tour, Transporte, Pedido).
//
//  Caso de uso: un restaurante + un hotel + un transportador se
//  unen bajo un solo código de descuento para atraer turismo a
//  su región. Cada socio define su propio % o valor de descuento;
//  cada socio debe aceptar unirse voluntariamente; un admin aprueba
//  la publicación antes de que el código sea válido en checkout.
// ============================================================
const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const { validarUbicacion } = require("../utils/ubicacion");

const MODULOS_VALIDOS = ["PEDIDO", "EXPRESS", "HOTEL", "TOUR", "TRANSPORTE"];
const TIPOS_DESCUENTO_VALIDOS = ["PORCENTAJE", "VALOR_FIJO"];
const DIAS_MINIMOS_PARA_RETIRO = 7;

function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 20);
}

function sufijoAleatorio(len = 4) {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, len);
}

async function generarCodigoUnico(nombre) {
  const base = slugify(nombre) || "ALIANZA";
  // Primer intento: slug limpio. Si colisiona, agrega sufijo aleatorio (hasta 5 intentos).
  for (let intento = 0; intento < 5; intento++) {
    const candidato = intento === 0 ? base : `${base}-${sufijoAleatorio()}`;
    const existe = await prisma.alianzaComercial.findUnique({ where: { codigoCompartido: candidato } });
    if (!existe) return candidato;
  }
  // Fallback extremo: timestamp para garantizar unicidad
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

function validarModulo(modulo) {
  if (!MODULOS_VALIDOS.includes(modulo)) {
    throw new ErrorValidacion(`Módulo inválido. Debe ser uno de: ${MODULOS_VALIDOS.join(", ")}`);
  }
}

function validarTipoDescuento(tipo) {
  if (tipo && !TIPOS_DESCUENTO_VALIDOS.includes(tipo)) {
    throw new ErrorValidacion(`Tipo de descuento inválido. Debe ser uno de: ${TIPOS_DESCUENTO_VALIDOS.join(", ")}`);
  }
}

async function obtenerComercioVerificado(comercioId) {
  const comercio = await prisma.comercio.findUnique({ where: { id: Number(comercioId) } });
  if (!comercio) throw new ErrorNoEncontrado("Comercio no encontrado");
  if (!comercio.verificado) {
    throw new ErrorValidacion("Solo comercios verificados pueden participar en alianzas comerciales");
  }
  return comercio;
}

const ALIANZA_INCLUDE = {
  socios: {
    include: { comercio: { select: { id: true, nombre: true, municipio: true, departamento: true } } },
  },
};

// Mapa módulo → nombre de la relación de configuración en el modelo Comercio.
// "PEDIDO" no tiene config propia (el marketplace general se enlaza por comercioId).
const RELACION_CONFIG_POR_MODULO = {
  EXPRESS: "configExpress",
  HOTEL: "configHotel",
  TOUR: "configTour",
  TRANSPORTE: "configTransporte",
};

/** Id de la fila de configuración del módulo del socio, o null si no aplica/no existe. */
function moduloConfigId(modulo, comercioConConfigs) {
  const relacion = RELACION_CONFIG_POR_MODULO[modulo];
  if (!relacion) return null;
  return comercioConConfigs?.[relacion]?.id ?? null;
}

async function obtenerAlianzaOwned(alianzaId, comercioId) {
  // "Owned" = el comercio participa en la alianza (creador o socio, aceptado o no) — se usa
  // para las rutas de gestión donde el comercio necesita ver/actuar sobre su propia fila.
  const alianza = await prisma.alianzaComercial.findUnique({
    where: { id: Number(alianzaId) },
    include: ALIANZA_INCLUDE,
  });
  if (!alianza) throw new ErrorNoEncontrado("Alianza no encontrada");
  const esCreador = alianza.creadoPorComercioId === Number(comercioId);
  const miFila = alianza.socios.find((s) => s.comercioId === Number(comercioId));
  if (!esCreador && !miFila) throw new ErrorProhibido("No tienes acceso a esta alianza");
  return alianza;
}

const AlianzaService = {
  // ── COMERCIO ─────────────────────────────────────────────────

  /**
   * Crea una alianza en estado PENDIENTE_APROBACION. Solo comercios verificados
   * pueden crear. El creador se auto-agrega como el primer AlianzaSocio con
   * aceptado=true (no necesita aceptarse a sí mismo).
   *
   * Decisión de criterio: el creador también debe indicar su propio `modulo` +
   * descuento en la misma llamada (es, en la práctica, el primer socio), porque
   * una alianza sin al menos un socio aceptado no tiene sentido de negocio.
   */
  async crearAlianza(comercioId, datos = {}) {
    const { nombre, descripcion, departamento, municipio, inicio, fin, modulo, tipoDescuento, valorDescuento } = datos;

    if (!nombre || !String(nombre).trim()) throw new ErrorValidacion("El nombre de la alianza es obligatorio");
    if (!inicio || !fin) throw new ErrorValidacion("La fecha de inicio y fin son obligatorias");
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
      throw new ErrorValidacion("Fechas inválidas");
    }
    if (fechaFin <= fechaInicio) throw new ErrorValidacion("La fecha de fin debe ser posterior a la de inicio");

    validarModulo(modulo);
    validarTipoDescuento(tipoDescuento);
    const valor = Number(valorDescuento);
    if (!Number.isFinite(valor) || valor <= 0) throw new ErrorValidacion("El valor del descuento no es válido");
    if (departamento && String(departamento).trim() && municipio && String(municipio).trim()) {
      validarUbicacion(String(departamento).trim(), String(municipio).trim());
    }

    await obtenerComercioVerificado(comercioId);

    const codigoCompartido = await generarCodigoUnico(nombre);

    const alianza = await prisma.alianzaComercial.create({
      data: {
        nombre: String(nombre).trim().slice(0, 160),
        descripcion: descripcion ? String(descripcion).trim().slice(0, 2000) : null,
        departamento: departamento || null,
        municipio: municipio || null,
        codigoCompartido,
        estado: "PENDIENTE_APROBACION",
        inicio: fechaInicio,
        fin: fechaFin,
        creadoPorComercioId: Number(comercioId),
        socios: {
          create: {
            comercioId: Number(comercioId),
            modulo,
            tipoDescuento: tipoDescuento || "PORCENTAJE",
            valorDescuento: valor,
            aceptado: true,
            aceptadoAt: new Date(),
          },
        },
      },
      include: ALIANZA_INCLUDE,
    });

    NotificacionService.alianzaCreada({ alianza }).catch((e) => console.error("[ALIANZA] notificar admins:", e.message));

    return alianza;
  },

  /**
   * Invita a otro comercio a unirse a la alianza como socio en un módulo dado.
   *
   * Decisión de criterio: permito que invite tanto el creador como cualquier
   * socio ya aceptado (no solo el creador). Razón: el caso de uso descrito es
   * una coalición horizontal entre pares (restaurante + hotel + transportador);
   * exigir que todas las invitaciones pasen por el creador original añade
   * fricción sin beneficio de seguridad real, porque de todas formas cada
   * invitado debe aceptar voluntariamente antes de que cuente para nada.
   */
  async invitarSocio(comercioId, alianzaId, datos = {}) {
    const alianza = await obtenerAlianzaOwned(alianzaId, comercioId);
    const miFila = alianza.socios.find((s) => s.comercioId === Number(comercioId));
    const esCreador = alianza.creadoPorComercioId === Number(comercioId);
    if (!esCreador && !(miFila && miFila.aceptado)) {
      throw new ErrorProhibido("Solo el creador o un socio ya aceptado puede invitar nuevos socios");
    }
    if (!["PENDIENTE_APROBACION", "PUBLICADA"].includes(alianza.estado)) {
      throw new ErrorValidacion("No se pueden invitar socios a una alianza rechazada o despublicada");
    }

    const { comercioId: invitadoId, modulo, tipoDescuento, valorDescuento } = datos;
    if (!invitadoId) throw new ErrorValidacion("Falta el comercioId del comercio a invitar");
    validarModulo(modulo);
    validarTipoDescuento(tipoDescuento);
    const valor = Number(valorDescuento);
    if (!Number.isFinite(valor) || valor <= 0) throw new ErrorValidacion("El valor del descuento no es válido");

    await obtenerComercioVerificado(invitadoId);

    const yaExiste = await prisma.alianzaSocio.findUnique({
      where: { alianzaId_comercioId_modulo: { alianzaId: alianza.id, comercioId: Number(invitadoId), modulo } },
    });
    if (yaExiste) throw new ErrorValidacion("Ese comercio ya tiene una invitación (o membresía) en ese módulo para esta alianza");

    return prisma.alianzaSocio.create({
      data: {
        alianzaId: alianza.id,
        comercioId: Number(invitadoId),
        modulo,
        tipoDescuento: tipoDescuento || "PORCENTAJE",
        valorDescuento: valor,
        aceptado: false,
      },
      include: { comercio: { select: { id: true, nombre: true, municipio: true } } },
    });
  },

  /**
   * El comercio invitado acepta su propia invitación.
   */
  async aceptarInvitacion(comercioId, alianzaId) {
    const socio = await prisma.alianzaSocio.findFirst({
      where: { alianzaId: Number(alianzaId), comercioId: Number(comercioId) },
    });
    if (!socio) throw new ErrorNoEncontrado("No tienes una invitación pendiente en esta alianza");
    if (socio.aceptado) return socio; // idempotente
    return prisma.alianzaSocio.update({
      where: { id: socio.id },
      data: { aceptado: true, aceptadoAt: new Date() },
    });
  },

  /**
   * Rechaza una invitación pendiente (borra la fila) o, si ya estaba aceptada,
   * se retira de una alianza publicada (marca activo=false), respetando la
   * regla de buena fe de los últimos 7 días de vigencia.
   */
  async rechazarOSalir(comercioId, alianzaId) {
    const socio = await prisma.alianzaSocio.findFirst({
      where: { alianzaId: Number(alianzaId), comercioId: Number(comercioId) },
      include: { alianza: true },
    });
    if (!socio) throw new ErrorNoEncontrado("No participas en esta alianza");

    // Invitación aún no aceptada: simplemente se elimina (rechazo limpio).
    if (!socio.aceptado) {
      await prisma.alianzaSocio.delete({ where: { id: socio.id } });
      return { ok: true, accion: "RECHAZADA" };
    }

    // Ya era socio aceptado: retiro de una alianza en curso.
    if (!socio.activo) return { ok: true, accion: "YA_RETIRADO" }; // idempotente

    // TODO(pendiente): verificar si la alianza está anclada a un evento de
    // Cultura en curso (EventoCultural). Fuera de alcance por ahora — cuando
    // se implemente, un socio no debería poder retirarse mientras el evento
    // ancla esté "EN_CURSO"/publicado y en fechas activas.
    const diasParaFin = (new Date(socio.alianza.fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (socio.alianza.estado === "PUBLICADA" && diasParaFin < DIAS_MINIMOS_PARA_RETIRO && diasParaFin > 0) {
      throw new ErrorValidacion(
        `No puedes retirarte en los últimos ${DIAS_MINIMOS_PARA_RETIRO} días de vigencia de la alianza.`
      );
    }

    await prisma.alianzaSocio.update({ where: { id: socio.id }, data: { activo: false } });
    return { ok: true, accion: "RETIRADO" };
  },

  /**
   * Lista las alianzas donde el comercio participa (como creador o socio,
   * aceptadas o pendientes).
   */
  async misAlianzas(comercioId) {
    return prisma.alianzaComercial.findMany({
      where: {
        OR: [{ creadoPorComercioId: Number(comercioId) }, { socios: { some: { comercioId: Number(comercioId) } } }],
      },
      include: ALIANZA_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  },

  // ── PÚBLICO (página de descubrimiento) ────────────────────────

  /**
   * Devuelve la alianza publicada por su código, junto con los socios
   * aceptados y activos (nombre + módulo). No expone el % / valor de
   * descuento de cada socio: ese detalle se revela recién en el checkout
   * del módulo correspondiente (vía validarCodigoAlianza), para evitar que
   * la página pública se use como catálogo de comparación de descuentos
   * entre comercios competidores.
   *
   * Para que el frontend pueda enlazar a la página pública de cada socio
   * (p. ej. /hoteles/[configHotelId]), se incluye también el id de la fila
   * de configuración del módulo correspondiente (`moduloConfigId`), cuando
   * ese comercio la tiene creada. Es null si el comercio aún no configuró
   * ese módulo (caso borde poco común: un socio invitado en un módulo que
   * luego no activó).
   */
  async obtenerPorCodigoPublico(codigo) {
    const alianza = await prisma.alianzaComercial.findUnique({
      where: { codigoCompartido: String(codigo).trim().toUpperCase() },
      include: {
        socios: {
          where: { aceptado: true, activo: true },
          include: {
            comercio: {
              select: {
                id: true,
                nombre: true,
                municipio: true,
                departamento: true,
                logoUrl: true,
                configExpress: { select: { id: true } },
                configHotel: { select: { id: true } },
                configTour: { select: { id: true } },
                configTransporte: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!alianza || alianza.estado !== "PUBLICADA") throw new ErrorNoEncontrado("Alianza no encontrada");

    return {
      id: alianza.id,
      nombre: alianza.nombre,
      descripcion: alianza.descripcion,
      departamento: alianza.departamento,
      municipio: alianza.municipio,
      codigoCompartido: alianza.codigoCompartido,
      inicio: alianza.inicio,
      fin: alianza.fin,
      socios: alianza.socios.map((s) => ({
        comercioId: s.comercio.id,
        nombre: s.comercio.nombre,
        municipio: s.comercio.municipio,
        departamento: s.comercio.departamento,
        logoUrl: s.comercio.logoUrl,
        modulo: s.modulo,
        moduloConfigId: moduloConfigId(s.modulo, s.comercio),
      })),
    };
  },

  /**
   * Lista alianzas PUBLICADAS que coinciden con una región (departamento y/o
   * municipio) y cuya vigencia cubre una fecha dada. Pensado para que otros
   * módulos (p. ej. Cultura) puedan sugerir "aliados para tu visita" cerca de
   * un evento, sin exponer el código completo de búsqueda por texto libre.
   *
   * Coincidencia de región: alianza.departamento === departamento (si se pasó)
   * O alianza.municipio === municipio (si se pasó). Si no se pasa ninguno de
   * los dos, no se filtra por región (devuelve solo por vigencia de fecha).
   * Vigencia: inicio <= fecha <= fin (si se pasó fecha; si no, usa "ahora").
   *
   * Devuelve una lista liviana (sin socios) para tarjetas simples de
   * descubrimiento; el detalle completo se pide después via /codigo/:codigo.
   */
  async listarPorRegion({ departamento, municipio, fecha } = {}) {
    const fechaRef = fecha ? new Date(fecha) : new Date();
    if (Number.isNaN(fechaRef.getTime())) throw new ErrorValidacion("Fecha inválida");

    const filtroRegion = [];
    if (departamento) filtroRegion.push({ departamento: String(departamento).trim() });
    if (municipio) filtroRegion.push({ municipio: String(municipio).trim() });

    const alianzas = await prisma.alianzaComercial.findMany({
      where: {
        estado: "PUBLICADA",
        inicio: { lte: fechaRef },
        fin: { gte: fechaRef },
        ...(filtroRegion.length > 0 ? { OR: filtroRegion } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        departamento: true,
        municipio: true,
        codigoCompartido: true,
        inicio: true,
        fin: true,
      },
    });

    return alianzas;
  },

  // ── ADMIN ────────────────────────────────────────────────────

  async adminListar({ estado } = {}) {
    return prisma.alianzaComercial.findMany({
      where: estado ? { estado } : {},
      include: ALIANZA_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  },

  async adminAprobar(adminId, alianzaId) {
    const alianza = await prisma.alianzaComercial.findUnique({
      where: { id: Number(alianzaId) },
      include: ALIANZA_INCLUDE,
    });
    if (!alianza) throw new ErrorNoEncontrado("Alianza no encontrada");
    if (alianza.estado !== "PENDIENTE_APROBACION") {
      throw new ErrorValidacion("Solo se puede aprobar una alianza en estado PENDIENTE_APROBACION");
    }
    const sociosAceptados = alianza.socios.filter((s) => s.aceptado);
    if (sociosAceptados.length < 2) {
      throw new ErrorValidacion("La alianza necesita al menos 2 socios aceptados para poder publicarse");
    }
    return prisma.alianzaComercial.update({
      where: { id: alianza.id },
      data: { estado: "PUBLICADA", aprobadoPor: Number(adminId), aprobadoAt: new Date(), motivoRechazo: null },
      include: ALIANZA_INCLUDE,
    });
  },

  async adminRechazar(adminId, alianzaId, motivoRechazo) {
    if (!motivoRechazo || !String(motivoRechazo).trim()) {
      throw new ErrorValidacion("El motivo del rechazo es obligatorio");
    }
    const alianza = await prisma.alianzaComercial.findUnique({ where: { id: Number(alianzaId) } });
    if (!alianza) throw new ErrorNoEncontrado("Alianza no encontrada");
    if (alianza.estado !== "PENDIENTE_APROBACION") {
      throw new ErrorValidacion("Solo se puede rechazar una alianza en estado PENDIENTE_APROBACION");
    }
    return prisma.alianzaComercial.update({
      where: { id: alianza.id },
      data: {
        estado: "RECHAZADA",
        motivoRechazo: String(motivoRechazo).trim().slice(0, 500),
        aprobadoPor: Number(adminId),
        aprobadoAt: new Date(),
      },
      include: ALIANZA_INCLUDE,
    });
  },

  async adminDespublicar(adminId, alianzaId) {
    const alianza = await prisma.alianzaComercial.findUnique({ where: { id: Number(alianzaId) } });
    if (!alianza) throw new ErrorNoEncontrado("Alianza no encontrada");
    if (alianza.estado !== "PUBLICADA") {
      throw new ErrorValidacion("Solo se puede despublicar una alianza en estado PUBLICADA");
    }
    return prisma.alianzaComercial.update({
      where: { id: alianza.id },
      data: { estado: "DESPUBLICADA", aprobadoPor: Number(adminId), aprobadoAt: new Date() },
      include: ALIANZA_INCLUDE,
    });
  },

  // ── VALIDACIÓN PARA CHECKOUT (consumida por otros módulos) ────

  /**
   * Valida un código de alianza para un checkout de un comercio+módulo específico.
   *
   * Esta función es invocada por los servicios de checkout de Express/Hotel/Tour/
   * Transporte/Pedido, de forma análoga a como ya validan CuponExpress/CuponHotel/
   * CuponTour/etc.
   *
   * @param {string} codigoCompartido  El código que el cliente ingresó en el checkout.
   * @param {number} comercioId        El comercio dueño del checkout (Express/Hotel/etc en curso).
   * @param {string} modulo            Uno de "PEDIDO" | "EXPRESS" | "HOTEL" | "TOUR" | "TRANSPORTE".
   * @returns {Promise<{ tipoDescuento: string, valorDescuento: number } | null>}
   *          null si el código no aplica (no existe, no está publicada, el comercio
   *          no es socio aceptado/activo en ese módulo, o está fuera de vigencia).
   */
  async validarCodigoAlianza(codigoCompartido, comercioId, modulo) {
    if (!codigoCompartido || !comercioId || !modulo) return null;
    if (!MODULOS_VALIDOS.includes(modulo)) return null;

    const ahora = new Date();
    const socio = await prisma.alianzaSocio.findFirst({
      where: {
        comercioId: Number(comercioId),
        modulo,
        aceptado: true,
        activo: true,
        alianza: {
          codigoCompartido: String(codigoCompartido).trim().toUpperCase(),
          estado: "PUBLICADA",
          inicio: { lte: ahora },
          fin: { gte: ahora },
        },
      },
      select: { tipoDescuento: true, valorDescuento: true },
    });

    if (!socio) return null;
    return { tipoDescuento: socio.tipoDescuento, valorDescuento: Number(socio.valorDescuento) };
  },
};

module.exports = AlianzaService;
