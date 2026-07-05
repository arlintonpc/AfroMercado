// ============================================================
//  Servicio de Búsqueda (Fase 5.1) — texto libre + filtros + geolocalizada.
//  Mantiene el mecanismo de texto actual (contains/insensitive) — no migra a
//  full-text real (tsvector/pg_trgm), eso es un cambio aparte y más grande,
//  no pedido explícitamente.
// ============================================================
const prisma = require("../config/prisma");

const LIMITE_MAXIMO = 24;
const LIMITE_SUGERENCIAS = 8;

function contains(texto) {
  return { contains: texto, mode: "insensitive" };
}

function radioKm(lat, lng, radio) {
  // Bounding box rápido (evita escanear toda la tabla) + Haversine exacto
  // sobre ese subconjunto — mismo espíritu que otros $queryRaw del proyecto.
  return { lat: Number(lat), lng: Number(lng), radio: Number(radio) };
}

async function comerciosDentroDelRadio(lat, lng, radio) {
  if (lat == null || lng == null || !radio) return null;
  const { lat: la, lng: lo, radio: r } = radioKm(lat, lng, radio);
  // Subconsulta para poder filtrar por la distancia calculada (un alias no se
  // puede usar en WHERE dentro del mismo nivel, y HAVING exige GROUP BY).
  const filas = await prisma.$queryRaw`
    SELECT id FROM (
      SELECT id, (
        6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(${la})) * cos(radians(latitud)) * cos(radians(longitud) - radians(${lo}))
            + sin(radians(${la})) * sin(radians(latitud))
          ))
        )
      ) AS distancia_km
      FROM "Comercio"
      WHERE latitud IS NOT NULL AND longitud IS NOT NULL
    ) sub
    WHERE distancia_km <= ${r}
  `;
  return new Set(filas.map((f) => f.id));
}

const BusquedaService = {
  async buscar({ q = "", categoria, precioMin, precioMax, calificacionMin, lat, lng, radioKm: radio, page = 1 } = {}) {
    const texto = String(q || "").trim();
    if (texto.length < 2) {
      return { productos: [], hoteles: [], tours: [], transportes: [], pagina: 1 };
    }

    const pagina = Math.max(1, Number(page) || 1);
    const take = LIMITE_MAXIMO;
    const skip = (pagina - 1) * take;

    const comerciosEnRadio = await comerciosDentroDelRadio(lat, lng, radio);
    const filtroComercioGeo = comerciosEnRadio ? { comercioId: { in: [...comerciosEnRadio] } } : {};
    const filtroComercioGeoAnidado = comerciosEnRadio ? { comercio: { id: { in: [...comerciosEnRadio] } } } : {};

    const calMin = calificacionMin != null ? Number(calificacionMin) : null;
    const filtroCalificacion = calMin ? { comercio: { calificacion: { gte: calMin } } } : {};
    const filtroCalificacionDirecto = calMin ? { calificacion: { gte: calMin } } : {};

    const precioWhere = {};
    if (precioMin != null) precioWhere.gte = Number(precioMin);
    if (precioMax != null) precioWhere.lte = Number(precioMax);

    const [productos, hoteles, tours, transportes] = await Promise.all([
      prisma.producto.findMany({
        where: {
          activo: true,
          nombre: contains(texto),
          ...filtroComercioGeo,
          ...(categoria ? { categoriaId: Number(categoria) } : {}),
          ...(Object.keys(precioWhere).length ? { precio: precioWhere } : {}),
          ...(calMin ? { comercio: { calificacion: { gte: calMin } } } : {}),
        },
        skip,
        take,
        select: {
          id: true, nombre: true, precio: true, fotoUrl: true,
          comercio: { select: { id: true, municipio: true, calificacion: true } },
        },
      }),
      prisma.configHotel.findMany({
        where: {
          activo: true,
          OR: [{ comercio: { nombre: contains(texto) } }, { comercio: { municipio: contains(texto) } }],
          ...filtroComercioGeoAnidado,
          ...filtroCalificacion,
          ...(Object.keys(precioWhere).length ? { habitaciones: { some: { precioPorNoche: precioWhere } } } : {}),
        },
        skip,
        take,
        select: {
          id: true,
          comercio: { select: { id: true, nombre: true, municipio: true, calificacion: true } },
          habitaciones: { take: 1, select: { fotos: true, precioPorNoche: true } },
        },
      }),
      prisma.configTour.findMany({
        where: {
          activo: true,
          nombre: contains(texto),
          ...filtroComercioGeoAnidado,
          ...filtroCalificacion,
          ...(Object.keys(precioWhere).length ? { precioPersona: precioWhere } : {}),
        },
        skip,
        take,
        select: {
          id: true, nombre: true, precioPersona: true, fotos: true,
          comercio: { select: { id: true, municipio: true, calificacion: true } },
        },
      }),
      prisma.configTransporte.findMany({
        where: {
          activo: true,
          nombre: contains(texto),
          ...filtroComercioGeoAnidado,
          ...filtroCalificacion,
        },
        skip,
        take,
        select: {
          id: true, nombre: true, tipo: true, fotos: true,
          comercio: { select: { id: true, municipio: true, calificacion: true } },
        },
      }),
    ]);

    return { productos, hoteles, tours, transportes, pagina };
  },

  /** Autocompletado liviano — solo nombres, sin filtros. Alimenta BusquedaHistorial. */
  async sugerencias({ q = "", usuarioId, sesionId } = {}) {
    const texto = String(q || "").trim();
    if (texto.length < 2) return [];

    if (usuarioId || sesionId) {
      prisma.busquedaHistorial.create({
        data: { usuarioId: usuarioId ?? null, sesionId: sesionId ?? null, query: texto },
      }).catch(() => {});
    }

    const [productos, hoteles, tours, transportes] = await Promise.all([
      prisma.producto.findMany({
        where: { activo: true, nombre: contains(texto) },
        take: LIMITE_SUGERENCIAS,
        select: { id: true, nombre: true },
      }),
      prisma.configHotel.findMany({
        where: { activo: true, comercio: { nombre: contains(texto) } },
        take: LIMITE_SUGERENCIAS,
        select: { id: true, comercio: { select: { nombre: true } } },
      }),
      prisma.configTour.findMany({
        where: { activo: true, nombre: contains(texto) },
        take: LIMITE_SUGERENCIAS,
        select: { id: true, nombre: true },
      }),
      prisma.configTransporte.findMany({
        where: { activo: true, nombre: contains(texto) },
        take: LIMITE_SUGERENCIAS,
        select: { id: true, nombre: true },
      }),
    ]);

    const sugerencias = [
      ...productos.map((p) => ({ tipo: "PRODUCTO", id: p.id, texto: p.nombre })),
      ...hoteles.map((h) => ({ tipo: "HOTEL", id: h.id, texto: h.comercio.nombre })),
      ...tours.map((t) => ({ tipo: "TOUR", id: t.id, texto: t.nombre })),
      ...transportes.map((t) => ({ tipo: "TRANSPORTE", id: t.id, texto: t.nombre })),
    ];
    return sugerencias.slice(0, LIMITE_SUGERENCIAS);
  },
};

module.exports = BusquedaService;
