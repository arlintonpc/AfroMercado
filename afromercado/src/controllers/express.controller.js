const ExpressService  = require("../services/express.service");
const prisma          = require("../config/prisma");

async function getComercioId(usuarioId) {
  const c = await prisma.comercio.findUnique({ where: { usuarioId }, select: { id: true } });
  if (!c) throw Object.assign(new Error("No tienes un comercio registrado"), { statusCode: 403 });
  return c.id;
}

const ExpressController = {

  // ── CLIENTE ──────────────────────────────────────────────────

  async festivosAnio(req, res, next) {
    try {
      const anio = req.query.anio ? Number(req.query.anio) : undefined;
      const data = await ExpressService.festivosAnio(anio);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async comerciosExpress(req, res, next) {
    try {
      const { municipio } = req.query;
      const data = await ExpressService.listarComerciosExpress(municipio);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async crearPedido(req, res, next) {
    try {
      const clienteId = req.usuario.id;
      const { comercioId, modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega } = req.body;
      if (!comercioId || !modalidad || !metodoPago || !items?.length) {
        return res.status(400).json({ ok: false, error: "Faltan campos requeridos" });
      }
      const pedido = await ExpressService.crearPedido({
        clienteId, comercioId: Number(comercioId), modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega,
      });
      res.status(201).json({ ok: true, data: pedido });
    } catch (err) { next(err); }
  },

  async misPedidos(req, res, next) {
    try {
      const data = await ExpressService.listarPedidosCliente(req.usuario.id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async obtenerPedido(req, res, next) {
    try {
      const data = await ExpressService.obtenerPedido(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // ── COMERCIO ─────────────────────────────────────────────────

  async obtenerConfig(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.obtenerConfig(comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async actualizarConfig(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.actualizarConfig(comercioId, req.body);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async toggleAbierto(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const { abierto } = req.body;
      if (typeof abierto !== "boolean") return res.status(400).json({ ok: false, error: "abierto debe ser boolean" });
      const data = await ExpressService.toggleAbierto(comercioId, abierto);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async pedidosComercio(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const { estado } = req.query;
      const data = await ExpressService.listarPedidosComercio(comercioId, estado);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async aceptarPedido(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const { tiempoAjustadoMin } = req.body;
      const data = await ExpressService.aceptarPedido(Number(req.params.id), comercioId, tiempoAjustadoMin);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async rechazarPedido(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const { motivo } = req.body;
      const data = await ExpressService.rechazarPedido(Number(req.params.id), comercioId, motivo);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async avanzarEstado(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.avanzarEstado(Number(req.params.id), comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // ── ADMIN ────────────────────────────────────────────────────

  async deudasAdmin(req, res, next) {
    try {
      const data = await ExpressService.listarDeudasAdmin();
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async saldarDeudaAdmin(req, res, next) {
    try {
      const { monto } = req.body;
      if (!monto || isNaN(Number(monto))) return res.status(400).json({ ok: false, error: "monto requerido" });
      const data = await ExpressService.saldarDeudaAdmin(Number(req.params.comercioId), Number(monto));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async actualizarLimiteAdmin(req, res, next) {
    try {
      const { limite } = req.body;
      if (!limite || isNaN(Number(limite))) return res.status(400).json({ ok: false, error: "limite requerido" });
      const data = await ExpressService.actualizarLimiteCreditoAdmin(Number(req.params.comercioId), Number(limite));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
};

module.exports = ExpressController;
