// ============================================================
//  Controlador de Comercios
//  Recibe la petición HTTP, llama al servicio y responde.
//  No tiene lógica de negocio.
// ============================================================
const ComercioService = require("../services/comercio.service");
const prisma = require("../config/prisma");

const ComercioController = {
  async registrar(req, res, next) {
    try {
      const comercio = await ComercioService.registrar(req.usuario.id, req.body);
      res.status(201).json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async miComercio(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async obtener(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerPorId(req.params.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async actualizar(req, res, next) {
    try {
      const comercio = await ComercioService.actualizar(req.usuario.id, req.body);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  // GET /comercios/mis-estadisticas
  async misEstadisticas(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const comercioId = comercio.id;

      const ESTADOS_CONFIRMADOS = ["CONFIRMADO", "ENTREGADO"];

      const [ingresosRes, porPreparar, recientes, topItems] = await Promise.all([
        // Suma de neto en pedidos confirmados
        prisma.subPedido.aggregate({
          where: { comercioId, pedido: { estado: { in: ESTADOS_CONFIRMADOS } } },
          _sum: { neto: true },
        }),
        // Pedidos listos para preparar (pago confirmado)
        prisma.subPedido.findMany({
          where: { comercioId, pedido: { estado: "CONFIRMADO" } },
          orderBy: { pedido: { createdAt: "desc" } },
          take: 10,
          include: {
            pedido: { select: { id: true, estado: true, createdAt: true, direccionTexto: true, comprador: { select: { nombre: true, telefono: true } } } },
            items: { include: { producto: { select: { nombre: true, fotoUrl: true } } } },
          },
        }),
        // Últimos 5 sub-pedidos de cualquier estado
        prisma.subPedido.findMany({
          where: { comercioId },
          orderBy: { pedido: { createdAt: "desc" } },
          take: 5,
          include: {
            pedido: { select: { id: true, estado: true, createdAt: true } },
            items: { include: { producto: { select: { nombre: true } } } },
          },
        }),
        // Top productos más vendidos
        prisma.pedidoItem.groupBy({
          by: ["productoId"],
          where: { subPedido: { comercioId, pedido: { estado: { in: ESTADOS_CONFIRMADOS } } } },
          _sum: { cantidad: true },
          orderBy: { _sum: { cantidad: "desc" } },
          take: 5,
        }),
      ]);

      const productoIds = topItems.map((t) => t.productoId);
      const productos = productoIds.length
        ? await prisma.producto.findMany({
            where: { id: { in: productoIds } },
            select: { id: true, nombre: true, fotoUrl: true },
          })
        : [];

      const topProductos = topItems.map((t) => ({
        ...productos.find((p) => p.id === t.productoId),
        cantidadVendida: t._sum.cantidad ?? 0,
      }));

      res.json({
        ok: true,
        data: {
          ingresosNetos: Number(ingresosRes._sum.neto ?? 0),
          porPreparar,
          recientes,
          topProductos,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = ComercioController;
