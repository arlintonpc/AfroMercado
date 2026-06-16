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

  // POST /productos/:id/vista — público, fire-and-forget con deduplicación por sesionId (4h)
  async registrarVista(req, res, next) {
    try {
      const productoId = Number(req.params.id);
      const { sesionId } = req.body || {};

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
        select: { comercioId: true },
      });
      if (!producto) return res.json({ ok: true });

      if (sesionId) {
        const hace4h = new Date(Date.now() - 4 * 3600_000);
        const yaVisto = await prisma.vistaProducto.findFirst({
          where: { productoId, sesionId, createdAt: { gte: hace4h } },
          select: { id: true },
        });
        if (yaVisto) return res.json({ ok: true });
      }

      await prisma.vistaProducto.create({
        data: { productoId, comercioId: producto.comercioId, sesionId: sesionId || null },
      });

      // También actualiza el contador del slot de visibilidad pagada si existe (fire-and-forget).
      VisibilidadRepository.registrarVistaProducto(req.params.id).catch(() => {});

      res.json({ ok: true });
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
