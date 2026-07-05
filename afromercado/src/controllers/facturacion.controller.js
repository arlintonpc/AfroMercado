const FacturacionService = require("../services/facturacion.service");
const { ErrorProhibido } = require("../utils/errores");

const MODULOS_VALIDOS = ["PEDIDO", "EXPRESS", "HOTEL", "TOUR", "TRANSPORTE", "CULTURA"];

function validarModulo(m) {
  if (!MODULOS_VALIDOS.includes(m)) throw new ErrorProhibido("Módulo inválido");
}

const FacturacionController = {
  // GET /facturas/:moduloOrigen/:referenciaId — el propio comprador o comercio consulta su factura
  async consultar(req, res, next) {
    try {
      const { moduloOrigen, referenciaId } = req.params;
      validarModulo(moduloOrigen);
      const factura = await FacturacionService.consultar(moduloOrigen, Number(referenciaId));
      const esComprador = factura.compradorId === req.usuario.id;
      const esAdmin = req.usuario.rol === "ADMIN";
      if (!esComprador && !esAdmin) throw new ErrorProhibido("No puedes ver esta factura");
      res.json({ ok: true, data: factura });
    } catch (e) { next(e); }
  },

  async listarAdmin(req, res, next) {
    try {
      const data = await FacturacionService.listarAdmin(req.query);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async reintentarAdmin(req, res, next) {
    try {
      const { moduloOrigen, referenciaId } = req.body;
      validarModulo(moduloOrigen);
      const data = await FacturacionService.emitirParaReferencia(moduloOrigen, Number(referenciaId));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async anularAdmin(req, res, next) {
    try {
      const data = await FacturacionService.anular(req.usuario.id, Number(req.params.id), req.body.motivo);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = FacturacionController;
