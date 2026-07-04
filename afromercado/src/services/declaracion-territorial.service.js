// ============================================================
//  Declaración de organización territorial (Módulo D institucional)
//  Dato sensible bajo Ley 1581 de 2012 (Art. 5): requiere consentimiento
//  explícito, específico y revocable. Los campos reales en Comercio solo
//  se llenan tras aprobación admin del CambioCriticoComercio generado aquí
//  — nunca directo desde lo que envía el comerciante.
// ============================================================
const prisma = require("../config/prisma");
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const {
  prepararRevisionPorCambioCritico,
  registrarRevisionCriticaTx,
} = require("./comercio-revision.service");

const TIPOS_VALIDOS = ["CONSEJO_COMUNITARIO", "RESGUARDO_INDIGENA", "ZONA_RESERVA_CAMPESINA", "OTRA"];
const TEXTO_CONSENTIMIENTO_VERSION = "v1";

function notificarSolicitud(comercio) {
  setImmediate(async () => {
    try {
      if (comercio.usuarioId) {
        await NotificacionService.crearYEnviar({
          usuarioId: comercio.usuarioId,
          tipo: "DECLARACION_TERRITORIAL_PENDIENTE",
          titulo: "Declaración enviada para revisión",
          mensaje: "Tu declaración de organización territorial fue enviada. Te avisaremos cuando el equipo la revise. Tu tienda sigue funcionando normalmente mientras tanto.",
        });
      }
      const admins = await prisma.usuario.findMany({ where: { rol: "ADMIN" }, select: { id: true } });
      for (const admin of admins) {
        await NotificacionService.crearYEnviar({
          usuarioId: admin.id,
          tipo: "DECLARACION_TERRITORIAL_PENDIENTE_ADMIN",
          titulo: "Nueva declaración territorial pendiente",
          mensaje: `${comercio.nombre || "Un comercio"} solicitó registrar su organización territorial. Revísala en el panel de comerciantes.`,
        });
      }
    } catch (e) {
      console.error("[DECLARACION-TERRITORIAL] notificarSolicitud:", e.message);
    }
  });
}

const DeclaracionTerritorialService = {
  async solicitar(usuarioId, { tipo, nombreOrganizacion, consentimientos } = {}) {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      throw new ErrorValidacion(`Tipo inválido. Opciones: ${TIPOS_VALIDOS.join(", ")}`);
    }
    if (!nombreOrganizacion || !String(nombreOrganizacion).trim()) {
      throw new ErrorValidacion("El nombre de la organización es obligatorio.");
    }
    if (!consentimientos?.aceptaAlmacenarDeclaracion) {
      throw new ErrorValidacion("Debes autorizar el almacenamiento de la declaración para continuar.");
    }

    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoEncontrado("No tienes un comercio registrado");

    const snapshotAnterior = {
      tipo: comercio.organizacionTerritorialTipo,
      nombreOrganizacion: comercio.organizacionTerritorialNombre,
    };
    const snapshotNuevo = {
      tipo,
      nombreOrganizacion: String(nombreOrganizacion).trim(),
      consentimientos: {
        aceptaAlmacenarDeclaracion: true,
        aceptaMostrarSelloPublico: Boolean(consentimientos.aceptaMostrarSelloPublico),
      },
      textoConsentimientoVersion: TEXTO_CONSENTIMIENTO_VERSION,
      fechaConsentimiento: new Date().toISOString(),
    };

    const revision = prepararRevisionPorCambioCritico(comercio, {
      tipoCambio: "la declaración de organización territorial",
      accion: "SOLICITAR_DECLARACION_TERRITORIAL",
      tipo: "DECLARACION_TERRITORIAL",
      snapshotAnterior,
      snapshotNuevo,
      solicitadoPor: usuarioId,
      nuncaPausar: true,
      siempreRegistrar: true,
    });

    const resultado = await prisma.$transaction(async (tx) => {
      return registrarRevisionCriticaTx(tx, comercio, revision);
    });

    notificarSolicitud(comercio);

    return resultado;
  },

  async revocar(usuarioId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoEncontrado("No tienes un comercio registrado");
    if (!comercio.organizacionTerritorialTipo) {
      throw new ErrorValidacion("No tienes ninguna declaración territorial activa para revocar.");
    }

    const snapshotAnterior = {
      tipo: comercio.organizacionTerritorialTipo,
      nombreOrganizacion: comercio.organizacionTerritorialNombre,
    };

    await prisma.$transaction([
      prisma.comercio.update({
        where: { id: comercio.id },
        data: {
          organizacionTerritorialTipo: null,
          organizacionTerritorialNombre: null,
          organizacionTerritorialFecha: null,
        },
      }),
      // Revocación sin fricción administrativa (Ley 1581): queda auditado
      // directo en estado APROBADO, no pasa por cola de revisión.
      prisma.cambioCriticoComercio.create({
        data: {
          comercioId: comercio.id,
          tipo: "DECLARACION_TERRITORIAL",
          estado: "APROBADO",
          accion: "REVOCAR_DECLARACION_TERRITORIAL",
          snapshotAnterior,
          snapshotNuevo: {},
          solicitadoPor: usuarioId,
          revisadoPor: null,
          revisadoAt: new Date(),
          motivo: "Revocado por el propio comerciante.",
        },
      }),
    ]);

    return { ok: true };
  },
};

module.exports = DeclaracionTerritorialService;
