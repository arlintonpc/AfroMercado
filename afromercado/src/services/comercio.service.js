// ============================================================
//  Servicio de Comercios — lógica de negocio
//  Orquesta las operaciones sobre comercios.
//  No habla directo con la BD; usa el repositorio.
// ============================================================
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const prisma = require("../config/prisma");
const { eliminarDeCloudinary } = require("../utils/cloudinary");
const { eliminarArchivoLocalDesdeUrl } = require("../utils/video-media");

const CAMPOS_EDITABLES = ["nombre", "descripcion", "municipio", "historia", "whatsapp", "logoUrl", "vereda", "fotoDocumentoUrl"];

const TIPOS_DOCUMENTO_VALIDOS = ["CC", "TI", "CE", "PEP", "PASAPORTE", "NIT"];

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

const ComercioService = {
  async registrar(usuarioId, datos) {
    const { nombre, municipio } = datos;

    if (!nombre || !municipio) {
      throw new ErrorValidacion("El nombre y el municipio son obligatorios");
    }
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

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento.trim(),
      },
    });

    const comercio = await ComercioRepository.crear({ usuarioId, nombre, municipio,
      descripcion: datos.descripcion ?? null,
      historia: datos.historia ?? null,
      whatsapp: datos.whatsapp ?? null,
      vereda: datos.vereda?.trim() ?? null,
      fotoDocumentoUrl: datos.fotoDocumentoUrl ?? null,
    });

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
    return comercio;
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
};

module.exports = ComercioService;
