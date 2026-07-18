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

function rangoPeriodo({ desde, hasta }, inicioPorDefecto = "mes") {
  const now = new Date();
  const d = desde
    ? new Date(`${desde}T00:00:00`)
    : inicioPorDefecto === "anio"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const h = hasta ? new Date(`${hasta}T23:59:59.999`) : now;
  return { d, h };
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

    // Resena no tiene relación directa a Producto (entidadId no es FK real);
    // se resuelven los ids de producto del comercio antes del Promise.all.
    const productoIdsComercio = (await prisma.producto.findMany({ where: { comercioId }, select: { id: true } })).map((p) => p.id);

    const [vendidos, vistas, productos, reviews] = await Promise.all([
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
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.resena.groupBy({
        by: ["entidadId"],
        where: { tipoEntidad: "PRODUCTO", entidadId: { in: productoIdsComercio } },
        _avg: { calificacion: true },
        _count: { _all: true },
      }),
    ]);

    const ventasMap = Object.fromEntries(vendidos.map((v) => [v.productoId, v]));
    const vistasMap = Object.fromEntries(vistas.map((v) => [v.productoId, v._count._all]));
    const reviewsMap = Object.fromEntries(reviews.map((r) => [r.entidadId, r]));

    return productos.map((p) => {
      const v = ventasMap[p.id];
      const unidades = Number(v?._sum?.cantidad ?? 0);
      const ingresos = Number(v?._sum?.subtotal ?? 0);
      const vistasCnt = vistasMap[p.id] ?? 0;
      const review = reviewsMap[p.id];
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
        calificacion: Number(review?._avg?.calificacion ?? 0),
        totalReviews: Number(review?._count?._all ?? 0),
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
    const productoIdsComercio = (await prisma.producto.findMany({ where: { comercioId }, select: { id: true } })).map((p) => p.id);
    const whereBase = { tipoEntidad: "PRODUCTO", entidadId: { in: productoIdsComercio } };
    if (estrellas) whereBase.calificacion = Number(estrellas);

    const [distribucion, evolucionRaw, resenasRaw, total] = await Promise.all([
      prisma.resena.groupBy({
        by: ["calificacion"],
        where: { tipoEntidad: "PRODUCTO", entidadId: { in: productoIdsComercio } },
        _count: { _all: true },
      }),
      prisma.$queryRaw`
        SELECT
          TO_CHAR(r."createdAt" AT TIME ZONE 'America/Bogota', 'YYYY-MM') AS mes,
          ROUND(AVG(r.calificacion)::numeric, 2)::float                    AS promedio,
          COUNT(*)::int                                                      AS total
        FROM "Resena" r
        JOIN "Producto" p ON p.id = r."entidadId"
        WHERE r."tipoEntidad" = 'PRODUCTO' AND p."comercioId" = ${comercioId}
        GROUP BY mes ORDER BY mes ASC
        LIMIT 24
      `,
      prisma.resena.findMany({
        where: whereBase,
        orderBy: { createdAt: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: { autor: { select: { nombre: true } } },
      }),
      prisma.resena.count({ where: whereBase }),
    ]);

    const resenasProductoIds = resenasRaw.map((r) => r.entidadId);
    const resenasProductoInfo = resenasProductoIds.length
      ? await prisma.producto.findMany({ where: { id: { in: resenasProductoIds } }, select: { id: true, nombre: true } })
      : [];
    const resenasProductoPorId = new Map(resenasProductoInfo.map((p) => [p.id, p]));
    const resenas = resenasRaw.map((r) => ({
      id: r.id, productoId: r.entidadId, compradorId: r.autorId,
      calificacion: r.calificacion, comentario: r.comentario, createdAt: r.createdAt,
      autor: r.autor, producto: resenasProductoPorId.get(r.entidadId) ? { nombre: resenasProductoPorId.get(r.entidadId).nombre } : undefined,
    }));

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

  /**
   * Comercios con coordenadas reales (capturadas por GPS en el perfil del
   * comerciante) + ventas agregadas, para el mapa de analítica territorial.
   * No inventa geolocalización de municipio: solo plottea comercios que sí
   * tienen latitud/longitud propias.
   */
  async mapaComerciosAdmin({ desde, hasta }) {
    const d = desde ? new Date(`${desde}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const h = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
    return prisma.$queryRaw`
      SELECT c.id, c.nombre, c.municipio, c.departamento, c.latitud, c.longitud,
             c.calificacion, c."totalReviews",
             COUNT(DISTINCT sp."pedidoId")::int    AS pedidos,
             COALESCE(SUM(sp.subtotal), 0)::float  AS gmv,
             COALESCE(SUM(sp.comision), 0)::float  AS comision
      FROM "Comercio" c
      LEFT JOIN "SubPedido" sp ON sp."comercioId" = c.id
      LEFT JOIN "Pedido" p     ON p.id = sp."pedidoId"
        AND p.estado IN ('CONFIRMADO','ENTREGADO')
        AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
      WHERE c.latitud IS NOT NULL AND c.longitud IS NOT NULL AND c.activo = true
      GROUP BY c.id
      ORDER BY gmv DESC
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
    const { d, h } = rangoPeriodo({ desde, hasta });
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

  /** Categorías que más venden en el marketplace. */
  async categoriasAdmin({ desde, hasta, limite = 50 }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    return prisma.$queryRaw`
      SELECT
        COALESCE(cat.id, 0)::int                       AS id,
        COALESCE(cat.nombre, 'Sin categoría')          AS categoria,
        COUNT(DISTINCT pr.id)::int                     AS productos_vendidos,
        COUNT(DISTINCT sp."comercioId")::int           AS comercios,
        COUNT(DISTINCT sp."pedidoId")::int             AS pedidos,
        COALESCE(SUM(pi.cantidad), 0)::int             AS unidades,
        COALESCE(SUM(pi.subtotal), 0)::float           AS gmv,
        COALESCE(SUM(
          CASE WHEN sp.subtotal > 0 THEN (pi.subtotal / sp.subtotal) * sp.comision ELSE 0 END
        ), 0)::float                                   AS comision_estimada
      FROM "PedidoItem" pi
      JOIN "SubPedido" sp ON sp.id = pi."subPedidoId"
      JOIN "Pedido" ped   ON ped.id = sp."pedidoId"
      JOIN "Producto" pr  ON pr.id = pi."productoId"
      LEFT JOIN "Categoria" cat ON cat.id = pr."categoriaId"
      WHERE ped.estado IN ('CONFIRMADO','ENTREGADO')
        AND ped."createdAt" >= ${d} AND ped."createdAt" <= ${h}
      GROUP BY cat.id, cat.nombre
      ORDER BY gmv DESC
      LIMIT ${Number(limite)}
    `;
  },

  /** Productos líderes por ventas, unidades y conversión. */
  async productosAdmin({ desde, hasta, limite = 50 }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    return prisma.$queryRaw`
      WITH ventas AS (
        SELECT
          pr.id,
          pr.nombre,
          COALESCE(cat.nombre, 'Sin categoría')        AS categoria,
          c.id                                        AS comercio_id,
          c.nombre                                    AS comercio,
          c.municipio                                 AS municipio,
          COUNT(DISTINCT sp."pedidoId")::int          AS pedidos,
          COALESCE(SUM(pi.cantidad), 0)::int          AS unidades,
          COALESCE(SUM(pi.subtotal), 0)::float        AS gmv,
          COALESCE(SUM(
            CASE WHEN sp.subtotal > 0 THEN (pi.subtotal / sp.subtotal) * sp.comision ELSE 0 END
          ), 0)::float                                AS comision_estimada,
          AVG(pi."precioUnitario")::float             AS precio_promedio
        FROM "PedidoItem" pi
        JOIN "SubPedido" sp ON sp.id = pi."subPedidoId"
        JOIN "Pedido" ped   ON ped.id = sp."pedidoId"
        JOIN "Producto" pr  ON pr.id = pi."productoId"
        JOIN "Comercio" c   ON c.id = pr."comercioId"
        LEFT JOIN "Categoria" cat ON cat.id = pr."categoriaId"
        WHERE ped.estado IN ('CONFIRMADO','ENTREGADO')
          AND ped."createdAt" >= ${d} AND ped."createdAt" <= ${h}
        GROUP BY pr.id, cat.nombre, c.id
      ),
      vistas AS (
        SELECT "productoId" AS id, COUNT(*)::int AS vistas
        FROM "VistaProducto"
        WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
        GROUP BY "productoId"
      )
      SELECT
        v.*,
        COALESCE(vis.vistas, 0)::int AS vistas,
        CASE WHEN COALESCE(vis.vistas, 0) > 0
          THEN ROUND(((v.unidades::numeric / vis.vistas::numeric) * 100), 2)::float
          ELSE 0
        END AS conversion
      FROM ventas v
      LEFT JOIN vistas vis ON vis.id = v.id
      ORDER BY v.gmv DESC
      LIMIT ${Number(limite)}
    `;
  },

  /** Ventas por territorio de destino del comprador. */
  async territoriosAdmin({ desde, hasta, limite = 80 }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    return prisma.$queryRaw`
      SELECT
        COALESCE(dir.departamento, 'Sin departamento') AS departamento,
        COALESCE(dir.municipio, 'Sin municipio')       AS municipio,
        COUNT(DISTINCT p.id)::int                      AS pedidos,
        COUNT(DISTINCT p."compradorId")::int           AS compradores,
        COUNT(DISTINCT sp."comercioId")::int           AS comercios,
        COUNT(DISTINCT c.municipio)::int               AS municipios_origen,
        COALESCE(SUM(sp.subtotal), 0)::float           AS gmv,
        COALESCE(SUM(sp.comision), 0)::float           AS comision,
        CASE WHEN COUNT(DISTINCT p.id) > 0
          THEN (COALESCE(SUM(sp.subtotal), 0) / COUNT(DISTINCT p.id))::float
          ELSE 0
        END                                            AS ticket_promedio
      FROM "SubPedido" sp
      JOIN "Pedido" p      ON p.id = sp."pedidoId"
      JOIN "Comercio" c    ON c.id = sp."comercioId"
      LEFT JOIN "Direccion" dir ON dir.id = p."direccionId"
      WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
        AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
      GROUP BY dir.departamento, dir.municipio
      ORDER BY gmv DESC
      LIMIT ${Number(limite)}
    `;
  },

  /** Estado de pagos y dispersiones para control financiero. */
  async pagosAdmin({ desde, hasta }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    const [pagosPorEstado, pagosPorMetodo, dispersionesPorEstado, dispersionesPorProveedor] = await Promise.all([
      prisma.$queryRaw`
        SELECT estado, COUNT(*)::int AS pagos, COALESCE(SUM(monto), 0)::float AS monto
        FROM "Pago"
        WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
        GROUP BY estado
        ORDER BY monto DESC
      `,
      prisma.$queryRaw`
        SELECT metodo, COUNT(*)::int AS pagos, COALESCE(SUM(monto), 0)::float AS monto
        FROM "Pago"
        WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
        GROUP BY metodo
        ORDER BY monto DESC
      `,
      prisma.$queryRaw`
        SELECT estado,
               COUNT(*)::int AS dispersiones,
               COALESCE(SUM("montoBruto"), 0)::float AS monto_bruto,
               COALESCE(SUM(comision), 0)::float AS comision,
               COALESCE(SUM("montoNeto"), 0)::float AS monto_neto
        FROM "PagoDispersion"
        WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
        GROUP BY estado
        ORDER BY monto_neto DESC
      `,
      prisma.$queryRaw`
        SELECT proveedor,
               COUNT(*)::int AS dispersiones,
               COALESCE(SUM("montoNeto"), 0)::float AS monto_neto
        FROM "PagoDispersion"
        WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
        GROUP BY proveedor
        ORDER BY monto_neto DESC
      `,
    ]);

    return { pagosPorEstado, pagosPorMetodo, dispersionesPorEstado, dispersionesPorProveedor };
  },

  /** Operación logística por estado, zona y repartidor. */
  async logisticaAdmin({ desde, hasta, limite = 40 }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    const [porEstado, porZona, porRepartidor] = await Promise.all([
      prisma.$queryRaw`
        SELECT e.estado,
               COUNT(*)::int AS entregas,
               COALESCE(SUM(e."pagoRepartidor"), 0)::float AS pago_repartidores
        FROM "Entrega" e
        JOIN "SubPedido" sp ON sp.id = e."subPedidoId"
        JOIN "Pedido" p ON p.id = sp."pedidoId"
        WHERE p."createdAt" >= ${d} AND p."createdAt" <= ${h}
        GROUP BY e.estado
        ORDER BY entregas DESC
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(dir.departamento, 'Sin departamento') AS departamento,
          COALESCE(dir.municipio, 'Sin municipio')       AS municipio,
          COUNT(*)::int                                  AS entregas,
          COUNT(*) FILTER (WHERE e.estado = 'ENTREGADA')::int AS entregadas,
          COUNT(*) FILTER (WHERE e.estado = 'FALLIDA')::int   AS fallidas,
          COALESCE(SUM(e."pagoRepartidor"), 0)::float    AS pago_repartidores
        FROM "Entrega" e
        JOIN "SubPedido" sp ON sp.id = e."subPedidoId"
        JOIN "Pedido" p ON p.id = sp."pedidoId"
        LEFT JOIN "Direccion" dir ON dir.id = p."direccionId"
        WHERE p."createdAt" >= ${d} AND p."createdAt" <= ${h}
        GROUP BY dir.departamento, dir.municipio
        ORDER BY entregas DESC
        LIMIT ${Number(limite)}
      `,
      prisma.$queryRaw`
        SELECT
          u.id,
          u.nombre,
          COUNT(*)::int AS entregas,
          COUNT(*) FILTER (WHERE e.estado = 'ENTREGADA')::int AS entregadas,
          COUNT(*) FILTER (WHERE e.estado = 'FALLIDA')::int AS fallidas,
          COALESCE(SUM(e."pagoRepartidor"), 0)::float AS pago_repartidores
        FROM "Entrega" e
        LEFT JOIN "Usuario" u ON u.id = e."repartidorId"
        JOIN "SubPedido" sp ON sp.id = e."subPedidoId"
        JOIN "Pedido" p ON p.id = sp."pedidoId"
        WHERE p."createdAt" >= ${d} AND p."createdAt" <= ${h}
        GROUP BY u.id, u.nombre
        ORDER BY entregas DESC
        LIMIT ${Number(limite)}
      `,
    ]);

    return { porEstado, porZona, porRepartidor };
  },

  /** Clientes: nuevos vs recurrentes, top compradores y origen territorial. */
  async clientesAdmin({ desde, hasta, limite = 50 }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    const [resumenRows, topClientes, porMunicipio] = await Promise.all([
      prisma.$queryRaw`
        WITH historico AS (
          SELECT "compradorId", MIN("createdAt") AS primer_pedido
          FROM "Pedido"
          WHERE estado IN ('CONFIRMADO','ENTREGADO')
          GROUP BY "compradorId"
        ),
        periodo AS (
          SELECT *
          FROM "Pedido"
          WHERE estado IN ('CONFIRMADO','ENTREGADO')
            AND "createdAt" >= ${d} AND "createdAt" <= ${h}
        )
        SELECT
          COUNT(DISTINCT periodo."compradorId")::int AS compradores_activos,
          COUNT(DISTINCT periodo."compradorId") FILTER (WHERE historico.primer_pedido >= ${d})::int AS compradores_nuevos,
          COUNT(DISTINCT periodo."compradorId") FILTER (WHERE historico.primer_pedido < ${d})::int AS compradores_recurrentes,
          COUNT(*)::int AS pedidos,
          COALESCE(SUM(periodo.total), 0)::float AS gmv,
          COALESCE(AVG(periodo.total), 0)::float AS ticket_promedio
        FROM periodo
        JOIN historico ON historico."compradorId" = periodo."compradorId"
      `,
      prisma.$queryRaw`
        SELECT
          u.id,
          u.nombre,
          u.email,
          u.telefono,
          MAX(COALESCE(u.municipio, dir.municipio, 'Sin municipio')) AS municipio,
          COUNT(p.id)::int AS pedidos,
          COALESCE(SUM(p.total), 0)::float AS gmv,
          MAX(p."createdAt") AS ultima_compra
        FROM "Pedido" p
        JOIN "Usuario" u ON u.id = p."compradorId"
        LEFT JOIN "Direccion" dir ON dir.id = p."direccionId"
        WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
          AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
        GROUP BY u.id
        ORDER BY gmv DESC
        LIMIT ${Number(limite)}
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(dir.departamento, 'Sin departamento') AS departamento,
          COALESCE(dir.municipio, u.municipio, 'Sin municipio') AS municipio,
          COUNT(DISTINCT p."compradorId")::int AS compradores,
          COUNT(p.id)::int AS pedidos,
          COALESCE(SUM(p.total), 0)::float AS gmv
        FROM "Pedido" p
        JOIN "Usuario" u ON u.id = p."compradorId"
        LEFT JOIN "Direccion" dir ON dir.id = p."direccionId"
        WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
          AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
        GROUP BY dir.departamento, dir.municipio, u.municipio
        ORDER BY gmv DESC
        LIMIT ${Number(limite)}
      `,
    ]);

    return { resumen: resumenRows[0] ?? {}, topClientes, porMunicipio };
  },

  /** Alertas accionables para priorizar decisiones de administracion. */
  async alertasAdmin({ desde, hasta }) {
    const { d, h } = rangoPeriodo({ desde, hasta });
    const diffMs = Math.max(h.getTime() - d.getTime(), 864e5);
    const dAnterior = new Date(d.getTime() - diffMs);
    const hAnterior = new Date(d.getTime());

    const [
      productosSinStockConDemanda,
      productosVistosSinVenta,
      pagosAtencion,
      dispersionesAtencion,
      comerciosCaida,
      zonasEntregaFallida,
    ] = await Promise.all([
      prisma.$queryRaw`
        WITH vistas AS (
          SELECT "productoId", COUNT(*)::int AS vistas
          FROM "VistaProducto"
          WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
          GROUP BY "productoId"
        ),
        ventas AS (
          SELECT pi."productoId", COALESCE(SUM(pi.cantidad), 0)::int AS unidades, COALESCE(SUM(pi.subtotal), 0)::float AS gmv
          FROM "PedidoItem" pi
          JOIN "SubPedido" sp ON sp.id = pi."subPedidoId"
          JOIN "Pedido" ped ON ped.id = sp."pedidoId"
          WHERE ped.estado IN ('CONFIRMADO','ENTREGADO')
            AND ped."createdAt" >= ${d} AND ped."createdAt" <= ${h}
          GROUP BY pi."productoId"
        )
        SELECT
          pr.id,
          pr.nombre,
          COALESCE(cat.nombre, 'Sin categoría') AS categoria,
          c.nombre AS comercio,
          c.municipio,
          (pr.stock - pr."stockReservado")::int AS stock_disponible,
          COALESCE(vistas.vistas, 0)::int AS vistas,
          COALESCE(ventas.unidades, 0)::int AS unidades,
          COALESCE(ventas.gmv, 0)::float AS gmv
        FROM "Producto" pr
        JOIN "Comercio" c ON c.id = pr."comercioId"
        LEFT JOIN "Categoria" cat ON cat.id = pr."categoriaId"
        LEFT JOIN vistas ON vistas."productoId" = pr.id
        LEFT JOIN ventas ON ventas."productoId" = pr.id
        WHERE pr.activo = true
          AND pr."deletedAt" IS NULL
          AND (pr.stock - pr."stockReservado") <= 0
          AND (COALESCE(vistas.vistas, 0) > 0 OR COALESCE(ventas.unidades, 0) > 0)
        ORDER BY COALESCE(ventas.gmv, 0) DESC, COALESCE(vistas.vistas, 0) DESC
        LIMIT 25
      `,
      prisma.$queryRaw`
        WITH vistas AS (
          SELECT "productoId", COUNT(*)::int AS vistas
          FROM "VistaProducto"
          WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
          GROUP BY "productoId"
        ),
        ventas AS (
          SELECT pi."productoId", COALESCE(SUM(pi.cantidad), 0)::int AS unidades
          FROM "PedidoItem" pi
          JOIN "SubPedido" sp ON sp.id = pi."subPedidoId"
          JOIN "Pedido" ped ON ped.id = sp."pedidoId"
          WHERE ped.estado IN ('CONFIRMADO','ENTREGADO')
            AND ped."createdAt" >= ${d} AND ped."createdAt" <= ${h}
          GROUP BY pi."productoId"
        )
        SELECT
          pr.id,
          pr.nombre,
          COALESCE(cat.nombre, 'Sin categoría') AS categoria,
          c.nombre AS comercio,
          c.municipio,
          (pr.stock - pr."stockReservado")::int AS stock_disponible,
          COALESCE(vistas.vistas, 0)::int AS vistas
        FROM "Producto" pr
        JOIN "Comercio" c ON c.id = pr."comercioId"
        LEFT JOIN "Categoria" cat ON cat.id = pr."categoriaId"
        JOIN vistas ON vistas."productoId" = pr.id
        LEFT JOIN ventas ON ventas."productoId" = pr.id
        WHERE pr.activo = true
          AND pr."deletedAt" IS NULL
          AND (pr.stock - pr."stockReservado") > 0
          AND vistas.vistas >= 10
          AND COALESCE(ventas.unidades, 0) = 0
        ORDER BY vistas.vistas DESC
        LIMIT 25
      `,
      prisma.$queryRaw`
        SELECT
          estado,
          COUNT(*)::int AS pagos,
          COALESCE(SUM(monto), 0)::float AS monto,
          MIN("createdAt") AS desde,
          MAX("createdAt") AS ultimo
        FROM "Pago"
        WHERE "createdAt" >= ${d} AND "createdAt" <= ${h}
          AND estado IN ('VERIFICANDO','FALLIDO')
        GROUP BY estado
        ORDER BY monto DESC
      `,
      prisma.$queryRaw`
        SELECT
          pd.estado,
          c.id AS comercio_id,
          c.nombre AS comercio,
          c.municipio,
          COUNT(*)::int AS dispersiones,
          COALESCE(SUM(pd."montoNeto"), 0)::float AS monto_neto,
          MAX(pd."errorMensaje") AS error_mensaje,
          MIN(pd."createdAt") AS primer_evento,
          MAX(pd."createdAt") AS ultimo_evento
        FROM "PagoDispersion" pd
        JOIN "Comercio" c ON c.id = pd."comercioId"
        WHERE pd."createdAt" >= ${d} AND pd."createdAt" <= ${h}
          AND (
            pd.estado = 'FALLIDA'
            OR (pd.estado = 'PENDIENTE' AND pd."createdAt" < NOW() - INTERVAL '24 hours')
          )
        GROUP BY pd.estado, c.id
        ORDER BY monto_neto DESC
        LIMIT 30
      `,
      prisma.$queryRaw`
        WITH actual AS (
          SELECT sp."comercioId", COUNT(DISTINCT sp."pedidoId")::int AS pedidos, COALESCE(SUM(sp.subtotal), 0)::float AS gmv
          FROM "SubPedido" sp
          JOIN "Pedido" p ON p.id = sp."pedidoId"
          WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
            AND p."createdAt" >= ${d} AND p."createdAt" <= ${h}
          GROUP BY sp."comercioId"
        ),
        anterior AS (
          SELECT sp."comercioId", COUNT(DISTINCT sp."pedidoId")::int AS pedidos, COALESCE(SUM(sp.subtotal), 0)::float AS gmv
          FROM "SubPedido" sp
          JOIN "Pedido" p ON p.id = sp."pedidoId"
          WHERE p.estado IN ('CONFIRMADO','ENTREGADO')
            AND p."createdAt" >= ${dAnterior} AND p."createdAt" < ${hAnterior}
          GROUP BY sp."comercioId"
        )
        SELECT
          c.id,
          c.nombre,
          c.municipio,
          COALESCE(actual.pedidos, 0)::int AS pedidos_actual,
          anterior.pedidos::int AS pedidos_anterior,
          COALESCE(actual.gmv, 0)::float AS gmv_actual,
          anterior.gmv::float AS gmv_anterior,
          ROUND(((COALESCE(actual.gmv, 0)::numeric - anterior.gmv::numeric) / NULLIF(anterior.gmv::numeric, 0)) * 100, 1)::float AS variacion_pct
        FROM anterior
        JOIN "Comercio" c ON c.id = anterior."comercioId"
        LEFT JOIN actual ON actual."comercioId" = anterior."comercioId"
        WHERE anterior.gmv > 0
          AND COALESCE(actual.gmv, 0) < anterior.gmv * 0.5
          AND c.activo = true
          AND c."deletedAt" IS NULL
        ORDER BY variacion_pct ASC
        LIMIT 30
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(dir.departamento, 'Sin departamento') AS departamento,
          COALESCE(dir.municipio, 'Sin municipio') AS municipio,
          COUNT(*)::int AS entregas,
          COUNT(*) FILTER (WHERE e.estado = 'FALLIDA')::int AS fallidas,
          ROUND((COUNT(*) FILTER (WHERE e.estado = 'FALLIDA')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1)::float AS tasa_falla,
          COALESCE(SUM(e."pagoRepartidor"), 0)::float AS pago_repartidores
        FROM "Entrega" e
        JOIN "SubPedido" sp ON sp.id = e."subPedidoId"
        JOIN "Pedido" p ON p.id = sp."pedidoId"
        LEFT JOIN "Direccion" dir ON dir.id = p."direccionId"
        WHERE p."createdAt" >= ${d} AND p."createdAt" <= ${h}
        GROUP BY dir.departamento, dir.municipio
        HAVING COUNT(*) >= 3
           AND COUNT(*) FILTER (WHERE e.estado = 'FALLIDA') > 0
        ORDER BY tasa_falla DESC, fallidas DESC
        LIMIT 25
      `,
    ]);

    return {
      productosSinStockConDemanda,
      productosVistosSinVenta,
      pagosAtencion,
      dispersionesAtencion,
      comerciosCaida,
      zonasEntregaFallida,
    };
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
