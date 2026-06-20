// Repositorio de reportería — AfroMercado
// Todas las queries filtran siempre por comercioId derivado del token (nunca del cliente).
const prisma = require("../config/prisma");

const CONFIRMADOS = ["CONFIRMADO", "ENTREGADO"];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Construye el where de SubPedido para reportes del comerciante. */
function buildWhereVentas({ comercioId, desde, hasta, estados, conCupon, productoId }) {
  const createdAt = {};
  if (desde) createdAt.gte = new Date(`${desde}T00:00:00`);
  if (hasta) createdAt.lte = new Date(`${hasta}T23:59:59.999`);

  const estadosArr = estados
    ? estados.split(",").filter((e) => CONFIRMADOS.includes(e))
    : CONFIRMADOS;

  const pedidoWhere = {
    estado: { in: estadosArr.length ? estadosArr : CONFIRMADOS },
    ...(desde || hasta ? { createdAt } : {}),
  };
  if (conCupon === "con") pedidoWhere.cuponId = { not: null };
  if (conCupon === "sin") pedidoWhere.cuponId = null;

  return {
    comercioId,
    pedido: pedidoWhere,
    ...(productoId ? { items: { some: { productoId: Number(productoId) } } } : {}),
  };
}

/** Construye el where de SubPedido para el admin (global). */
function buildWhereAdmin({ desde, hasta, comercioId: cid }) {
  const createdAt = {};
  if (desde) createdAt.gte = new Date(`${desde}T00:00:00`);
  if (hasta) createdAt.lte = new Date(`${hasta}T23:59:59.999`);
  return {
    ...(cid ? { comercioId: Number(cid) } : {}),
    pedido: {
      estado: { in: CONFIRMADOS },
      ...(desde || hasta ? { createdAt } : {}),
    },
  };
}

// ─── Comerciante ─────────────────────────────────────────────────────────────

