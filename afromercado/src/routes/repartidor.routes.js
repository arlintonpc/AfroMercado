const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const RepartidorController = require("../controllers/repartidor.controller");
const prisma = require("../config/prisma");
const { obtenerConfiguracionPago, calcularPagoEntrega } = require("../services/pago-repartidor.service");

const router = express.Router();
const soloRepartidor = [autenticar, autorizar("REPARTIDOR")];

router.get("/entregas",              ...soloRepartidor, RepartidorController.misEntregas);
router.get("/entregas/disponibles",  ...soloRepartidor, RepartidorController.disponibles);
router.patch("/entregas/:id/tomar",  ...soloRepartidor, RepartidorController.tomar);
router.patch("/entregas/:id/estado", ...soloRepartidor, RepartidorController.actualizarEstado);
router.patch("/entregas/:id/ubicacion", ...soloRepartidor, RepartidorController.actualizarUbicacion);
router.post("/entregas/:id/calificar", autenticar, RepartidorController.calificar);
router.post("/entregas/:id/foto",    ...soloRepartidor, RepartidorController.uploadFotoEntrega, RepartidorController.subirFotoEntrega);

// ── Estadísticas del repartidor ────────────────────────────────
router.get("/estadisticas", ...soloRepartidor, async (req, res, next) => {
  try {
    const repartidorId = req.usuario.id;
    const { modo, valor } = await obtenerConfiguracionPago();
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    const entregas = await prisma.entrega.findMany({
      where: { repartidorId },
      include: {
        subPedido: {
          include: {
            pedido: {
              select: { id: true, costoEnvio: true, _count: { select: { subPedidos: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const entregadas = entregas.filter((e) => e.estado === "ENTREGADA");
    const fallidas   = entregas.filter((e) => e.estado === "FALLIDA");

    const totalGanado = entregadas.reduce((s, e) => s + calcularPagoEntrega(e, modo, valor), 0);
    const gananciasMes = entregadas
      .filter((e) => new Date(e.createdAt) >= inicioMes)
      .reduce((s, e) => s + calcularPagoEntrega(e, modo, valor), 0);

    // Ultimos 6 meses
    const porMes = [];
    for (let i = 5; i >= 0; i--) {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const fin    = new Date(ahora.getFullYear(), ahora.getMonth() - i + 1, 1);
      const del_mes = entregadas.filter((e) => {
        const f = new Date(e.createdAt);
        return f >= inicio && f < fin;
      });
      porMes.push({
        mes: inicio.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }),
        entregas: del_mes.length,
        ganancias: del_mes.reduce((s, e) => s + calcularPagoEntrega(e, modo, valor), 0),
      });
    }

    const tasaExito = entregas.length > 0
      ? Math.round((entregadas.length / (entregadas.length + fallidas.length || 1)) * 100)
      : 100;

    res.json({
      ok: true,
      data: {
        totalEntregas: entregas.length,
        totalEntregadas: entregadas.length,
        totalFallidas: fallidas.length,
        totalGanado,
        gananciasMes,
        promedioPorEntrega: entregadas.length > 0 ? Math.round(totalGanado / entregadas.length) : 0,
        tasaExito,
        porMes,
      },
    });
  } catch (e) { next(e); }
});

// ── Perfil editable del repartidor ────────────────────────────
router.patch("/perfil", ...soloRepartidor, async (req, res, next) => {
  try {
    const { vehiculoTipo, vehiculoMarca, vehiculoModelo, vehiculoColor, vehiculoPlaca, vehiculoAnio, municipioBase, municipiosExtra } = req.body;
    const solicitud = await prisma.solicitudRepartidor.findFirst({
      where: { usuarioId: req.usuario.id, estado: "APROBADA" },
    });
    if (!solicitud) return res.status(404).json({ error: "No tienes una solicitud aprobada" });

    const actualizada = await prisma.solicitudRepartidor.update({
      where: { id: solicitud.id },
      data: {
        ...(vehiculoTipo    !== undefined && { vehiculoTipo }),
        ...(vehiculoMarca   !== undefined && { vehiculoMarca }),
        ...(vehiculoModelo  !== undefined && { vehiculoModelo }),
        ...(vehiculoColor   !== undefined && { vehiculoColor }),
        ...(vehiculoPlaca   !== undefined && { vehiculoPlaca }),
        ...(vehiculoAnio    !== undefined && { vehiculoAnio: Number(vehiculoAnio) }),
        ...(municipioBase   !== undefined && { municipioBase }),
        ...(municipiosExtra !== undefined && { municipiosExtra: Array.isArray(municipiosExtra) ? municipiosExtra : [] }),
      },
    });
    res.json({ ok: true, data: actualizada });
  } catch (e) { next(e); }
});

router.get("/admin/entregas", autenticar, autorizar("ADMIN"), RepartidorController.listarAdmin);
router.patch("/admin/entregas/:id/asignar", autenticar, autorizar("ADMIN"), RepartidorController.asignarAdmin);

// Solicitud para ser repartidor (cualquier usuario autenticado)
router.post("/solicitar",   autenticar, RepartidorController.enviarSolicitud);
router.get("/mi-solicitud", autenticar, RepartidorController.miSolicitud);
router.post("/solicitud/foto", autenticar, RepartidorController.uploadDocSolicitud, RepartidorController.subirDocSolicitud);

module.exports = router;
