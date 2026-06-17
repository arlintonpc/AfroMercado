// Controlador — Productos
// Recibe la petición HTTP, llama al servicio, devuelve la respuesta.
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const ProductoService = require("../services/producto.service");
const prisma = require("../config/prisma");
const VisibilidadRepository = require("../repositories/visibilidad.repository");
const { ErrorValidacion } = require("../utils/errores");

// Carpeta pública donde se guardan las fotos de productos.
const DIR_PRODUCTOS = path.join(__dirname, "..", "..", "uploads", "productos");
fs.mkdirSync(DIR_PRODUCTOS, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(DIR_PRODUCTOS, { recursive: true });
    cb(null, DIR_PRODUCTOS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `prod-${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new ErrorValidacion("Solo se permiten imágenes"));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const ProductoController = {
  async crear(req, res, next) {
    try {
      const producto = await ProductoService.crear(req.usuario.id, req.body);
      res.status(201).json({ ok: true, producto });
    } catch (err) {
      next(err);
    }
  },

  async listar(req, res, next) {
    try {
      const { q, categoriaId, municipio, comercioId, precioMin, precioMax, alcance, enOferta, pagina, porPagina } =
        req.query;
      const resultado = await ProductoService.listar({
        q: q || undefined,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        municipio: municipio || undefined,
        comercioId: comercioId ? Number(comercioId) : undefined,
        precioMin: precioMin !== undefined ? Number(precioMin) : undefined,
        precioMax: precioMax !== undefined ? Number(precioMax) : undefined,
        alcance: alcance || undefined,
        enOferta: enOferta === "true" || enOferta === "1",
        pagina: pagina ? parseInt(pagina) : 1,
        porPagina: porPagina ? parseInt(porPagina) : 12,
      });
      res.json({ ok: true, ...resultado });
    } catch (err) {
      next(err);
    }
  },

  async obtener(req, res, next) {
    try {
      const producto = await ProductoService.obtenerPorId(Number(req.params.id));
      res.json({ ok: true, producto });
    } catch (err) {
      next(err);
    }
  },

  async misProductos(req, res, next) {
    try {
      const productos = await ProductoService.misProductos(req.usuario.id);
      res.json({ ok: true, productos });
    } catch (err) {
      next(err);
    }
  },

  async actualizar(req, res, next) {
    try {
      const producto = await ProductoService.actualizar(req.usuario.id, req.params.id, req.body);
      res.json({ ok: true, producto });
    } catch (err) {
      next(err);
    }
  },

  async desactivar(req, res, next) {
    try {
      await ProductoService.desactivar(req.usuario.id, req.params.id);
      res.json({ ok: true, mensaje: "Producto desactivado correctamente" });
    } catch (err) {
      next(err);
    }
  },

  // POST /productos/:id/vista — público, fire-and-forget con deduplicación (4h)
  async registrarVista(req, res, next) {
    try {
      const productoId = Number(req.params.id);
      const { sesionId } = req.body || {};
      // Opcional: si el request lleva JWT válido, extraemos usuarioId
      const usuarioId = req.usuario?.id ?? null;

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
        select: { comercioId: true },
      });
      if (!producto) return res.json({ ok: true });

      const hace4h = new Date(Date.now() - 4 * 3600_000);
      if (sesionId || usuarioId) {
        const clave = usuarioId
          ? { productoId, usuarioId, createdAt: { gte: hace4h } }
          : { productoId, sesionId, createdAt: { gte: hace4h } };
        const yaVisto = await prisma.vistaProducto.findFirst({ where: clave, select: { id: true } });
        if (yaVisto) return res.json({ ok: true });
      }

      await prisma.vistaProducto.create({
        data: {
          productoId,
          comercioId: producto.comercioId,
          sesionId: sesionId || null,
          usuarioId,
        },
      });

      VisibilidadRepository.registrarVistaProducto(req.params.id).catch(() => {});
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  // GET /productos/recomendaciones — personalizadas por historial del usuario (o más vendidos)
  async recomendaciones(req, res, next) {
    try {
      const usuarioId = req.usuario?.id ?? null;
      const limite = Math.min(Number(req.query.limite) || 8, 20);
      let productos = [];

      if (usuarioId) {
        // Categorías más vistas por el usuario (últimas 30 vistas)
        const vistas = await prisma.vistaProducto.findMany({
          where: { usuarioId },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { productoId: true },
        });
        // Búsquedas recientes
        const busquedas = await prisma.busquedaHistorial.findMany({
          where: { usuarioId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { query: true },
        });

        const productoIdsVistos = [...new Set(vistas.map((v) => v.productoId))];
        const excluir = productoIdsVistos.slice(0, 20);

        // Traer los productos vistos para obtener sus categorías
        const productosVistos = productoIdsVistos.length
          ? await prisma.producto.findMany({
              where: { id: { in: productoIdsVistos }, activo: true },
              select: { categoriaId: true },
            })
          : [];
        const categoriaIds = [...new Set(productosVistos.map((p) => p.categoriaId).filter(Boolean))];

        // Armar filtro: categorías relacionadas + términos de búsqueda
        const queryBusqueda = busquedas.map((b) => b.query).join(" ");

        if (categoriaIds.length > 0 || queryBusqueda) {
          productos = await prisma.producto.findMany({
            where: {
              activo: true,
              id: { notIn: excluir },
              ...(categoriaIds.length > 0 ? { categoriaId: { in: categoriaIds } } : {}),
            },
            orderBy: [{ updatedAt: "desc" }],
            take: limite,
            include: {
              comercio: { select: { id: true, nombre: true, municipio: true } },
              ofertas: {
                where: { activa: true, fin: { gte: new Date() } },
                take: 1,
              },
            },
          });
        }
      }

      // Fallback: más populares por vistas de los últimos 30 días
      if (productos.length < limite) {
        const hace30d = new Date(Date.now() - 30 * 24 * 3600_000);
        const populares = await prisma.vistaProducto.groupBy({
          by: ["productoId"],
          where: { createdAt: { gte: hace30d } },
          _count: { productoId: true },
          orderBy: { _count: { productoId: "desc" } },
          take: limite * 2,
        });
        const idsPopulares = populares
          .map((p) => p.productoId)
          .filter((id) => !productos.some((p) => p.id === id));

        if (idsPopulares.length > 0) {
          const relleno = await prisma.producto.findMany({
            where: { id: { in: idsPopulares }, activo: true },
            take: limite - productos.length,
            include: {
              comercio: { select: { id: true, nombre: true, municipio: true } },
              ofertas: {
                where: { activa: true, fin: { gte: new Date() } },
                take: 1,
              },
            },
          });
          productos = [...productos, ...relleno];
        }
      }

      res.json({ ok: true, data: productos });
    } catch (err) {
      next(err);
    }
  },

  // POST /productos/busqueda — guarda query en historial
  async registrarBusqueda(req, res, next) {
    try {
      const { query, sesionId } = req.body || {};
      if (!query?.trim()) return res.json({ ok: true });
      const usuarioId = req.usuario?.id ?? null;

      // Guardar sin await (fire-and-forget)
      prisma.busquedaHistorial.create({
        data: {
          query: query.trim().toLowerCase().slice(0, 120),
          usuarioId,
          sesionId: sesionId || null,
        },
      }).catch(() => {});

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  // GET /productos/busquedas-recientes — últimas N búsquedas del usuario
  async busquedasRecientes(req, res, next) {
    try {
      const usuarioId = req.usuario?.id ?? null;
      if (!usuarioId) return res.json({ ok: true, data: [] });

      const recientes = await prisma.busquedaHistorial.findMany({
        where: { usuarioId },
        orderBy: { createdAt: "desc" },
        take: 8,
        distinct: ["query"],
        select: { query: true, createdAt: true },
      });
      res.json({ ok: true, data: recientes });
    } catch (err) {
      next(err);
    }
  },

  // ── Imágenes ───────────────────────────────────────────────
  // Middleware multer para varias fotos (campo "imagenes", hasta 6).
  uploadImagenes: upload.array("imagenes", 6),

  // POST /productos/:id/imagenes  (multipart)
  async subirImagenes(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        throw new ErrorValidacion("Adjunta al menos una imagen (campo 'imagenes')");
      }
      const base = `${req.protocol}://${req.get("host")}`;
      const urls = req.files.map((f) => `${base}/uploads/productos/${f.filename}`);
      const producto = await ProductoService.agregarImagenes(req.usuario.id, req.params.id, urls);
      res.status(201).json({ ok: true, producto });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /productos/:id/imagenes  (body: { url })
  async quitarImagen(req, res, next) {
    try {
      const producto = await ProductoService.quitarImagen(req.usuario.id, req.params.id, req.body.url);
      res.json({ ok: true, producto });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /productos/:id/foto-principal  (body: { url })
  async fotoPrincipal(req, res, next) {
    try {
      const producto = await ProductoService.establecerPrincipal(req.usuario.id, req.params.id, req.body.url);
      res.json({ ok: true, producto });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ProductoController;
