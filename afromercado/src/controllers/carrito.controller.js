// ============================================================
//  Controlador de Carrito
// ============================================================
const CarritoService = require("../services/carrito.service");

const CarritoController = {
  // GET /carrito  → carrito completo
  async obtener(req, res, next) {
    try {
      const carrito = await CarritoService.obtener(req.usuario.id);
      res.json({ ok: true, data: carrito });
    } catch (e) {
      next(e);
    }
  },

  // POST /carrito/items  → carrito completo actualizado
  async agregar(req, res, next) {
    try {
      const { productoId, cantidad } = req.body;
      const carrito = await CarritoService.agregar(req.usuario.id, productoId, parseInt(cantidad));
      res.status(201).json({ ok: true, data: carrito });
    } catch (e) {
      next(e);
    }
  },

  // PUT /carrito/items/:productoId  → carrito completo actualizado
  async actualizarCantidad(req, res, next) {
    try {
      const { productoId } = req.params;
      const { cantidad } = req.body;
      const carrito = await CarritoService.actualizarCantidad(req.usuario.id, productoId, parseInt(cantidad));
      res.json({ ok: true, data: carrito });
    } catch (e) {
      next(e);
    }
  },

  // DELETE /carrito/items/:productoId  → carrito completo actualizado
  async eliminarItem(req, res, next) {
    try {
      const { productoId } = req.params;
      const carrito = await CarritoService.eliminar(req.usuario.id, productoId);
      res.json({ ok: true, data: carrito });
    } catch (e) {
      next(e);
    }
  },

  // DELETE /carrito  → carrito vacío
  async vaciar(req, res, next) {
    try {
      const carrito = await CarritoService.vaciar(req.usuario.id);
      res.json({ ok: true, data: carrito });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = CarritoController;
