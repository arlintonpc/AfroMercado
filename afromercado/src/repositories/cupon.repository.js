const prisma = require("../config/prisma");

function normalizarSubtotalesPorComercio(subtotalesPorComercio) {
  if (subtotalesPorComercio instanceof Map) return subtotalesPorComercio;
  if (Array.isArray(subtotalesPorComercio)) {
    return new Map(
      subtotalesPorComercio.map(([comercioId, subtotal]) => [Number(comercioId), Number(subtotal)])
    );
  }
  if (subtotalesPorComercio && typeof subtotalesPorComercio === "object") {
    return new Map(
      Object.entries(subtotalesPorComercio).map(([comercioId, subtotal]) => [
        Number(comercioId),
        Number(subtotal),
      ])
    );
  }
  return new Map();
}

function sumarSubtotales(mapa) {
  let total = 0;
  for (const valor of mapa.values()) total += Number(valor) || 0;
  return total;
}

async function validarCuponBase(db, {
  codigo,
  usuarioId,
  subtotal,
  comercioIds = [],
  subtotalesPorComercio = null,
  subtotalesElegibles = null,
  bloquear = false,
}) {
  let cupon;

  if (bloquear) {
    const [bloqueado] = await db.$queryRaw`
      SELECT id
      FROM "Cupon"
      WHERE codigo = ${codigo}
      FOR UPDATE
    `;
    if (!bloqueado) return { error: "El cupón no existe" };
    cupon = await db.cupon.findUnique({
      where: { id: bloqueado.id },
      include: { comercios: { select: { comercioId: true } } },
    });
  } else {
    cupon = await db.cupon.findUnique({
      where: { codigo },
      include: { comercios: { select: { comercioId: true } } },
    });
  }

  if (!cupon) return { error: "El cupón no existe" };
  if (!cupon.activo) return { error: "Este cupón no está activo" };

  const ahora = new Date();
  if (ahora < cupon.inicio) return { error: "Este cupón aún no está vigente" };
  if (ahora > cupon.fin) return { error: "Este cupón ya expiró" };

  // Límite global
  if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) {
    return { error: "Este cupón ya alcanzó el límite de usos" };
  }

  // Usos del usuario actual
  const usosDelUsuario = await db.cuponUso.count({
    where: { cuponId: cupon.id, usuarioId },
  });

  // Distribución ASIGNADO: verificar que el usuario está en la lista
  if (cupon.distribucion === "ASIGNADO") {
    const asignado = await db.cuponAsignacion.findUnique({
      where: { cuponId_usuarioId: { cuponId: cupon.id, usuarioId } },
    });
    if (!asignado) return { error: "Este cupón no está disponible para tu cuenta" };
  }

  // Límite de usos por usuario
  const maxPorUsuario = cupon.usosMaximosPorUsuario;
  if (maxPorUsuario !== null && usosDelUsuario >= maxPorUsuario) {
    return { error: `Ya usaste este cupón el máximo de veces permitidas (${maxPorUsuario})` };
  }

  // Compatibilidad: si no hay límite por usuario y distribucion PUBLICO → máximo 1 uso salvo que tenga maxPorUsuario
  if (maxPorUsuario === null && cupon.distribucion === "PUBLICO") {
    const yaUsado = await db.cuponUso.findFirst({
      where: { cuponId: cupon.id, usuarioId },
    });
    if (yaUsado) return { error: "Ya usaste este cupón anteriormente" };
  }

  // Solo nuevos compradores
  if (cupon.soloNuevos) {
    const pedidoPrevio = await db.pedido.findFirst({
      where: { compradorId: usuarioId, estado: { in: ["CONFIRMADO", "ENTREGADO"] } },
    });
    if (pedidoPrevio) return { error: "Este cupón es solo para compradores nuevos" };
  }

  const subtotalesMapa = normalizarSubtotalesPorComercio(subtotalesPorComercio);
  const subtotalTotal = subtotalesMapa.size > 0
    ? sumarSubtotales(subtotalesMapa)
    : Number(subtotal) || 0;

  // Restricción por comercio
  const comerciosRestringidos = cupon.comercios.map((c) => c.comercioId);
  let subtotalAplicable = subtotalTotal;
  if (comerciosRestringidos.length > 0) {
    if (subtotalesMapa.size > 0) {
      subtotalAplicable = comerciosRestringidos.reduce(
        (acc, comercioId) => acc + Number(subtotalesMapa.get(comercioId) ?? 0),
        0
      );
      if (subtotalAplicable <= 0) {
        return { error: "Este cupón no aplica para los productos de tu carrito" };
      }
    } else {
      const hayInterseccion = comercioIds.some((id) => comerciosRestringidos.includes(id));
      if (!hayInterseccion) {
        return { error: "Este cupón no aplica para los productos de tu carrito" };
      }
    }
  }

  if (cupon.minimoCompra !== null && subtotalAplicable < Number(cupon.minimoCompra)) {
    return {
      error: `El cupón requiere una compra mínima de $${Number(cupon.minimoCompra).toLocaleString("es-CO")}`,
    };
  }

  // Base del descuento: por defecto = subtotalAplicable. Si se pasan subtotales
  // "elegibles" (p. ej. excluyendo productos en oferta cuando la regla
  // cupon_combinable_con_oferta es false), el descuento se calcula sobre esa
  // base menor; el total del pedido (subtotalTotal) no cambia.
  let baseDescuento = subtotalAplicable;
  if (subtotalesElegibles) {
    const elegiblesMapa = normalizarSubtotalesPorComercio(subtotalesElegibles);
    baseDescuento = comerciosRestringidos.length > 0
      ? comerciosRestringidos.reduce((acc, cid) => acc + Number(elegiblesMapa.get(cid) ?? 0), 0)
      : sumarSubtotales(elegiblesMapa);
  }

  let descuento;
  if (cupon.tipo === "PORCENTAJE") {
    descuento = Math.min(baseDescuento * (Number(cupon.valor) / 100), baseDescuento);
  } else {
    descuento = Math.min(Number(cupon.valor), baseDescuento);
  }

  const descuentoRedondeado = Math.round(descuento);
  const subtotalTotalRedondeado = Math.round(subtotalTotal);

  return {
    cupon,
    descuento: descuentoRedondeado,
    subtotalAplicable: Math.round(subtotalAplicable),
    totalConDescuento: Math.max(0, subtotalTotalRedondeado - descuentoRedondeado),
    comerciosRestringidos,
  };
}

