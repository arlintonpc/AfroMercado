// Capa de acceso a datos — Productos
const prisma = require("../config/prisma");

const ProductoRepository = {
  async crear(data) {
    return prisma.producto.create({ data });
  },

  async buscarPorId(id) {
    return prisma.producto.findUnique({
      where: { id: Number(id) },
      include: {
        comercio: {
          select: {
            id: true,
            nombre: true,
            municipio: true,
            descripcion: true,
            historia: true,
            whatsapp: true,
            calificacion: true,
            verificado: true,
            totalVentas: true,
            totalReviews: true,
          },
        },
        categoria: true,
      },
    });
  },

  async listar({
    q,
    categoriaId,
    municipio,
    comercioId,
    precioMin,
    precioMax,
    alcance,
    pagina = 1,
    porPagina = 12,
  } = {}) {
    const where = {
      activo: true,
      deletedAt: null,
      // Solo productos con stock disponible (stock > stockReservado)
      stock: { gt: 0 },
    };

    // Búsqueda insensible a mayúsculas Y a acentos (clave en español:
    // "borojo" debe encontrar "Borojó", "platano" → "Plátano", etc.).
    // Usa la extensión unaccent de Postgres vía raw query para obtener los
    // ids que coinciden, y luego los combina con el resto de filtros Prisma.
    if (q && q.trim()) {
      const patron = `%${q.trim()}%`;
      const filas = await prisma.$queryRaw`
        SELECT p.id
        FROM "Producto" p
        JOIN "Comercio" c ON c.id = p."comercioId"
        WHERE unaccent(p.nombre) ILIKE unaccent(${patron})
           OR unaccent(coalesce(p.descripcion, '')) ILIKE unaccent(${patron})
           OR unaccent(c.nombre) ILIKE unaccent(${patron})
      `;
      const ids = filas.map((f) => Number(f.id));
      // Si no hubo coincidencias, forzamos un id imposible para no traer todo.
      where.id = { in: ids.length ? ids : [-1] };
    }

    // Filtro por categoría
    if (categoriaId) {
      where.categoriaId = Number(categoriaId);
    }

    // Filtro por municipio del comercio
    if (municipio) {
      where.comercio = {
        ...where.comercio,
        municipio: { contains: municipio, mode: "insensitive" },
        activo: true,
      };
    }

    // Filtro por comercio específico (página pública del vendedor)
    if (comercioId) {
      where.comercioId = Number(comercioId);
    }

    // Rango de precio
    if (precioMin !== undefined || precioMax !== undefined) {
      where.precio = {};
      if (precioMin !== undefined) where.precio.gte = Number(precioMin);
      if (precioMax !== undefined) where.precio.lte = Number(precioMax);
    }

    // Alcance: si el comprador pide NACIONAL, mostrar NACIONAL y AMBOS
    if (alcance) {
      if (alcance === "NACIONAL") {
        where.alcance = { in: ["NACIONAL", "AMBOS"] };
      } else {
        where.alcance = alcance;
      }
    }

    const skip = (pagina - 1) * porPagina;

    const [total, items] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        include: {
          comercio: {
            select: {
              id: true,
              nombre: true,
              municipio: true,
              calificacion: true,
              verificado: true,
              totalVentas: true,
            },
          },
          categoria: true,
        },
        orderBy: [
          { comercio: { calificacion: "desc" } },
          { createdAt: "desc" },
        ],
        skip,
        take: porPagina,
      }),
    ]);

    const paginas = Math.ceil(total / porPagina);
    return { items, total, paginas, pagina };
  },

  async listarPorComercio(comercioId) {
    return prisma.producto.findMany({
      where: { comercioId },
      orderBy: { createdAt: "desc" },
    });
  },

  async actualizar(id, data) {
    return prisma.producto.update({ where: { id: Number(id) }, data });
  },

  async desactivar(id) {
    return prisma.producto.update({ where: { id: Number(id) }, data: { activo: false } });
  },
};

module.exports = ProductoRepository;
