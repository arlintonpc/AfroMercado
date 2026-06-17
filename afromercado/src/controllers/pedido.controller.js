// ============================================================
//  Controlador de Pedidos
// ============================================================
const PedidoService = require("../services/pedido.service");

const PedidoController = {
  // POST /pedidos/checkout
  async checkout(req, res, next) {
    try {
      // El frontend envía { direccion, telefono, notas }; aceptamos también
      // direccionTexto por compatibilidad. El teléfono se conserva en las notas.
      const { direccionTexto, direccion, telefono, direccionId, notas, codigoCupon } =
        req.body || {};
      const textoDireccion = (direccionTexto || direccion || "").trim();
      const notasFinales = telefono
        ? `${notas ? notas + " · " : ""}Tel: ${telefono}`
        : notas;
      const resultado = await PedidoService.checkout(req.usuario.id, {
        direccionTexto: textoDireccion,
        direccionId: direccionId ? Number(direccionId) : undefined,
        notas: notasFinales,
        codigoCupon: codigoCupon || undefined,
      });
      res.status(201).json({ ok: true, data: resultado });
    } catch (e) {
      next(e);
    }
  },

  // GET /pedidos
  async listar(req, res, next) {
    try {
      const pedidos = await PedidoService.listar(req.usuario.id);
      res.json({ ok: true, data: pedidos });
    } catch (e) {
      next(e);
    }
  },

  // GET /pedidos/:id
  async detalle(req, res, next) {
    try {
      const pedido = await PedidoService.detalle(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data: pedido });
    } catch (e) {
      next(e);
    }
  },

  // POST /pedidos/:id/cancelar
  async cancelar(req, res, next) {
    try {
      const resultado = await PedidoService.cancelar(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, ...resultado });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = PedidoController;
