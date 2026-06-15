// Controlador — Productos
// Recibe la petición HTTP, llama al servicio, devuelve la respuesta.
const ProductoService = require("../services/producto.service");

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
      const { q, categoriaId, municipio, precioMin, precioMax, alcance, pagina, porPagina } =
        req.query;
      const resultado = await ProductoService.listar({
        q: q || undefined,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        municipio: municipio || undefined,
        precioMin: precioMin !== undefined ? Number(precioMin) : undefined,
        precioMax: precioMax !== undefined ? Number(precioMax) : undefined,
        alcance: alcance || undefined,
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
};

module.exports = ProductoController;
