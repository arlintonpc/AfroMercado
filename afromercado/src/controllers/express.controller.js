const path            = require("path");
const ExpressService  = require("../services/express.service");
const prisma          = require("../config/prisma");
const { subirVideoACloudinary, construirUrlVideoOptimizada, construirPosterVideo } = require("../utils/cloudinary");
const {
  crearUploadVideo,
  extraerVideoMeta,
  normalizarRecorteVideo,
  urlLocalVideo,
  eliminarArchivoLocalDesdeUrl,
} = require("../utils/video-media");

const _uploadVideoExpress = crearUploadVideo({
  dir: path.join(__dirname, "../../uploads/videos/express"),
  prefijo: "express-video",
  fieldName: "video",
});

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

  async menuComercio(req, res, next) {
    try {
      const comercioId = Number(req.params.comercioId);
      const data = await ExpressService.obtenerMenuComercio(comercioId);
      if (!data) return res.status(404).json({ ok: false, mensaje: "Comercio Express no disponible" });
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async crearPedido(req, res, next) {
    try {
      const clienteId = req.usuario.id;
      const { comercioId, modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega, codigoCupon } = req.body;
      if (!comercioId || !modalidad || !metodoPago || !items?.length) {
        return res.status(400).json({ ok: false, error: "Faltan campos requeridos" });
      }
      const pedido = await ExpressService.crearPedido({
        clienteId, comercioId: Number(comercioId), modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega, codigoCupon,
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

  // ── SECCIONES DE MENÚ ────────────────────────────────────────

  async listarSecciones(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.listarSecciones(comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async crearSeccion(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.crearSeccion(comercioId, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async actualizarSeccion(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.actualizarSeccion(comercioId, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async eliminarSeccion(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      await ExpressService.eliminarSeccion(comercioId, Number(req.params.id));
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async asignarSeccionProducto(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const { menuSeccionId } = req.body;
      const data = await ExpressService.asignarSeccionProducto(
        comercioId, Number(req.params.productoId),
        menuSeccionId === null ? null : Number(menuSeccionId)
      );
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // ── CUPONES EXPRESS ──────────────────────────────────────────

  async validarCupon(req, res, next) {
    try {
      const { codigo, subtotal } = req.body;
      if (!codigo || !subtotal) return res.status(400).json({ ok: false, error: "codigo y subtotal requeridos" });
      let configExpressId = null;
      const { comercioId } = req.query;
      if (comercioId) {
        const cfg = await prisma.configExpress.findUnique({ where: { comercioId: Number(comercioId) } });
        configExpressId = cfg?.id ?? null;
      }
      const data = await ExpressService.validarCuponExpress(codigo, configExpressId, Number(subtotal), req.usuario?.id ?? null);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async listarCupones(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.listarCuponesExpress(comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async crearCupon(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.crearCuponExpress(comercioId, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async eliminarCupon(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      await ExpressService.eliminarCuponExpress(comercioId, Number(req.params.id));
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  // ── ESTADÍSTICAS ──────────────────────────────────────────────

  async estadisticas(req, res, next) {
    try {
      const comercioId = await getComercioId(req.usuario.id);
      const data = await ExpressService.estadisticasExpress(comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
};

// ── VIDEO EXPRESS ─────────────────────────────────────────────

async function uploadVideoExpress(req, res, next) {
  _uploadVideoExpress(req, res, err => { if (err) return next(err); next(); });
}

async function subirVideoExpress(req, res, next) {
  try {
    const comercioId = await getComercioId(req.usuario.id);
    if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió archivo de video" });
    const meta = extraerVideoMeta(req.body);
    const recorte = normalizarRecorteVideo(meta);
    const { secureUrl } = await subirVideoACloudinary(req.file.path, "afromercado/videos/express");
    const videoUrl = construirUrlVideoOptimizada(secureUrl, recorte);
    const posterFinal = construirPosterVideo(secureUrl, recorte);
    const result = await ExpressService.subirVideoExpress(comercioId, videoUrl, posterFinal, recorte.duracionFinal);
    eliminarArchivoLocalDesdeUrl(urlLocalVideo(req, req.file.path)).catch(() => {});
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

async function quitarVideoExpress(req, res, next) {
  try {
    const comercioId = await getComercioId(req.usuario.id);
    const result = await ExpressService.quitarVideoExpress(comercioId);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

ExpressController.uploadVideoExpress = uploadVideoExpress;
ExpressController.subirVideoExpress  = subirVideoExpress;
ExpressController.quitarVideoExpress = quitarVideoExpress;

module.exports = ExpressController;
