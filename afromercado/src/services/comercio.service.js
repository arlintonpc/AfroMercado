// ============================================================
//  Servicio de Comercios — lógica de negocio
//  Orquesta las operaciones sobre comercios.
//  No habla directo con la BD; usa el repositorio.
// ============================================================
const ComercioRepository = require("../repositories/comercio.repository");
const CuentaDispersionService = require("./cuenta-dispersion.service");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const prisma = require("../config/prisma");
const { eliminarDeCloudinary } = require("../utils/cloudinary");
const { eliminarArchivoLocalDesdeUrl } = require("../utils/video-media");
const { validarUbicacion } = require("../utils/ubicacion");

const CAMPOS_EDITABLES = [
  "nombre",
  "descripcion",
  "departamento",
  "municipio",
  "latitud",
  "longitud",
  "historia",
  "whatsapp",
  "logoUrl",
  "vereda",
  "rut",
  "camaraComercioNumero",
  "fotoDocumentoUrl",
  "fotoDocumentoFrenteUrl",
  "fotoDocumentoReversoUrl",
];

// RUT/NIT colombiano: dígitos, opcionalmente con guion + dígito de verificación
// (ej. 900123456-7). Validación de formato, no de existencia real ante la DIAN.
const REGEX_RUT = /^\d{8,15}(-\d)?$/;

const TIPOS_DOCUMENTO_VALIDOS = ["CC", "TI", "CE", "PEP", "PASAPORTE", "NIT"];

function traeCuentaDispersion(datos) {
  return Boolean(
    datos.bancoCodigo ||
    datos.tipoCuenta ||
    datos.numeroCuenta ||
    datos.titularNombre
  );
}

async function limpiarVideoAnterior(comercio) {
  if (!comercio) return;
  if (comercio.videoPublicId) {
    await eliminarDeCloudinary(comercio.videoPublicId, "video").catch(() => {});
    return;
  }
  if (comercio.videoUrl) {
    eliminarArchivoLocalDesdeUrl(comercio.videoUrl);
  }
}

// Envío gratis del vendedor: se guarda en la tabla Config por comercio
// (clave `envio_gratis_comercio:<id>`), evitando una migración de esquema.
const claveEnvioGratis = (comercioId) => `envio_gratis_comercio:${comercioId}`;

async function leerEnvioGratis(comercioId) {
  const row = await prisma.config.findUnique({ where: { clave: claveEnvioGratis(comercioId) } });
  return row && row.valor ? Number(row.valor) : null;
}

/**
 * Alianzas comerciales publicadas y vigentes en las que este comercio es
 * socio aceptado y activo. Se usa para mostrar el badge cruzado "Participa
 * en: [alianza]" en el perfil público del comercio (ver alianza.service.js
 * para las reglas completas de una alianza — aquí solo se necesita nombre +
 * código para el link a /alianzas/[codigo]).
 */
async function alianzasActivasDeComercio(comercioId) {
  const ahora = new Date();
  const socios = await prisma.alianzaSocio.findMany({
    where: {
      comercioId: Number(comercioId),
      aceptado: true,
      activo: true,
      alianza: { estado: "PUBLICADA", inicio: { lte: ahora }, fin: { gte: ahora } },
    },
    select: {
      alianza: { select: { id: true, nombre: true, codigoCompartido: true } },
    },
  });
  return socios.map((s) => s.alianza);
}

