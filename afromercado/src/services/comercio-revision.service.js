const prisma = require("../config/prisma");
const NotificacionService = require("./notificacion.service");

const ESTADOS_QUE_REQUIEREN_REVISION = new Set(["APROBADO", "RECHAZADO", "SUSPENDIDO"]);

function debeVolverARevision(comercio) {
  if (!comercio) return false;
  if (ESTADOS_QUE_REQUIEREN_REVISION.has(comercio.estadoRegistro)) return true;
  return Boolean(comercio.verificado);
}

function prepararRevisionPorCambioCritico(
  comercio,
  { tipoCambio, accion, tipo, snapshotAnterior, snapshotNuevo, solicitadoPor },
) {
  if (!comercio) return null;

  const requiereCambioEstado = debeVolverARevision(comercio);
  const motivo = `Actualizacion de ${tipoCambio} por el comerciante; requiere nueva revision administrativa.`;
  return {
    accion,
    tipo: tipo || accion,
    tipoCambio,
    motivo,
    requiereCambioEstado,
    snapshotAnterior: snapshotAnterior || {},
    snapshotNuevo: snapshotNuevo || {},
    solicitadoPor: solicitadoPor || comercio.usuarioId || null,
    data: requiereCambioEstado
      ? {
          estadoRegistro: "PENDIENTE_REVISION",
          verificado: false,
          activo: false,
          motivoRechazo: motivo,
          revisadoPor: null,
          revisadoAt: null,
        }
      : null,
  };
}

async function registrarRevisionCriticaTx(tx, comercio, revision) {
  const pendienteMismoTipo = await tx.cambioCriticoComercio.findFirst({
    where: { comercioId: comercio.id, tipo: revision.tipo, estado: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
  });

  if (pendienteMismoTipo) {
    await tx.cambioCriticoComercio.update({
      where: { id: pendienteMismoTipo.id },
      data: {
        accion: revision.accion,
        snapshotNuevo: revision.snapshotNuevo,
        solicitadoPor: revision.solicitadoPor || pendienteMismoTipo.solicitadoPor,
        motivo: revision.motivo,
      },
    });

    return {
      cambioCriticoId: pendienteMismoTipo.id,
      productosDesactivados: pendienteMismoTipo.productosDesactivados || 0,
      actualizado: true,
    };
  }

  const pendienteComercio = await tx.cambioCriticoComercio.findFirst({
    where: { comercioId: comercio.id, estado: "PENDIENTE" },
    select: { id: true },
  });
  const debeCrearHistorial = revision.requiereCambioEstado || Boolean(pendienteComercio);
  if (!debeCrearHistorial) {
    return { cambioCriticoId: null, productosDesactivados: 0, actualizado: false };
  }

  const productos = revision.requiereCambioEstado
    ? await tx.producto.updateMany({
        where: { comercioId: comercio.id, activo: true },
        data: { activo: false },
      })
    : { count: 0 };

  const cambio = await tx.cambioCriticoComercio.create({
    data: {
      comercioId: comercio.id,
      tipo: revision.tipo,
      estado: "PENDIENTE",
      accion: revision.accion,
      snapshotAnterior: revision.snapshotAnterior,
      snapshotNuevo: revision.snapshotNuevo,
      solicitadoPor: revision.solicitadoPor,
      motivo: revision.motivo,
      productosDesactivados: productos.count,
    },
  });

  const adminId = Number(comercio.revisadoPor || 0);
  if (adminId > 0) {
    const admin = await tx.usuario.findUnique({
      where: { id: adminId },
      select: { id: true },
    });
    if (!admin) {
      return {
        cambioCriticoId: cambio.id,
        productosDesactivados: productos.count,
        actualizado: false,
      };
    }

    await tx.accionModeracion.create({
      data: {
        adminId: admin.id,
        targetId: comercio.id,
        targetTipo: "COMERCIO",
        accion: revision.accion,
        motivo: revision.motivo,
      },
    });
  }

  return {
    cambioCriticoId: cambio.id,
    productosDesactivados: productos.count,
    actualizado: false,
  };
}

function notificarRevisionCritica(comercio, revision) {
  if (!comercio?.id) return;

  setImmediate(async () => {
    try {
      if (comercio.usuarioId) {
        await NotificacionService.crearYEnviar({
          usuarioId: comercio.usuarioId,
          tipo: "COMERCIO_REQUIERE_REVISION",
          titulo: "Tu tienda volvio a revision",
          mensaje: `Actualizaste ${revision.tipoCambio}. Por seguridad, AfroMercado debe revisar nuevamente tu tienda antes de volver a vender.`,
          comercioId: comercio.id,
        });
      }

      const admins = await prisma.usuario.findMany({
        where: { rol: "ADMIN" },
        select: { id: true },
      });
      for (const admin of admins) {
        await NotificacionService.crearYEnviar({
          usuarioId: admin.id,
          tipo: "COMERCIO_REQUIERE_REVISION_ADMIN",
          titulo: "Comercio requiere nueva revision",
          mensaje: `${comercio.nombre || "Un comercio"} actualizo ${revision.tipoCambio}. Revisa la documentacion antes de aprobarlo nuevamente.`,
          comercioId: comercio.id,
        });
      }
    } catch (e) {
      console.error("[COMERCIO-REVISION] notificarRevisionCritica:", e.message);
    }
  });
}

module.exports = {
  notificarRevisionCritica,
  prepararRevisionPorCambioCritico,
  registrarRevisionCriticaTx,
};
