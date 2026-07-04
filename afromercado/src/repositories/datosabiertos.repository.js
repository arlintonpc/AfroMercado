// Repositorio de Datos Abiertos — AfroMercado
// Separado a propósito de reporte.repository.js: este archivo alimenta un
// endpoint PÚBLICO, así que NUNCA debe exponer comisión (ingreso interno de
// la plataforma) ni datos crudos por comercio. Solo agregados de: comercios
// activos y verificados, pedidos y GMV, siempre del snapshot del último mes
// calendario ya cerrado (nunca el mes en curso ni rangos libres), y siempre
// pasando por aplicarUmbralK5 antes de devolver la respuesta.
const prisma = require("../config/prisma");
const { aplicarUmbralK5 } = require("../utils/anonimizacion");

/** Rango [inicio, fin) del último mes calendario ya cerrado (mes anterior al actual). */
function rangoMesCerrado() {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  return { inicio, fin };
}

const DatosAbiertosRepository = {
  rangoMesCerrado,

  /** Comercios activos+verificados, pedidos y GMV por (departamento, municipio) del mes cerrado. */
  async datosPorMunicipio() {
    const { inicio, fin } = rangoMesCerrado();
    const filas = await prisma.$queryRaw`
      SELECT
        COALESCE(c.departamento, 'Sin departamento') AS departamento,
        c.municipio                                  AS municipio,
        COUNT(DISTINCT c.id)::int                     AS comercios,
        COUNT(DISTINCT sp."pedidoId")::int            AS pedidos,
        COALESCE(SUM(sp.subtotal), 0)::float          AS gmv
      FROM "Comercio" c
      LEFT JOIN "SubPedido" sp ON sp."comercioId" = c.id
      LEFT JOIN "Pedido" p     ON p.id = sp."pedidoId"
                               AND p.estado IN ('CONFIRMADO','ENTREGADO')
                               AND p."createdAt" >= ${inicio} AND p."createdAt" < ${fin}
      WHERE c.activo = true AND c.verificado = true
      GROUP BY c.departamento, c.municipio
      ORDER BY departamento ASC, municipio ASC
    `;
    return aplicarUmbralK5(filas, { nivelSuperior: "departamento" });
  },

  /** Comercios activos+verificados, pedidos y GMV por departamento del mes cerrado. */
  async datosPorDepartamento() {
    const { inicio, fin } = rangoMesCerrado();
    const filas = await prisma.$queryRaw`
      SELECT
        COALESCE(c.departamento, 'Sin departamento') AS departamento,
        COUNT(DISTINCT c.id)::int                     AS comercios,
        COUNT(DISTINCT sp."pedidoId")::int            AS pedidos,
        COALESCE(SUM(sp.subtotal), 0)::float          AS gmv
      FROM "Comercio" c
      LEFT JOIN "SubPedido" sp ON sp."comercioId" = c.id
      LEFT JOIN "Pedido" p     ON p.id = sp."pedidoId"
                               AND p.estado IN ('CONFIRMADO','ENTREGADO')
                               AND p."createdAt" >= ${inicio} AND p."createdAt" < ${fin}
      WHERE c.activo = true AND c.verificado = true
      GROUP BY c.departamento
      ORDER BY departamento ASC
    `;
    // A este nivel no existe un superior geográfico al cual fusionar (no hay
    // "por encima" de departamento salvo el total nacional), así que aquí no
    // aplica aplicarUmbralK5 tal cual (requiere un nivelSuperior distinto del
    // propio campo agrupado). Se replica la misma regla k=5 manualmente:
    // los departamentos con pocos comercios se consolidan en una sola fila.
    const cumplen = [];
    let consolidado = null;
    for (const fila of filas) {
      if (Number(fila.comercios ?? 0) >= 5) {
        cumplen.push(fila);
        continue;
      }
      if (!consolidado) {
        consolidado = { departamento: "Consolidado nacional (departamentos con <5 comercios)", comercios: 0, pedidos: 0, gmv: 0 };
      }
      consolidado.comercios += Number(fila.comercios ?? 0);
      consolidado.pedidos += Number(fila.pedidos ?? 0);
      consolidado.gmv += Number(fila.gmv ?? 0);
    }
    return consolidado ? [...cumplen, consolidado] : cumplen;
  },
};

module.exports = DatosAbiertosRepository;
