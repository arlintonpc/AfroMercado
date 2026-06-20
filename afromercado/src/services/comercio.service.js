// ============================================================
//  Servicio de Comercios — lógica de negocio
//  Orquesta las operaciones sobre comercios.
//  No habla directo con la BD; usa el repositorio.
// ============================================================
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const prisma = require("../config/prisma");

const CAMPOS_EDITABLES = ["nombre", "descripcion", "municipio", "historia", "whatsapp", "logoUrl", "vereda", "fotoDocumentoUrl"];

const TIPOS_DOCUMENTO_VALIDOS = ["CC", "TI", "CE", "PEP", "PASAPORTE", "NIT"];

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
    return comercio;
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

    if (Object.keys(cambios).length === 0) {
      throw new ErrorValidacion("No se enviaron campos válidos para actualizar");
    }

    return ComercioRepository.actualizar(comercio.id, cambios);
  },
};

module.exports = ComercioService;
