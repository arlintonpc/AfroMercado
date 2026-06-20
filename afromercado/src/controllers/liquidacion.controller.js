const prisma = require("../config/prisma");
const { ErrorNoEncontrado, ErrorValidacion } = require("../utils/errores");

const TARIFA_ENTREGA_COP = Number(process.env.TARIFA_ENTREGA_COP || 5000);

function formatPeriodo(desde, hasta) {
  const d = new Date(desde).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const h = new Date(hasta).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `${d} – ${h}`;
}

const LiquidacionController = {
  // GET /admin/liquidaciones?tipo=&estado=&pagina=
  async listar(req, res, next) {
    try {
      const { tipo, estado, pagina = 1 } = req.query;
      const where = {};
      if (tipo   && ["COMERCIANTE", "REPARTIDOR"].includes(tipo))   where.tipo   = tipo;
      if (estado && ["PENDIENTE", "PAGADA"].includes(estado))       where.estado = estado;

      const [items, total] = await Promise.all([
        prisma.liquidacion.findMany({
          where,
          include: {
            beneficiario: {
              select: {
                id: true, nombre: true, email: true, telefono: true,
                comercio: { select: { nombre: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          skip: (Number(pagina) - 1) * 20,
        }),
        prisma.liquidacion.count({ where }),
      ]);

      res.json({
        ok: true,
        data: {
          items,
          total,
          paginas: Math.ceil(total / 20),
          pagina: Number(pagina),
        },
      });
    } catch (e) { next(e); }
  },

  // GET /admin/liquidaciones/resumen — saldos pendientes por comerciante/repartidor
  async resumen(req, res, next) {
    try {
      // Comerciantes con saldo pendiente
      const comercios = await prisma.comercio.findMany({
        where: { activo: true, verificado: true },
        include: { usuario: { select: { id: true, nombre: true, telefono: true } } },
      });

      const comerciantes = [];
      for (const c of comercios) {
        const ganado = await prisma.subPedido.aggregate({
          _sum: { neto: true },
          where: { comercioId: c.id, estado: "ENTREGADO" },
        });
        const liquidado = await prisma.liquidacion.aggregate({
          _sum: { monto: true },
          where: { beneficiarioId: c.usuarioId, tipo: "COMERCIANTE", estado: "PAGADA" },
        });
        const pendiente = Number(ganado._sum.neto || 0) - Number(liquidado._sum.monto || 0);
        if (pendiente > 0) {
          comerciantes.push({
            usuario: {
              id: c.usuario.id,
              nombre: c.usuario.nombre,
              email: c.usuario.email,
            },
            tipo: "COMERCIANTE",
            pendiente,
            comercioNombre: c.nombre,
            dueno: c.usuario.nombre,
            telefono: c.usuario.telefono,
            totalGanado: Number(ganado._sum.neto || 0),
            totalLiquidado: Number(liquidado._sum.monto || 0),
          });
        }
      }
      comerciantes.sort((a, b) => b.pendiente - a.pendiente);

      // Repartidores con saldo pendiente
      const repartidores = [];
      const reps = await prisma.usuario.findMany({
        where: { rol: "REPARTIDOR", activo: true },
        select: { id: true, nombre: true, email: true, telefono: true },
      });
      for (const r of reps) {
        const entregas = await prisma.entrega.count({
          where: { repartidorId: r.id, estado: "ENTREGADA" },
        });
        const liquidado = await prisma.liquidacion.aggregate({
          _sum: { monto: true },
          where: { beneficiarioId: r.id, tipo: "REPARTIDOR", estado: "PAGADA" },
        });
        const totalGanado = entregas * TARIFA_ENTREGA_COP;
        const pendiente = totalGanado - Number(liquidado._sum.monto || 0);
        if (pendiente > 0) {
          repartidores.push({
            usuario: {
              id: r.id,
              nombre: r.nombre,
              email: r.email,
            },
            tipo: "REPARTIDOR",
            pendiente,
            nombre: r.nombre,
            telefono: r.telefono,
            totalEntregas: entregas,
            totalGanado,
            totalLiquidado: Number(liquidado._sum.monto || 0),
          });
        }
      }
      repartidores.sort((a, b) => b.pendiente - a.pendiente);

      const resumen = [
        ...comerciantes.map((c) => ({
          usuario: c.usuario,
          tipo: c.tipo,
          pendiente: c.pendiente,
          comercioNombre: c.comercioNombre,
        })),
        ...repartidores.map((r) => ({
          usuario: r.usuario,
          tipo: r.tipo,
          pendiente: r.pendiente,
          totalEntregas: r.totalEntregas,
        })),
      ].sort((a, b) => b.pendiente - a.pendiente);

      res.json({
        ok: true,
        data: resumen,
        meta: {
          comerciantes,
          repartidores,
          tarifaEntrega: TARIFA_ENTREGA_COP,
        },
      });
    } catch (e) { next(e); }
  },

  // POST /admin/liquidaciones
  async crear(req, res, next) {
    try {
      const { tipo, beneficiarioId, periodoDesde, periodoHasta, cuentaDestino, notas } = req.body;

      if (!["COMERCIANTE", "REPARTIDOR"].includes(tipo))
        throw new ErrorValidacion("tipo debe ser COMERCIANTE o REPARTIDOR");
      if (!beneficiarioId) throw new ErrorValidacion("beneficiarioId es requerido");
      if (!periodoDesde || !periodoHasta) throw new ErrorValidacion("periodoDesde y periodoHasta son requeridos");

      const desde = new Date(periodoDesde);
      const hasta = new Date(periodoHasta);
      if (hasta <= desde) throw new ErrorValidacion("periodoHasta debe ser posterior a periodoDesde");

      let monto = 0;

      if (tipo === "COMERCIANTE") {
        const comercio = await prisma.comercio.findUnique({ where: { usuarioId: Number(beneficiarioId) } });
        if (!comercio) throw new ErrorValidacion("El usuario no tiene comercio registrado");

        const ganado = await prisma.subPedido.aggregate({
          _sum: { neto: true },
          where: { comercioId: comercio.id, estado: "ENTREGADO", updatedAt: { gte: desde, lte: hasta } },
        });
        const liquidado = await prisma.liquidacion.aggregate({
          _sum: { monto: true },
          where: { beneficiarioId: Number(beneficiarioId), tipo: "COMERCIANTE", estado: "PAGADA",
                   periodoDesde: { gte: desde }, periodoHasta: { lte: hasta } },
        });
        monto = Number(ganado._sum.neto || 0) - Number(liquidado._sum.monto || 0);
      } else {
        const entregas = await prisma.entrega.count({
          where: { repartidorId: Number(beneficiarioId), estado: "ENTREGADA", updatedAt: { gte: desde, lte: hasta } },
        });
        const liquidado = await prisma.liquidacion.aggregate({
          _sum: { monto: true },
          where: { beneficiarioId: Number(beneficiarioId), tipo: "REPARTIDOR", estado: "PAGADA",
                   periodoDesde: { gte: desde }, periodoHasta: { lte: hasta } },
        });
        monto = (entregas * TARIFA_ENTREGA_COP) - Number(liquidado._sum.monto || 0);
      }

      if (monto <= 0) throw new ErrorValidacion("No hay saldo pendiente a liquidar en ese período");

      const liq = await prisma.liquidacion.create({
        data: {
          tipo,
          beneficiarioId: Number(beneficiarioId),
          monto,
          periodoDesde:   desde,
          periodoHasta:   hasta,
          cuentaDestino:  cuentaDestino?.trim() || null,
          notas:          notas?.trim() || null,
          creadoPor:      req.usuario.id,
        },
        include: {
          beneficiario: { select: { nombre: true, email: true, comercio: { select: { nombre: true } } } },
        },
      });

      res.status(201).json({ ok: true, data: liq });
    } catch (e) { next(e); }
  },

  // PATCH /admin/liquidaciones/:id/pagar
  async marcarPagada(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { comprobante, notas } = req.body;

      const liq = await prisma.liquidacion.findUnique({ where: { id } });
      if (!liq) throw new ErrorNoEncontrado("Liquidación no encontrada");
      if (liq.estado === "PAGADA") throw new ErrorValidacion("Esta liquidación ya fue pagada");

      const actualizada = await prisma.liquidacion.update({
        where: { id },
        data: {
          estado:      "PAGADA",
          comprobante: comprobante?.trim() || null,
          notas:       notas?.trim() || liq.notas,
          pagadoPor:   req.usuario.id,
          pagadoAt:    new Date(),
        },
        include: {
          beneficiario: { select: { nombre: true, email: true, telefono: true } },
        },
      });

      res.json({ ok: true, data: actualizada });
    } catch (e) { next(e); }
  },

  // GET /mis-liquidaciones — para comerciantes y repartidores
  async misLiquidaciones(req, res, next) {
    try {
      const items = await prisma.liquidacion.findMany({
        where: { beneficiarioId: req.usuario.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ ok: true, data: items });
    } catch (e) { next(e); }
  },
};

module.exports = LiquidacionController;
