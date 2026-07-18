const fs = require("fs");
const InmuebleService = require("../services/inmueble.service");
const { subirACloudinary, subirDocumentoACloudinary } = require("../utils/cloudinary");
const { ErrorValidacion } = require("../utils/errores");

const InmuebleController = {
  // ── Públicas ─────────────────────────────────────────────────
  async listarPublicas(req, res, next) {
    try {
      const { departamento, municipio, tipoInmueble, tipoOperacion, precioMax, page } = req.query;
      const data = await InmuebleService.listarPublicos({ departamento, municipio, tipoInmueble, tipoOperacion, precioMax, page });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async obtenerDetalle(req, res, next) {
    try {
      const data = await InmuebleService.obtenerDetallePublico(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Publicaciones propias ────────────────────────────────────
  async crear(req, res, next) {
    try {
      const data = await InmuebleService.crear(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async actualizar(req, res, next) {
    try {
      const data = await InmuebleService.actualizar(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cambiarEstado(req, res, next) {
    try {
      const data = await InmuebleService.cambiarEstado(req.usuario.id, Number(req.params.id), req.body.estado);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminar(req, res, next) {
    try {
      const data = await InmuebleService.eliminar(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misPublicaciones(req, res, next) {
    try {
      const data = await InmuebleService.misPublicaciones(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // POST /inmuebles/:id/foto (multipart, campo "foto")
  async subirFoto(req, res, next) {
    try {
      if (!req.file) throw new ErrorValidacion("Adjunta una imagen (campo 'foto')");
      const base = `${req.protocol}://${req.get("host")}`;
      const cloudUrl = await subirACloudinary(req.file.path, "afromercado/inmuebles");
      let url;
      if (cloudUrl) {
        url = cloudUrl;
        fs.unlink(req.file.path, () => {});
      } else {
        url = `${base}/uploads/inmuebles/${req.file.filename}`;
      }
      const data = await InmuebleService.guardarFoto(req.usuario.id, Number(req.params.id), url);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // POST /inmuebles/:id/documento-soporte (multipart, campo "documento")
  async subirDocumentoSoporte(req, res, next) {
    try {
      if (!req.file) throw new ErrorValidacion("Adjunta un archivo (campo 'documento')");
      const base = `${req.protocol}://${req.get("host")}`;
      const cloudUrl = await subirDocumentoACloudinary(req.file.path, "afromercado/inmuebles-documentos");
      let url;
      if (cloudUrl) {
        url = cloudUrl;
        fs.unlink(req.file.path, () => {});
      } else {
        url = `${base}/uploads/inmuebles-documentos/${req.file.filename}`;
      }
      const data = await InmuebleService.guardarDocumentoSoporte(req.usuario.id, Number(req.params.id), url);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Denuncias ────────────────────────────────────────────────
  async denunciar(req, res, next) {
    try {
      const data = await InmuebleService.denunciar(req.usuario.id, Number(req.params.id), req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Admin: moderación ────────────────────────────────────────
  async listarPendientesModeracion(req, res, next) {
    try {
      const data = await InmuebleService.listarPendientesModeracion();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async moderar(req, res, next) {
    try {
      const data = await InmuebleService.moderar(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Admin: denuncias ─────────────────────────────────────────
  async listarDenunciasPendientes(req, res, next) {
    try {
      const data = await InmuebleService.listarDenunciasPendientes();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async resolverDenuncia(req, res, next) {
    try {
      const data = await InmuebleService.resolverDenuncia(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = InmuebleController;