const ReporteRepository = {
  buildWhereVentas,

  /** KPIs del periodo para el comerciante (tarjetas del dashboard). */
  async resumenComercio(filtros) {
    const where = buildWhereVentas(filtros);
    const [agg, conCuponCount] = await Promise.all([
      prisma.subPedido.aggregate({
        where,
        _sum: { subtotal: true, comision: true, neto: true },
        _count: { _all: true },
      }),
      prisma.subPedido.count({ where: { ...where, pedido: { ...where.pedido, cuponId: { not: null } } } }),
    ]);
    const ventas = agg._count._all;
    const neto = Number(agg._sum.neto ?? 0);
    return {
      ventas,
      subtotal: Number(agg._sum.subtotal ?? 0),
      comision: Number(agg._sum.comision ?? 0),
      neto,
      conCupon: conCuponCount,
      ticketPromedio: ventas > 0 ? neto / ventas : 0,
    };
  },

  /** Lista de subpedidos paginada con includes completos. */
  async ventasPagina(filtros, pagina = 1, porPagina = 20) {
    const where = buildWhereVentas(filtros);
    const [total, subPedidos] = await Promise.all([
      prisma.subPedido.count({ where }),
      prisma.subPedido.findMany({
        where,
        orderBy: { pedido: { createdAt: "desc" } },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          items: {
            include: {
              producto: { select: { id: true, nombre: true, fotoUrl: true, unidad: true } },
            },
          },
          pedido: {
            select: {
              id: true,
              codigo: true,
              estado: true,
              createdAt: true,
              cuponId: true,
              direccionTexto: true,
              comprador: { select: { nombre: true, telefono: true, email: true } },
            },
          },
        },
      }),
    ]);
    return { subPedidos, total, paginas: Math.ceil(total / porPagina), pagina };
  },

  /** Cursor-based async generator para exportar todas las filas sin agotar memoria. */
  async *ventasTodas(filtros, lote = 500) {
    const where = buildWhereVentas(filtros);
    let cursor;
    while (true) {
      const page = await prisma.subPedido.findMany({
        where,
        orderBy: { id: "asc" },
        take: lote,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          items: {
            include: {
              producto: { select: { nombre: true, unidad: true } },
            },
          },
          pedido: {
            select: {
              codigo: true,
              estado: true,
              createdAt: true,
              cuponId: true,
              direccionTexto: true,
              comprador: { select: { nombre: true, telefono: true } },
            },
          },
        },
      });
      if (page.length === 0) break;
      for (const sp of page) yield sp;
      cursor = page[page.length - 1].id;
      if (page.length < lote) break;
    }
  },

  /** Reporte de productos: unidades vendidas + vistas + stock. */
  async productosConMetricas(filtros) {
    const { comercioId, desde, hasta } = filtros;
    const createdAt = {};
    if (desde) createdAt.gte = new Date(`${desde}T00:00:00`);
    if (hasta) createdAt.lte = new Date(`${hasta}T23:59:59.999`);

    const [vendidos, vistas, productos] = await Promise.all([
      prisma.pedidoItem.groupBy({
        by: ["productoId"],
        where: {
          subPedido: {
            comercioId,
            pedido: { estado: { in: CONFIRMADOS }, ...(desde || hasta ? { createdAt } : {}) },
          },
        },
        _sum: { cantidad: true, subtotal: true },
      }),
      prisma.vistaProducto.groupBy({
        by: ["productoId"],
        where: { comercioId, ...(desde || hasta ? { createdAt } : {}) },
        _count: { _all: true },
      }),
      prisma.producto.findMany({
        where: { comercioId, deletedAt: null },
        select: {
          id: true,
          nombre: true,
          precio: true,
          fotoUrl: true,
          unidad: true,
          stock: true,
          stockReservado: true,
          activo: true,
          calificacion: true,
          totalReviews: true,
        },
        orderBy: { nombre: "asc" },
      }),
    ]);

    const ventasMap = Object.fromEntries(vendidos.map((v) => [v.productoId, v]));
    const vistasMap = Object.fromEntries(vistas.map((v) => [v.productoId, v._count._all]));

    return productos.map((p) => {
      const v = ventasMap[p.id];
      const unidades = Number(v?._sum?.cantidad ?? 0);
      const ingresos = Number(v?._sum?.subtotal ?? 0);
      const vistasCnt = vistasMap[p.id] ?? 0;
      return {
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio),
        fotoUrl: p.fotoUrl,
        unidad: p.unidad,
        stock: p.stock,
        stockReservado: p.stockReservado,
        stockDisponible: p.stock - p.stockReservado,
        activo: p.activo,
        calificacion: Number(p.calificacion),
        totalReviews: p.totalReviews,
        unidades,
        ingresos,
        neto: ingresos * 0.9,
        vistas: vistasCnt,
        conversion: vistasCnt > 0 ? (unidades / vistasCnt) * 100 : 0,
      };
    });
  },

  /** Reporte de reseñas: distribución + evolución mensual + lista. */
  async resenasComercio({ comercioId, pagina = 1, estrellas }) {
    const porPagina = 20;
    const whereBase = { producto: { comercioId } };
    if (estrellas) whereBase.calificacion = Number(estrellas);

    const [distribucion, evolucionRaw, resenas, total] = await Promise.all([
      prisma.reviewProducto.groupBy({
        by: ["calificacion"],
        where: { producto: { comercioId } },
        _count: { _all: true },
      }),
      prisma.$queryRaw`
        SELECT
          TO_CHAR(rp."createdAt" AT TIME ZONE 'America/Bogota', 'YYYY-MM') AS mes,
          ROUND(AVG(rp.calificacion)::numeric, 2)::float                    AS promedio,
          COUNT(*)::int                                                      AS total
        FROM "ReviewProducto" rp
        JOIN "Producto" p ON p.id = rp."productoId"
        WHERE p."comercioId" = ${comercioId}
        GROUP BY mes ORDER BY mes ASC
        LIMIT 24
      `,
      prisma.reviewProducto.findMany({
        where: whereBase,
        orderBy: { createdAt: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          producto: { select: { nombre: true } },
          autor: { select: { nombre: true } },
        },
      }),
      prisma.reviewProducto.count({ where: whereBase }),
    ]);

    const distMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribucion) distMap[d.calificacion] = d._count._all;

    return {
      distribucion: distMap,
      evolucion: evolucionRaw,
      resenas,
      total,
      paginas: Math.ceil(total / porPagina),
    };
  },

  /** Serie temporal de neto + ventas para el comerciante (granularidad auto). */
  async serieComercio({ comercioId, desde, hasta }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    const dias = Math.ceil((h - d) / 864e5);
    const trunc = dias <= 31 ? "day" : dias <= 180 ? "week" : "month";
    const fmt   = trunc === "day" ? "YYYY-MM-DD" : trunc === "week" ? "IYYY-IW" : "YYYY-MM";

    const rows = await prisma.$queryRaw`
      SELECT
        TO_CHAR(sp."createdAt" AT TIME ZONE 'America/Bogota', ${fmt}) AS etiqueta,
        COALESCE(SUM(sp.neto), 0)::float      AS neto,
        COUNT(*)::int                          AS ventas
      FROM "SubPedido" sp
      JOIN "Pedido" p ON p.id = sp."pedidoId"
      WHERE sp."comercioId" = ${comercioId}
        AND p.estado IN ('CONFIRMADO','ENTREGADO')
        AND sp."createdAt" >= ${d} AND sp."createdAt" <= ${h}
      GROUP BY etiqueta ORDER BY etiqueta ASC
    `;
    return { granularidad: trunc, puntos: rows };
  },

  // ─── Admin ─────────────────────────────────────────────────────────────────

  /** 8 KPIs del dashboard admin con delta vs periodo anterior. */
  async dashboardAdmin({ desde, hasta }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    const diffMs = h - d;
    const dAnterior = new Date(d.getTime() - diffMs);
    const hAnterior = new Date(d);

    async function kpis(dDesde, dHasta) {
      const [agg, compradores, comercios, pagosCola] = await Promise.all([
        prisma.$queryRaw`
          SELECT
            COALESCE(SUM(sp.comision), 0)::float  AS comision,
            COALESCE(SUM(sp.subtotal), 0)::float  AS gmv,
            COALESCE(SUM(sp.neto), 0)::float      AS neto_comercios,
            COUNT(DISTINCT sp."pedidoId")::int     AS pedidos,
            COUNT(DISTINCT sp."comercioId")::int   AS comercios_activos
          FROM "SubPedido" sp
          JOIN "Pedido" p ON p.id = sp."pedidoId"
          WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
            AND p."createdAt" >= ${dDesde} AND p."createdAt" < ${dHasta}
        `,
        prisma.usuario.count({
          where: { rol: "COMPRADOR", createdAt: { gte: dDesde, lt: dHasta } },
        }),
        prisma.comercio.count({
          where: { verificado: true, activo: true },
        }),
        prisma.pago.count({ where: { estado: "VERIFICANDO" } }),
      ]);
      const r = Array.isArray(agg) ? agg[0] : agg;
      return { ...r, compradores_nuevos: compradores, comercios_verificados: comercios, pagos_cola: pagosCola };
    }

    const [actual, anterior] = await Promise.all([kpis(d, h), kpis(dAnterior, hAnterior)]);

    function delta(a, b) {
      if (!b || b === 0) return null;
      return Math.round(((a - b) / b) * 1000) / 10;
    }

    return {
      comision:          { valor: actual.comision,          delta: delta(actual.comision, anterior.comision) },
      gmv:               { valor: actual.gmv,               delta: delta(actual.gmv, anterior.gmv) },
      pedidos:           { valor: actual.pedidos,           delta: delta(actual.pedidos, anterior.pedidos) },
      ticket_promedio:   { valor: actual.pedidos > 0 ? actual.gmv / actual.pedidos : 0, delta: null },
      comercios_activos: { valor: actual.comercios_activos, delta: delta(actual.comercios_activos, anterior.comercios_activos) },
      compradores_nuevos:{ valor: actual.compradores_nuevos,delta: delta(actual.compradores_nuevos, anterior.compradores_nuevos) },
      neto_comercios:    { valor: actual.neto_comercios,    delta: delta(actual.neto_comercios, anterior.neto_comercios) },
      pagos_cola:        { valor: actual.pagos_cola,        delta: null },
    };
  },

  /** Serie temporal admin (comisión + GMV + pedidos). */
  async serieAdmin({ desde, hasta }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), 0, 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    const dias = Math.ceil((h - d) / 864e5);
    const trunc = dias <= 31 ? "day" : dias <= 180 ? "week" : "month";
    const fmt   = trunc === "day" ? "YYYY-MM-DD" : trunc === "week" ? "IYYY-IW" : "YYYY-MM";

    return prisma.$queryRaw`
      SELECT
        TO_CHAR(p."createdAt" AT TIME ZONE 'America/Bogota', ${fmt}) AS etiqueta,
        COALESCE(SUM(sp.comision), 0)::float  AS comision,
        COALESCE(SUM(sp.subtotal), 0)::float  AS gmv,
        COUNT(DISTINCT sp."pedidoId")::int     AS pedidos
      FROM "SubPedido" sp
      JOIN "Pedido" p ON p.id = sp."pedidoId"
      WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
        AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
      GROUP BY etiqueta ORDER BY etiqueta ASC
    `;
  },

  /** Comisión + GMV por municipio. */
  async ingresosPorMunicipio({ desde, hasta }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    return prisma.$queryRaw`
      SELECT c.municipio,
             COUNT(DISTINCT sp."pedidoId")::int AS pedidos,
             COUNT(DISTINCT c.id)::int          AS comercios,
             COALESCE(SUM(sp.subtotal), 0)::float AS gmv,
             COALESCE(SUM(sp.comision), 0)::float AS comision
      FROM "SubPedido" sp
      JOIN "Comercio" c ON c.id = sp."comercioId"
      JOIN "Pedido" p   ON p.id = sp."pedidoId"
      WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
        AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
      GROUP BY c.municipio
      ORDER BY comision DESC
    `;
  },

  /** Ranking de comercios por performance. */
  async rankingComercios({ desde, hasta, orden = "comision", limite = 20 }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    return prisma.$queryRaw`
      SELECT c.id, c.nombre, c.municipio, c.calificacion, c."totalReviews",
             COUNT(DISTINCT sp."pedidoId")::int    AS pedidos,
             COALESCE(SUM(sp.subtotal), 0)::float  AS gmv,
             COALESCE(SUM(sp.comision), 0)::float  AS comision,
             COALESCE(SUM(sp.neto), 0)::float      AS neto
      FROM "SubPedido" sp
      JOIN "Comercio" c ON c.id = sp."comercioId"
      JOIN "Pedido" p   ON p.id = sp."pedidoId"
      WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
        AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
      GROUP BY c.id
      ORDER BY comision DESC
      LIMIT ${limite}
    `;
  },

  /** Comercios en riesgo (sin ventas en 30d o 0 ventas históricas). */
  async comerciosEnRiesgo() {
    return prisma.$queryRaw`
      SELECT c.id, c.nombre, c.municipio, c.whatsapp,
             c.calificacion, c."totalReviews",
             MAX(p."createdAt") FILTER (
               WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
             )                                       AS ultima_venta,
             COUNT(p.*) FILTER (
               WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
             )::int                                  AS ventas_historicas
      FROM "Comercio" c
      LEFT JOIN "SubPedido" sp ON sp."comercioId" = c.id
      LEFT JOIN "Pedido" p     ON p.id = sp."pedidoId"
      WHERE c.activo = true AND c.verificado = true AND c."deletedAt" IS NULL
      GROUP BY c.id
      HAVING MAX(p."createdAt") FILTER (
               WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
             ) < NOW() - INTERVAL '30 days'
          OR COUNT(p.*) FILTER (
               WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
             ) = 0
      ORDER BY ultima_venta ASC NULLS FIRST
      LIMIT 50
    `;
  },

  /** Cohortes de retención (mes de primer pedido × meses de actividad). */
  async cohortesRetencion() {
    return prisma.$queryRaw`
      WITH primer_pedido AS (
        SELECT "compradorId",
               DATE_TRUNC('month', MIN("createdAt")) AS cohorte
        FROM "Pedido"
        WHERE estado IN ('CONFIRMADO','ENTREGADO')
        GROUP BY "compradorId"
      ),
      actividad AS (
        SELECT pp.cohorte,
               pp."compradorId",
               DATE_TRUNC('month', p."createdAt") AS mes_actividad
        FROM "Pedido" p
        JOIN primer_pedido pp ON pp."compradorId" = p."compradorId"
        WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
      )
      SELECT
        TO_CHAR(cohorte, 'YYYY-MM')               AS cohorte,
        (EXTRACT(YEAR FROM mes_actividad) - EXTRACT(YEAR FROM cohorte)) * 12
          + (EXTRACT(MONTH FROM mes_actividad) - EXTRACT(MONTH FROM cohorte)) AS mes_n,
        COUNT(DISTINCT "compradorId")::int          AS compradores
      FROM actividad
      GROUP BY cohorte, mes_n
      ORDER BY cohorte, mes_n
    `;
  },

  /** ROI de cupones en el periodo. */
  async cuponesROI({ desde, hasta }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    return prisma.$queryRaw`
      SELECT cu.id, cu.codigo, cu.tipo, cu.valor,
             COUNT(DISTINCT p.id)::int               AS pedidos,
             COALESCE(SUM(p.total), 0)::float        AS gmv_influido,
             COALESCE(SUM(p."cuponDescuento"), 0)::float AS costo_descuento,
             COALESCE(SUM(sp.comision), 0)::float    AS comision_generada,
             (COALESCE(SUM(sp.comision), 0) - COALESCE(SUM(p."cuponDescuento"), 0))::float AS resultado_neto
      FROM "Cupon" cu
      JOIN "Pedido" p     ON p."cuponId" = cu.id
      JOIN "SubPedido" sp ON sp."pedidoId" = p.id
      WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
        AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
      GROUP BY cu.id
      ORDER BY resultado_neto DESC
    `;
  },

  /** Datos completos para el Excel admin (multi-hoja). */
  async *adminExcelStream(filtros, lote = 500) {
    const where = buildWhereAdmin(filtros);
    let cursor;
    while (true) {
      const page = await prisma.subPedido.findMany({
        where,
        orderBy: { id: "asc" },
        take: lote,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          items: { include: { producto: { select: { nombre: true, unidad: true } } } },
          comercio: { select: { nombre: true, municipio: true } },
          pedido: {
            select: {
              codigo: true, estado: true, createdAt: true, cuponDescuento: true,
              comprador: { select: { nombre: true, email: true } },
            },
          },
        },
      });
      if (page.length === 0) break;
      for (const sp of page) yield sp;
      cursor = page[page.length - 1].id;
      if (page.length < lote) break;
    }
  },
};

module.exports = ReporteRepository;