const ComercioService = {
  // Cualquier COMPRADOR autenticado puede abrir su tienda con la misma cuenta
  // (se convierte en COMERCIANTE, mismo patrón ya usado al aprobar un repartidor).
  // ADMIN nunca puede registrar un comercio para sí mismo: separación de privilegios.
  async registrar(usuarioId, datos, rolActual) {
    if (rolActual === "ADMIN") {
      throw new ErrorProhibido("Una cuenta de administrador no puede registrar un comercio.");
    }

    const { nombre, municipio } = datos;
    const departamento = datos.departamento?.trim();

    if (!nombre || !municipio || !departamento) {
      throw new ErrorValidacion("El nombre, el departamento y el municipio son obligatorios");
    }
    validarUbicacion(departamento, municipio);
    if (!datos.tipoDocumento || !datos.numeroDocumento?.trim()) {
      throw new ErrorValidacion("El tipo y número de documento son obligatorios para el registro");
    }
    if (!TIPOS_DOCUMENTO_VALIDOS.includes(datos.tipoDocumento)) {
      throw new ErrorValidacion("Tipo de documento inválido");
    }

    const existente = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (existente) {
      throw new ErrorValidacion("Este usuario ya tiene un comercio registrado");
    }

    const [, comercio] = await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          tipoDocumento: datos.tipoDocumento,
          numeroDocumento: datos.numeroDocumento.trim(),
          rol: "COMERCIANTE",
        },
      }),
      prisma.comercio.create({
        data: { usuarioId, nombre, municipio,
          departamento,
          descripcion: datos.descripcion ?? null,
          historia: datos.historia ?? null,
          whatsapp: datos.whatsapp ?? null,
          vereda: datos.vereda?.trim() ?? null,
          fotoDocumentoUrl: datos.fotoDocumentoUrl ?? null,
          fotoDocumentoFrenteUrl: datos.fotoDocumentoFrenteUrl ?? datos.fotoDocumentoUrl ?? null,
          fotoDocumentoReversoUrl: datos.fotoDocumentoReversoUrl ?? null,
        },
      }),
    ]);

    // N-A-03: alertar a los admins del nuevo comercio pendiente de verificación
    setImmediate(async () => {
      try {
        const prisma = require("../config/prisma");
        const sseManager = require("../utils/sse-manager");
        const admins = await prisma.usuario.findMany({ where: { rol: "ADMIN" }, select: { id: true } });
        for (const admin of admins) {
          const notif = await prisma.notificacion.create({
            data: {
              usuarioId: admin.id,
              tipo: "NUEVO_COMERCIO",
              titulo: "Nuevo comercio pendiente de verificación",
              mensaje: `${nombre} (${municipio}) solicitó registro. Revisa el documento y verifica el comercio.`,
              url: `/admin/comerciantes`,
              datos: { comercioId: comercio.id },
            },
          });
          sseManager.enviar(admin.id, "notificacion", notif);
        }
      } catch (e) {
        console.error("[NOTIF] nuevo comercio admin:", e.message);
      }
    });

    if (traeCuentaDispersion(datos)) {
      await CuentaDispersionService.guardar(usuarioId, datos);
    }

    return comercio;
  },

  async obtenerMiComercio(usuarioId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) {
      throw new ErrorNoEncontrado("No tienes un comercio registrado");
    }
    const envioGratisDesde = await leerEnvioGratis(comercio.id);
    return { ...comercio, envioGratisDesde };
  },

  async obtenerPorId(id) {
    const comercio = await ComercioRepository.buscarPorId(id);
    if (!comercio) {
      throw new ErrorNoEncontrado("Comercio no encontrado");
    }
    const alianzasActivas = await alianzasActivasDeComercio(comercio.id);
    return { ...comercio, alianzasActivas };
  },

  /**
   * Autocomplete de comercios por nombre, para uso de un comerciante (ej.
   * buscar a quién invitar a una alianza comercial). A diferencia del
   * buscador de admin (AdminController.buscarComercios), acá:
   *  - Solo se devuelven comercios activos y verificados (los no verificados
   *    de todas formas no pueden participar en alianzas, ver alianza.service.js).
   *  - Se excluye el comercio propio del que busca (no tiene sentido invitarse
   *    a sí mismo).
   *  - El `select` es deliberadamente mínimo (id, nombre, municipio, logoUrl):
   *    no expone whatsapp ni ningún otro dato de contacto del comercio.
   */
  async buscar(texto, comercioIdExcluir) {
    const q = String(texto || "").trim();
    if (!q) return [];
    return prisma.comercio.findMany({
      where: {
        activo: true,
        verificado: true,
        deletedAt: null,
        nombre: { contains: q, mode: "insensitive" },
        ...(comercioIdExcluir ? { id: { not: Number(comercioIdExcluir) } } : {}),
      },
      select: { id: true, nombre: true, municipio: true, logoUrl: true },
      orderBy: { nombre: "asc" },
      take: 10,
    });
  },

  async actualizar(usuarioId, datos) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) {
      throw new ErrorNoEncontrado("No tienes un comercio registrado");
    }

    const cambios = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (datos[campo] !== undefined) cambios[campo] = datos[campo];
    }

    if (cambios.departamento !== undefined || cambios.municipio !== undefined) {
      validarUbicacion(
        cambios.departamento ?? comercio.departamento,
        cambios.municipio ?? comercio.municipio
      );
    }

    if (cambios.rut !== undefined && cambios.rut !== null && cambios.rut !== "") {
      const rutLimpio = String(cambios.rut).trim();
      if (!REGEX_RUT.test(rutLimpio)) {
        throw new ErrorValidacion("El RUT no tiene un formato válido. Usa solo números, con guion y dígito de verificación si aplica (ej. 900123456-7).");
      }
      cambios.rut = rutLimpio;
    }

    // Envío gratis del vendedor: monto mínimo (0 / vacío / null = desactivado).
    // Se guarda en Config por comercio (sin migración). Si la plataforma tiene
    // la regla desactivada, el valor se guarda pero no surte efecto hasta que el
    // admin la habilite (lo respeta el cálculo de envío).
    let tocoEnvioGratis = false;
    if (datos.envioGratisDesde !== undefined) {
      const v = datos.envioGratisDesde;
      const n = v === null || v === "" ? null : Number(v);
      if (n !== null && (!Number.isFinite(n) || n < 0)) {
        throw new ErrorValidacion("El monto de envío gratis no es válido.");
      }
      const clave = claveEnvioGratis(comercio.id);
      if (n === null || n === 0) {
        await prisma.config.deleteMany({ where: { clave } });
      } else {
        await prisma.config.upsert({
          where: { clave },
          create: { clave, valor: String(n) },
          update: { valor: String(n) },
        });
      }
      tocoEnvioGratis = true;
    }

    if (Object.keys(cambios).length === 0) {
      if (tocoEnvioGratis) {
        return { ...comercio, envioGratisDesde: await leerEnvioGratis(comercio.id) };
      }
      throw new ErrorValidacion("No se enviaron campos válidos para actualizar");
    }

    const actualizado = await ComercioRepository.actualizar(comercio.id, cambios);
    return { ...actualizado, envioGratisDesde: await leerEnvioGratis(comercio.id) };
  },

  async actualizarVideo(usuarioId, video) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) {
      throw new ErrorNoEncontrado("No tienes un comercio registrado");
    }
    if (!video?.videoUrl) {
      throw new ErrorValidacion("No se recibio video");
    }

    await limpiarVideoAnterior(comercio);

    const actualizado = await ComercioRepository.actualizar(comercio.id, {
      videoUrl: video.videoUrl,
      videoPosterUrl: video.videoPosterUrl ?? null,
      videoPublicId: video.videoPublicId ?? null,
      videoDuracionSegundos: video.videoDuracionSegundos ?? null,
      videoDuracionOriginalSegundos: video.videoDuracionOriginalSegundos ?? null,
      videoRecorteInicioSegundos: video.videoRecorteInicioSegundos ?? null,
      videoRecorteFinSegundos: video.videoRecorteFinSegundos ?? null,
      videoAncho: video.videoAncho ?? null,
      videoAlto: video.videoAlto ?? null,
      videoBytes: video.videoBytes ?? null,
      videoFormato: video.videoFormato ?? null,
      videoMimeType: video.videoMimeType ?? null,
    });

    return { ...actualizado, envioGratisDesde: await leerEnvioGratis(comercio.id) };
  },

  async quitarVideo(usuarioId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) {
      throw new ErrorNoEncontrado("No tienes un comercio registrado");
    }

    await limpiarVideoAnterior(comercio);

    const actualizado = await ComercioRepository.actualizar(comercio.id, {
      videoUrl: null,
      videoPosterUrl: null,
      videoPublicId: null,
      videoDuracionSegundos: null,
      videoDuracionOriginalSegundos: null,
      videoRecorteInicioSegundos: null,
      videoRecorteFinSegundos: null,
      videoAncho: null,
      videoAlto: null,
      videoBytes: null,
      videoFormato: null,
      videoMimeType: null,
    });

    return { ...actualizado, envioGratisDesde: await leerEnvioGratis(comercio.id) };
  },

  // Opt-in de auto-servicio al directorio de proveedores certificados
  // (Módulo C institucional, compra pública B2G). Solo comercios ya
  // verificados por el equipo pueden activarlo — no requiere una segunda
  // aprobación admin porque `verificado=true` ya implica revisión de
  // identidad. Alcance deliberadamente reducido: el directorio es solo
  // vitrina de descubrimiento, nunca dinero ni factura dentro de la plataforma.
  async toggleComprasPublicas(usuarioId, activar) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) {
      throw new ErrorNoEncontrado("No tienes un comercio registrado");
    }
    if (activar && !comercio.verificado) {
      throw new ErrorValidacion("Tu tienda debe estar verificada para aparecer en el directorio de compras públicas.");
    }
    return ComercioRepository.actualizar(comercio.id, { disponibleComprasPublicas: Boolean(activar) });
  },

  async guardarVideoLink(usuarioId, videoUrl) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) {
      throw new ErrorNoEncontrado("No tienes un comercio registrado");
    }

    await limpiarVideoAnterior(comercio);

    const actualizado = await ComercioRepository.actualizar(comercio.id, {
      videoUrl,
      videoPosterUrl: null,
      videoPublicId: null,
      videoDuracionSegundos: null,
      videoDuracionOriginalSegundos: null,
      videoRecorteInicioSegundos: null,
      videoRecorteFinSegundos: null,
      videoAncho: null,
      videoAlto: null,
      videoBytes: null,
      videoFormato: null,
      videoMimeType: null,
    });

    return { ...actualizado, envioGratisDesde: await leerEnvioGratis(comercio.id) };
  },

  // Vitrina v0.2 — seguir comercio: cualquier usuario autenticado puede seguir
  // un comercio para recibir notificación cuando publique algo nuevo en la
  // vitrina y para que el ranking heurístico del feed lo priorice.
  // Mismo patrón que CulturaService.toggleFavoritoPublicacion.
  async toggleSeguir(usuarioId, comercioId) {
    const cId = Number(comercioId);
    const existe = await prisma.seguidorComercio.findUnique({
      where: { usuarioId_comercioId: { usuarioId, comercioId: cId } },
    });
    if (existe) {
      await prisma.seguidorComercio.delete({ where: { id: existe.id } });
      return { siguiendo: false };
    }
    await prisma.seguidorComercio.create({ data: { usuarioId, comercioId: cId } });
    return { siguiendo: true };
  },

  async sigo(usuarioId, comercioId) {
    const existe = await prisma.seguidorComercio.findUnique({
      where: { usuarioId_comercioId: { usuarioId, comercioId: Number(comercioId) } },
    });
    return { siguiendo: !!existe };
  },
};

module.exports = ComercioService;
