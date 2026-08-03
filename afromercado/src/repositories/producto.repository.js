// Capa de acceso a datos — Productos
const prisma = require("../config/prisma");
const { filtroComercioVisible } = require("../utils/comercio-publicacion");

// "unidad" pasó de ser un enum escaneado automático a una relación
// (tabla UnidadDeVenta administrable). Para no romper a los ~19 lugares del
// código que leen `producto.unidad` como string ("KG", "MANOJO"...), se
// aplana aquí mismo antes de devolver el producto: sigue viéndose como el
// mismo string de siempre en toda la API.
function aplanarUnidad(producto) {
  if (!producto) return producto;
  if (producto.unidad && typeof producto.unidad === "object") {
    producto.unidad = producto.unidad.codigo;
  }
  return producto;
}

function aplanarUnidadLista(productos) {
  productos.forEach(aplanarUnidad);
  return productos;
}

function includeProductoPublico(ahora = new Date()) {
  return {
    unidad: true,
    comercio: {
      select: {
        id: true,
        nombre: true,
        municipio: true,
        departamento: true,
        descripcion: true,
        historia: true,
        whatsapp: true,
        whatsappVisible: true,
        videoUrl: true,
        videoPosterUrl: true,
        videoDuracionSegundos: true,
        videoMimeType: true,
        calificacion: true,
        verificado: true,
        verificadoEtnico: true,
        totalVentas: true,
        totalReviews: true,
        // Solo para calcular comprableEnPlataforma en producto.service.js —
        // se elimina del objeto antes de responder al cliente, nunca se expone.
        activo: true,
        estadoRegistro: true,
        rut: true,
        fotoDocumentoUrl: true,
        fotoDocumentoFrenteUrl: true,
        fotoDocumentoReversoUrl: true,
        cuentaDispersion: { select: { estado: true } },
      },
    },
    categoria: true,
    ofertas: {
      where: { activa: true, inicio: { lte: ahora }, fin: { gte: ahora } },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  };
}

const ProductoRepository = {
  async crear(data, tx) {
    const db = tx || prisma;
    const creado = await db.producto.create({ data, include: { unidad: true } });
    return aplanarUnidad(creado);
  },

  async buscarPorId(id) {
    const producto = await prisma.producto.findUnique({
      where: { id: Number(id) },
      include: includeProductoPublico(),
    });
    return aplanarUnidad(producto);
  },

  async buscarPublicoPorId(id) {
    const producto = await prisma.producto.findFirst({
      where: {
        id: Number(id),
        activo: true,
        deletedAt: null,
        comercio: filtroComercioVisible(),
      },
      include: includeProductoPublico(),
    });
    return aplanarUnidad(producto);
  },

  async listar({
    q,
    categoriaId,
    grupo,
    municipio,
    departamento,
    comercioId,
    precioMin,
    precioMax,
    alcance,
    enOferta,
    pagina = 1,
    porPagina = 12,
  } = {}) {
    const where = {
      activo: true,
      deletedAt: null,
      comercio: filtroComercioVisible(),
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

    // Filtro por grupo de categoría (ANCESTRAL | LOCAL) — distingue
    // "Productos ancestrales" de "Tienda Local"
    if (grupo) {
      where.categoria = { ...where.categoria, grupo };
    }

    // Filtro por municipio del comercio
    if (municipio) {
      where.comercio = {
        ...where.comercio,
        municipio: { contains: municipio, mode: "insensitive" },
        activo: true,
      };
    }

    // Filtro por departamento del comercio (región activa del usuario)
    if (departamento) {
      where.comercio = {
        ...where.comercio,
        departamento: { contains: departamento, mode: "insensitive" },
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

    // Filtro: solo productos con oferta activa
    const ahora = new Date();
    if (enOferta) {
      where.ofertas = { some: { activa: true, inicio: { lte: ahora }, fin: { gte: ahora } } };
    }

    const skip = (pagina - 1) * porPagina;

    const [total, items] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        include: {
          unidad: true,
          comercio: {
            select: {
              id: true,
              nombre: true,
              municipio: true,
              calificacion: true,
              verificado: true,
              verificadoEtnico: true,
              totalVentas: true,
              whatsappVisible: true,
              videoUrl: true,
              videoPosterUrl: true,
              videoDuracionSegundos: true,
              videoMimeType: true,
            },
          },
          categoria: true,
          ofertas: {
            where: { activa: true, inicio: { lte: ahora }, fin: { gte: ahora } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
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
    return { items: aplanarUnidadLista(items), total, paginas, pagina };
  },

  async listarPorComercio(comercioId) {
    const productos = await prisma.producto.findMany({
      where: { comercioId },
      orderBy: { createdAt: "desc" },
      include: { unidad: true, categoria: { select: { id: true, nombre: true } } },
    });
    return aplanarUnidadLista(productos);
  },

  async actualizar(id, data, tx) {
    const db = tx || prisma;
    const actualizado = await db.producto.update({ where: { id: Number(id) }, data, include: { unidad: true } });
    return aplanarUnidad(actualizado);
  },

  async desactivar(id) {
    return prisma.producto.update({ where: { id: Number(id) }, data: { activo: false } });
  },

  // Selección mínima para el chequeo de autodenuncia — nunca se expone al cliente.
  async buscarConDueno(id) {
    return prisma.producto.findUnique({
      where: { id: Number(id) },
      select: { id: true, nombre: true, comercio: { select: { id: true, usuarioId: true } } },
    });
  },

  // ── Denuncias ─────────────────────────────────────────────────
  async crearDenuncia(data) {
    return prisma.denunciaProducto.create({ data });
  },

  async buscarDenuncia(productoId, denuncianteId) {
    return prisma.denunciaProducto.findUnique({
      where: { productoId_denuncianteId: { productoId, denuncianteId } },
    });
  },

  async buscarDenunciaPorId(id) {
    return prisma.denunciaProducto.findUnique({
      where: { id },
      include: { producto: { include: { comercio: { select: { id: true, nombre: true, usuarioId: true } } } } },
    });
  },

  async listarDenunciasPendientes() {
    return prisma.denunciaProducto.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        producto: { include: { comercio: { select: { id: true, nombre: true, usuarioId: true } } } },
        denunciante: { select: { id: true, nombre: true, email: true } },
      },
    });
  },

  async actualizarDenuncia(id, data) {
    return prisma.denunciaProducto.update({ where: { id }, data });
  },

  async resolverDenunciasPendientesDelComercio(comercioId, nuevoEstado, adminId, motivo) {
    return prisma.denunciaProducto.updateMany({
      where: { estado: "PENDIENTE", producto: { comercioId } },
      data: { estado: nuevoEstado, revisadoPor: adminId, revisadoAt: new Date(), notaRevision: motivo },
    });
  },
};

module.exports = ProductoRepository;