const CuponRepository = {
  async buscarPorCodigo(codigo) {
    return prisma.cupon.findUnique({
      where: { codigo },
      include: { comercios: true },
    });
  },

  /**
   * Valida si un cupón es aplicable para un usuario en un carrito dado.
   * @param {string} codigo
   * @param {number} usuarioId
   * @param {number} subtotal - subtotal total del carrito
   * @param {number[]} comercioIds - IDs de los comercios que tiene el carrito
   */
  async validarParaUsuario(codigo, usuarioId, subtotal, comercioIds = [], subtotalesPorComercio = null) {
    return validarCuponBase(prisma, { codigo, usuarioId, subtotal, comercioIds, subtotalesPorComercio });
  },

  /**
   * Valida un cupón dentro de una transacción y bloquea la fila para evitar
   * carreras de consumo simultáneo.
   */
  async validarParaCheckout(tx, { codigo, usuarioId, subtotal, subtotalesPorComercio = null, subtotalesElegibles = null }) {
    return validarCuponBase(tx, {
      codigo,
      usuarioId,
      subtotal,
      subtotalesPorComercio,
      subtotalesElegibles,
      bloquear: true,
    });
  },

  async incrementarUso(cuponId, tx) {
    const db = tx || prisma;
    return db.cupon.update({
      where: { id: cuponId },
      data: { usosActuales: { increment: 1 } },
    });
  },

  async registrarUso({ cuponId, usuarioId, pedidoId }, tx) {
    const db = tx || prisma;
    return db.cuponUso.create({
      data: { cuponId, usuarioId, pedidoId },
    });
  },

  async crearAdmin(datos) {
    const { comercioIds = [], usuarioIds = [], ...campos } = datos;
    return prisma.cupon.create({
      data: {
        ...campos,
        ...(comercioIds.length > 0 && {
          comercios: {
            create: comercioIds.map((id) => ({ comercioId: id })),
          },
        }),
        ...(campos.distribucion === "ASIGNADO" && usuarioIds.length > 0 && {
          asignaciones: {
            create: usuarioIds.map((id) => ({ usuarioId: id })),
          },
        }),
      },
      include: { comercios: true, asignaciones: { select: { usuarioId: true } } },
    });
  },

  async listarAdmin({ pagina = 1, porPagina = 20 } = {}) {
    const skip = (pagina - 1) * porPagina;
    const [items, total] = await Promise.all([
      prisma.cupon.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: porPagina,
        include: {
          comercios: { include: { comercio: { select: { id: true, nombre: true } } } },
          _count: { select: { usos: true, asignaciones: true } },
        },
      }),
      prisma.cupon.count(),
    ]);
    return { items, total, pagina, porPagina };
  },

  async desactivar(id) {
    return prisma.cupon.update({ where: { id }, data: { activo: false } });
  },

  // Estadísticas de uso de un cupón específico
  async estadisticas(id) {
    const [usos, usuariosUnicos] = await Promise.all([
      prisma.cuponUso.count({ where: { cuponId: id } }),
      prisma.cuponUso.groupBy({ by: ["usuarioId"], where: { cuponId: id }, _count: true }),
    ]);
    return { usos, usuariosUnicos: usuariosUnicos.length };
  },

  // ── AUDITORÍA Y REPORTERÍA ─────────────────────────────────────────────────

  /**
   * KPIs económicos y de adopción de un cupón, desglosados por estado del pedido.
   * Esta es la fuente del Tab A (resumen) del detalle de cupón.
   */
  async metricas(cuponId) {
    const cupon = await prisma.cupon.findUnique({
      where: { id: cuponId },
      include: { comercios: { include: { comercio: { select: { nombre: true } } } } },
    });
    if (!cupon) return null;

    // Pedidos con este cupón, agrupados por estado
    const pedidosPorEstado = await prisma.$queryRaw`
      SELECT
        estado,
        COUNT(*)::int                              AS pedidos,
        COALESCE(SUM("cuponDescuento"), 0)::float  AS descuento,
        COALESCE(SUM(subtotal), 0)::float          AS gmv,
        COALESCE(AVG(total), 0)::float             AS ticket_promedio
      FROM "Pedido"
      WHERE "cuponId" = ${cuponId}
      GROUP BY estado
    `;

    // Redenciones reales (log)
    const [redenciones, gruposUsuario, comerciosImpactados, primeraUltima] = await Promise.all([
      prisma.cuponUso.count({ where: { cuponId } }),
      prisma.cuponUso.groupBy({ by: ["usuarioId"], where: { cuponId }, _count: true }),
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT sp."comercioId")::int AS n
        FROM "SubPedido" sp
        JOIN "Pedido" p ON p.id = sp."pedidoId"
        WHERE p."cuponId" = ${cuponId}
      `,
      prisma.cuponUso.aggregate({
        where: { cuponId },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ]);

    const estadoMap = {};
    const ESTADOS = ["PENDIENTE_PAGO","VERIFICANDO_PAGO","CONFIRMADO","ENTREGADO","CANCELADO"];
    ESTADOS.forEach(e => estadoMap[e] = { pedidos: 0, descuento: 0, gmv: 0, ticket_promedio: 0 });
    for (const fila of pedidosPorEstado) estadoMap[fila.estado] = fila;

    const confirmados = ["CONFIRMADO","ENTREGADO"];
    const enRiesgo    = ["PENDIENTE_PAGO","VERIFICANDO_PAGO"];

    const descRealizado = confirmados.reduce((s, e) => s + (estadoMap[e]?.descuento ?? 0), 0);
    const descEnRiesgo  = enRiesgo.reduce((s, e) => s + (estadoMap[e]?.descuento ?? 0), 0);
    const descPerdido   = estadoMap["CANCELADO"]?.descuento ?? 0;
    const descBruto     = descRealizado + descEnRiesgo + descPerdido;
    const gmvAtribuido  = confirmados.reduce((s, e) => s + (estadoMap[e]?.gmv ?? 0), 0);
    const pedidosTotales = ESTADOS.reduce((s, e) => s + (estadoMap[e]?.pedidos ?? 0), 0);
    const pedidosConfirmados = confirmados.reduce((s, e) => s + (estadoMap[e]?.pedidos ?? 0), 0);

    // Comisión generada (10%)
    const comisionGenerada = await prisma.$queryRaw`
      SELECT COALESCE(SUM(sp.comision), 0)::float AS total
      FROM "SubPedido" sp
      JOIN "Pedido" p ON p.id = sp."pedidoId"
      WHERE p."cuponId" = ${cuponId} AND p.estado IN ('CONFIRMADO','ENTREGADO')
    `;

    const ahora = new Date();
    const diasTotal = Math.max(1, Math.round((new Date(cupon.fin) - new Date(cupon.inicio)) / 86400000));
    const diasTranscurridos = Math.min(diasTotal, Math.max(0, Math.round((ahora - new Date(cupon.inicio)) / 86400000)));

    // Detectar drift entre contador y log
    const integridadOk = cupon.usosActuales === redenciones;

    return {
      cupon: {
        ...cupon,
        estadoCalculado:
          !cupon.activo ? "INACTIVO"
          : ahora < cupon.inicio ? "PROGRAMADO"
          : ahora > cupon.fin ? "EXPIRADO"
          : cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos ? "AGOTADO"
          : "VIGENTE",
        cupoRestante: cupon.usosMaximos !== null ? cupon.usosMaximos - cupon.usosActuales : null,
        pctCupoConsumido: cupon.usosMaximos ? cupon.usosActuales / cupon.usosMaximos : null,
      },
      adopcion: {
        redenciones,
        usuariosUnicos: gruposUsuario.length,
        redencionesPorUsuario: gruposUsuario.length > 0 ? +(redenciones / gruposUsuario.length).toFixed(2) : 0,
        comerciosImpactados: Number(comerciosImpactados[0]?.n ?? 0),
        primeraRedencion: primeraUltima._min.createdAt,
        ultimaRedencion:  primeraUltima._max.createdAt,
      },
      economia: {
        descuentoOtorgadoBruto: Math.round(descBruto),
        descuentoRealizado:     Math.round(descRealizado),
        descuentoEnRiesgo:      Math.round(descEnRiesgo),
        descuentoPerdido:       Math.round(descPerdido),
        gmvAtribuido:           Math.round(gmvAtribuido),
        comisionGenerada:       Math.round(Number(comisionGenerada[0]?.total ?? 0)),
        descuentoPromedioPorRedencion: pedidosConfirmados > 0 ? Math.round(descRealizado / pedidosConfirmados) : 0,
        costoDescuentoSobreVentas: gmvAtribuido > 0 ? +(descRealizado / gmvAtribuido).toFixed(4) : 0,
      },
      eficiencia: {
        pedidosTotales,
        pedidosConfirmados,
        tasaConfirmacion: pedidosTotales > 0 ? +(pedidosConfirmados / pedidosTotales).toFixed(3) : 0,
        tasaCancelacion: pedidosTotales > 0 ? +(estadoMap["CANCELADO"].pedidos / pedidosTotales).toFixed(3) : 0,
        ritmoRedencionPorDia: diasTranscurridos > 0 ? +(redenciones / diasTranscurridos).toFixed(1) : 0,
        diasTranscurridos,
        diasTotales: diasTotal,
      },
      porEstado: estadoMap,
      integridad: {
        contadorVsLog: cupon.usosActuales - redenciones,
        ok: integridadOk,
      },
    };
  },

  /**
   * Log paginado de usos, filtrable. Sirve tanto para el tab B del detalle
   * como para la vista global /admin/cupones/usos.
   */
  async logUsos({ cuponId, estado, desde, hasta, q, pagina = 1, porPagina = 50 } = {}) {
    const skip = (pagina - 1) * porPagina;
    const where = {};
    if (cuponId) where.cuponId = cuponId;
    if (desde || hasta) where.createdAt = { ...(desde && { gte: new Date(desde) }), ...(hasta && { lte: new Date(hasta) }) };
    if (estado?.length) where.pedido = { estado: { in: estado } };
    if (q) {
      where.OR = [
        { usuario: { nombre:   { contains: q, mode: "insensitive" } } },
        { usuario: { email:    { contains: q, mode: "insensitive" } } },
        { usuario: { telefono: { contains: q, mode: "insensitive" } } },
        { pedido:  { codigo:   { contains: q, mode: "insensitive" } } },
        { cupon:   { codigo:   { contains: q, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cuponUso.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: porPagina,
        include: {
          cupon: { select: { id: true, codigo: true, tipo: true, valor: true } },
          usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
          pedido: {
            select: {
              id: true, codigo: true, estado: true,
              subtotal: true, total: true, cuponDescuento: true,
              createdAt: true,
              subPedidos: { select: { comercio: { select: { id: true, nombre: true, municipio: true } } } },
            },
          },
        },
      }),
      prisma.cuponUso.count({ where }),
    ]);

    // Enriquecer: % efectivo, n.º de uso del usuario para ese cupón
    const enriquecidos = await Promise.all(
      items.map(async (uso) => {
        const nUso = await prisma.cuponUso.count({
          where: { cuponId: uso.cuponId, usuarioId: uso.usuarioId, createdAt: { lte: uso.createdAt } },
        });
        const subtotal = Number(uso.pedido.subtotal);
        const descuento = Number(uso.pedido.cuponDescuento ?? 0);
        const pctEfectivo = subtotal > 0 ? +(descuento / subtotal * 100).toFixed(2) : 0;
        return { ...uso, nUsoDelUsuario: nUso, pctEfectivo };
      })
    );

    return { items: enriquecidos, total, pagina, porPagina };
  },

  /**
   * Agregación por comercio con prorrateo del descuento.
   * El descuento está en Pedido (no en SubPedido), se distribuye proporcional al subtotal.
   */
  async porComercio(cuponId) {
    const rows = await prisma.$queryRaw`
      SELECT
        c.id,
        c.nombre,
        c.municipio,
        COUNT(DISTINCT p.id)::int                                                  AS pedidos,
        COALESCE(SUM(sp.subtotal), 0)::float                                       AS gmv,
        COALESCE(SUM(
          p."cuponDescuento" * (sp.subtotal / NULLIF(p.subtotal, 0))
        ), 0)::float                                                               AS descuento_prorrateado,
        COALESCE(SUM(sp.comision), 0)::float                                       AS comision
      FROM "SubPedido" sp
      JOIN "Pedido"   p ON p.id = sp."pedidoId"
      JOIN "Comercio" c ON c.id = sp."comercioId"
      WHERE p."cuponId" = ${cuponId}
        AND p.estado IN ('CONFIRMADO','ENTREGADO')
      GROUP BY c.id, c.nombre, c.municipio
      ORDER BY descuento_prorrateado DESC
    `;
    return rows.map(r => ({
      ...r,
      gmv: Math.round(r.gmv),
      descuento_prorrateado: Math.round(r.descuento_prorrateado),
      comision: Math.round(r.comision),
    }));
  },

  /**
   * Ranking de usuarios + histograma de veces de uso.
   */
  async porUsuario(cuponId) {
    const ranking = await prisma.$queryRaw`
      SELECT
        u.id, u.nombre, u.email, u.telefono,
        COUNT(cu.id)::int                               AS veces,
        COALESCE(SUM(p."cuponDescuento"), 0)::float     AS descuento_total,
        COALESCE(SUM(p.subtotal), 0)::float             AS gmv_total,
        MAX(cu."createdAt")                             AS ultima_redencion,
        MIN(cu."createdAt")                             AS primera_redencion
      FROM "CuponUso" cu
      JOIN "Usuario" u ON u.id = cu."usuarioId"
      JOIN "Pedido"  p ON p.id = cu."pedidoId"
      WHERE cu."cuponId" = ${cuponId}
      GROUP BY u.id, u.nombre, u.email, u.telefono
      ORDER BY veces DESC, descuento_total DESC
      LIMIT 100
    `;

    // Histograma: cuántos usuarios usaron 1 vez, 2 veces, 3+
    const histograma = { 1: 0, 2: 0, "3+": 0 };
    for (const r of ranking) {
      if (r.veces === 1) histograma[1]++;
      else if (r.veces === 2) histograma[2]++;
      else histograma["3+"]++;
    }

    return {
      ranking: ranking.map(r => ({
        ...r,
        descuento_total: Math.round(r.descuento_total),
        gmv_total: Math.round(r.gmv_total),
      })),
      histograma,
    };
  },

  /**
   * Serie temporal de redenciones para el gráfico (Tab A).
   */
  async serie(cuponId, intervalo = "dia") {
    const trunc = intervalo === "semana" ? "week" : "day";
    const rows = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC(${trunc}, cu."createdAt")::date AS fecha,
        COUNT(*)::int                               AS redenciones,
        COALESCE(SUM(p."cuponDescuento"), 0)::float AS descuento
      FROM "CuponUso" cu
      JOIN "Pedido" p ON p.id = cu."pedidoId"
      WHERE cu."cuponId" = ${cuponId}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map(r => ({ ...r, descuento: Math.round(r.descuento) }));
  },

  /**
   * Tarjetas del dashboard general (/admin/cupones).
   */
  async resumenGlobal({ desde, hasta } = {}) {
    const rango = {};
    if (desde) rango.gte = new Date(desde);
    if (hasta) rango.lte = new Date(hasta);
    const whereUso = Object.keys(rango).length ? { createdAt: rango } : {};

    const [
      redencionesMes,
      cupones,
      descuentoRows,
      topCupon,
    ] = await Promise.all([
      prisma.cuponUso.count({ where: whereUso }),
      prisma.cupon.findMany({
        where: { activo: true },
        select: {
          id: true, codigo: true, activo: true, inicio: true, fin: true,
          usosMaximos: true, usosActuales: true, _count: { select: { usos: true } }
        },
      }),
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(p."cuponDescuento"), 0)::float  AS descuento_total,
          COALESCE(SUM(p.subtotal), 0)::float           AS gmv_total
        FROM "Pedido" p
        WHERE p."cuponId" IS NOT NULL
          AND p.estado IN ('CONFIRMADO','ENTREGADO')
          AND (${desde ? new Date(desde) : null}::timestamptz IS NULL OR p."createdAt" >= ${desde ? new Date(desde) : null}::timestamptz)
          AND (${hasta ? new Date(hasta) : null}::timestamptz IS NULL OR p."createdAt" <= ${hasta ? new Date(hasta) : null}::timestamptz)
      `,
      prisma.cuponUso.groupBy({
        by: ["cuponId"],
        where: whereUso,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
    ]);

    const ahora = new Date();
    const activos = cupones.filter(c => c.activo && ahora >= c.inicio && ahora <= c.fin && (c.usosMaximos === null || c.usosActuales < c.usosMaximos));
    const proxVencer = cupones
      .filter(c => c.activo && ahora >= c.inicio && ahora <= c.fin)
      .sort((a, b) => new Date(a.fin) - new Date(b.fin))[0] ?? null;

    let topCuponNombre = null;
    if (topCupon.length > 0) {
      const c = await prisma.cupon.findUnique({ where: { id: topCupon[0].cuponId }, select: { codigo: true } });
      topCuponNombre = c?.codigo ?? null;
    }

    return {
      redenciones: redencionesMes,
      cuponesActivos: activos.length,
      descuentoRealizado: Math.round(Number(descuentoRows[0]?.descuento_total ?? 0)),
      gmvAtribuido: Math.round(Number(descuentoRows[0]?.gmv_total ?? 0)),
      topCupon: topCuponNombre,
      proxVencer: proxVencer ? { codigo: proxVencer.codigo, fin: proxVencer.fin } : null,
    };
  },

  /**
   * Tabla comparativa de todos los cupones con sus KPIs (vista de lista avanzada).
   */
  async listaComparativa() {
    const cupones = await prisma.cupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        comercios: { include: { comercio: { select: { nombre: true } } } },
        _count: { select: { usos: true, asignaciones: true } },
      },
    });

    // Datos económicos en una sola query
    const economicos = await prisma.$queryRaw`
      SELECT
        p."cuponId",
        COUNT(*)::int                                                             AS pedidos_totales,
        SUM(CASE WHEN p.estado IN ('CONFIRMADO','ENTREGADO') THEN 1 ELSE 0 END)::int AS pedidos_conf,
        SUM(CASE WHEN p.estado = 'CANCELADO' THEN 1 ELSE 0 END)::int            AS pedidos_cancel,
        COALESCE(SUM(CASE WHEN p.estado IN ('CONFIRMADO','ENTREGADO') THEN p."cuponDescuento" ELSE 0 END), 0)::float AS descuento_realizado,
        COALESCE(SUM(CASE WHEN p.estado IN ('CONFIRMADO','ENTREGADO') THEN p.subtotal ELSE 0 END), 0)::float AS gmv
      FROM "Pedido" p
      WHERE p."cuponId" IS NOT NULL
      GROUP BY p."cuponId"
    `;

    const ecoMap = {};
    for (const r of economicos) ecoMap[r.cuponId] = r;

    const ahora = new Date();
    return cupones.map(c => {
      const eco = ecoMap[c.id] ?? { pedidos_totales: 0, pedidos_conf: 0, pedidos_cancel: 0, descuento_realizado: 0, gmv: 0 };
      return {
        id: c.id,
        codigo: c.codigo,
        tipo: c.tipo,
        valor: Number(c.valor),
        distribucion: c.distribucion,
        activo: c.activo,
        inicio: c.inicio,
        fin: c.fin,
        soloNuevos: c.soloNuevos,
        usosMaximos: c.usosMaximos,
        usosActuales: c.usosActuales,
        redenciones: c._count.usos,
        usuariosAsignados: c._count.asignaciones,
        comerciosRestringidos: c.comercios.length,
        pedidosTotales: eco.pedidos_totales,
        pedidosConfirmados: eco.pedidos_conf,
        tasaConfirmacion: eco.pedidos_totales > 0 ? +(eco.pedidos_conf / eco.pedidos_totales).toFixed(3) : 0,
        tasaCancelacion: eco.pedidos_totales > 0 ? +(eco.pedidos_cancel / eco.pedidos_totales).toFixed(3) : 0,
        descuentoRealizado: Math.round(eco.descuento_realizado),
        gmvAtribuido: Math.round(eco.gmv),
        costoDescuentoSobreVentas: eco.gmv > 0 ? +(eco.descuento_realizado / eco.gmv).toFixed(4) : 0,
        estadoCalculado:
          !c.activo ? "INACTIVO"
          : ahora < c.inicio ? "PROGRAMADO"
          : ahora > c.fin ? "EXPIRADO"
          : c.usosMaximos !== null && c.usosActuales >= c.usosMaximos ? "AGOTADO"
          : "VIGENTE",
      };
    });
  },

  /**
   * Alertas de abuso e integridad de datos.
   * Si cuponId es null, retorna alertas globales de todos los cupones.
   */
  async alertas(cuponId = null) {
    const alertas = [];
    const whereCupon = cuponId ? `WHERE cu."cuponId" = ${cuponId}` : "";
    const wherePedido = cuponId ? `WHERE p."cuponId" = ${cuponId}` : `WHERE p."cuponId" IS NOT NULL`;

    // A. Multi-cuenta: mismo teléfono, varias cuentas usando el mismo cupón
    const multiCuenta = await prisma.$queryRaw`
      SELECT cu."cuponId", c.codigo AS cupon_codigo, u.telefono,
             COUNT(DISTINCT cu."usuarioId")::int AS cuentas,
             ARRAY_AGG(DISTINCT u.nombre)        AS nombres
      FROM "CuponUso" cu
      JOIN "Usuario" u ON u.id = cu."usuarioId"
      JOIN "Cupon"   c ON c.id = cu."cuponId"
      WHERE u.telefono IS NOT NULL
        AND (${cuponId ?? null}::int IS NULL OR cu."cuponId" = ${cuponId ?? null}::int)
      GROUP BY cu."cuponId", c.codigo, u.telefono
      HAVING COUNT(DISTINCT cu."usuarioId") > 1
    `;
    for (const r of multiCuenta) {
      alertas.push({
        tipo: "MULTI_CUENTA",
        severidad: "ALTA",
        cuponId: r.cuponId,
        cuponCodigo: r.cupon_codigo,
        descripcion: `Teléfono ${r.telefono} tiene ${r.cuentas} cuentas distintas usando el mismo cupón.`,
        evidencia: r,
      });
    }

    // B. Repetidores: usuario que excede el tope máximo por usuario
    const repetidores = await prisma.$queryRaw`
      SELECT cu."cuponId", c.codigo AS cupon_codigo,
             cu."usuarioId", u.nombre, u.email, u.telefono,
             COUNT(cu.id)::int AS veces,
             c."usosMaximosPorUsuario" AS tope
      FROM "CuponUso" cu
      JOIN "Usuario" u ON u.id = cu."usuarioId"
      JOIN "Cupon"   c ON c.id = cu."cuponId"
      WHERE c."usosMaximosPorUsuario" IS NOT NULL
        AND (${cuponId ?? null}::int IS NULL OR cu."cuponId" = ${cuponId ?? null}::int)
      GROUP BY cu."cuponId", c.codigo, cu."usuarioId", u.nombre, u.email, u.telefono, c."usosMaximosPorUsuario"
      HAVING COUNT(cu.id) > c."usosMaximosPorUsuario"
    `;
    for (const r of repetidores) {
      alertas.push({
        tipo: "EXCESO_TOPE_USUARIO",
        severidad: "CRITICA",
        cuponId: r.cuponId,
        cuponCodigo: r.cupon_codigo,
        descripcion: `${r.nombre} usó el cupón ${r.veces} veces (tope: ${r.tope}). Posible bug de concurrencia.`,
        evidencia: r,
      });
    }

    // C. Pedidos huérfanos: Pedido con cuponId pero sin fila CuponUso (registro asíncrono fallido)
    const huerfanos = await prisma.$queryRaw`
      SELECT p.id AS pedido_id, p.codigo AS pedido_codigo, p.estado,
             p."cuponId", c.codigo AS cupon_codigo, p."cuponDescuento"::float
      FROM "Pedido" p
      LEFT JOIN "CuponUso" cu ON cu."pedidoId" = p.id
      JOIN "Cupon" c ON c.id = p."cuponId"
      WHERE p."cuponId" IS NOT NULL AND cu.id IS NULL
        AND (${cuponId ?? null}::int IS NULL OR p."cuponId" = ${cuponId ?? null}::int)
      LIMIT 50
    `;
    for (const r of huerfanos) {
      alertas.push({
        tipo: "PEDIDO_HUERFANO",
        severidad: "MEDIA",
        cuponId: r.cuponId,
        cuponCodigo: r.cupon_codigo,
        descripcion: `Pedido ${r.pedido_codigo} tiene cupón aplicado pero no hay registro de uso en CuponUso.`,
        evidencia: r,
      });
    }

    // D. Drift contador vs. log
    const drift = await prisma.$queryRaw`
      SELECT c.id AS cupon_id, c.codigo, c."usosActuales", COUNT(cu.id)::int AS usos_reales,
             (c."usosActuales" - COUNT(cu.id)::int)::int AS diferencia
      FROM "Cupon" c
      LEFT JOIN "CuponUso" cu ON cu."cuponId" = c.id
      WHERE (${cuponId ?? null}::int IS NULL OR c.id = ${cuponId ?? null}::int)
      GROUP BY c.id, c.codigo, c."usosActuales"
      HAVING c."usosActuales" <> COUNT(cu.id)::int
    `;
    for (const r of drift) {
      alertas.push({
        tipo: "DRIFT_CONTADOR",
        severidad: "MEDIA",
        cuponId: r.cupon_id,
        cuponCodigo: r.codigo,
        descripcion: `El contador de usos dice ${r.usosActuales} pero el log registra ${r.usos_reales} (diferencia: ${r.diferencia}).`,
        evidencia: r,
      });
    }

    // E. Comerciante comprándose a sí mismo (compradorId == dueño del comercio)
    const autoCompra = await prisma.$queryRaw`
      SELECT p.id AS pedido_id, p.codigo AS pedido_codigo,
             p."cuponId", c.codigo AS cupon_codigo,
             u.nombre AS comprador, u.id AS comprador_id,
             com.nombre AS comercio, com.id AS comercio_id,
             p."cuponDescuento"::float
      FROM "Pedido" p
      JOIN "SubPedido" sp ON sp."pedidoId" = p.id
      JOIN "Comercio" com ON com.id = sp."comercioId"
      JOIN "Usuario" u ON u.id = p."compradorId"
      JOIN "Cupon" c ON c.id = p."cuponId"
      WHERE com."usuarioId" = p."compradorId"
        AND p."cuponId" IS NOT NULL
        AND (${cuponId ?? null}::int IS NULL OR p."cuponId" = ${cuponId ?? null}::int)
      LIMIT 20
    `;
    for (const r of autoCompra) {
      alertas.push({
        tipo: "AUTO_COMPRA",
        severidad: "ALTA",
        cuponId: r.cuponId,
        cuponCodigo: r.cupon_codigo,
        descripcion: `El comerciante de "${r.comercio}" se compró a sí mismo usando el cupón ${r.cupon_codigo}.`,
        evidencia: r,
      });
    }

    // F. Cupos a punto de agotarse (>90%) o expiran en <48h
    const cuponesRiesgo = await prisma.cupon.findMany({
      where: {
        activo: true,
        ...(cuponId ? { id: cuponId } : {}),
        OR: [
          { usosMaximos: { not: null } },
          { fin: { lte: new Date(Date.now() + 48 * 3600 * 1000) } },
        ],
      },
      select: { id: true, codigo: true, usosMaximos: true, usosActuales: true, fin: true },
    });
    for (const c of cuponesRiesgo) {
      if (c.usosMaximos && c.usosActuales / c.usosMaximos > 0.9) {
        alertas.push({
          tipo: "CUPO_POR_AGOTARSE",
          severidad: "INFO",
          cuponId: c.id,
          cuponCodigo: c.codigo,
          descripcion: `${c.codigo} tiene ${c.usosActuales}/${c.usosMaximos} usos (${Math.round(c.usosActuales/c.usosMaximos*100)}% del cupo).`,
          evidencia: c,
        });
      }
      if (new Date(c.fin) <= new Date(Date.now() + 48 * 3600 * 1000) && new Date(c.fin) > new Date()) {
        alertas.push({
          tipo: "EXPIRA_PRONTO",
          severidad: "INFO",
          cuponId: c.id,
          cuponCodigo: c.codigo,
          descripcion: `${c.codigo} expira el ${new Date(c.fin).toLocaleDateString("es-CO")}.`,
          evidencia: c,
        });
      }
    }

    return alertas.sort((a, b) => {
      const orden = { CRITICA: 0, ALTA: 1, MEDIA: 2, INFO: 3 };
      return (orden[a.severidad] ?? 4) - (orden[b.severidad] ?? 4);
    });
  },

  /**
   * Auditoría de integridad global: huérfanos y drift para todos los cupones.
   */
  async integridadDatos() {
    const [huerfanos, drift] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM "Pedido" p
        LEFT JOIN "CuponUso" cu ON cu."pedidoId" = p.id
        WHERE p."cuponId" IS NOT NULL AND cu.id IS NULL
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS cupones_con_drift
        FROM "Cupon" c
        LEFT JOIN "CuponUso" cu ON cu."cuponId" = c.id
        GROUP BY c.id, c."usosActuales"
        HAVING c."usosActuales" <> COUNT(cu.id)::int
      `,
    ]);
    return {
      pedidosHuerfanos: Number(huerfanos[0]?.total ?? 0),
      cuponesConDrift:  Number(drift.length ?? 0),
      ok: Number(huerfanos[0]?.total ?? 0) === 0 && Number(drift.length ?? 0) === 0,
    };
  },
};

module.exports = CuponRepository;
