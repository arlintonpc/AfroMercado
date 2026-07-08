const fs = require("fs");
const EmpleoService = require("../services/empleo.service");
const { subirDocumentoACloudinary } = require("../utils/cloudinary");
const { ErrorValidacion } = require("../utils/errores");

const EmpleoController = {
  // ── Públicas ─────────────────────────────────────────────────
  async listarPublicas(req, res, next) {
    try {
      const { municipio, departamento, categoria, tipoContrato, search, salarioMin, salarioMax, page } = req.query;
      const data = await EmpleoService.listarPublicas({ municipio, departamento, categoria, tipoContrato, search, salarioMin, salarioMax, page });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async obtenerDetalle(req, res, next) {
    try {
      const data = await EmpleoService.obtenerDetallePublico(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async otrasDelPublicador(req, res, next) {
    try {
      const data = await EmpleoService.otrasDelPublicador(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Favoritos ────────────────────────────────────────────────
  async toggleFavorito(req, res, next) {
    try {
      const data = await EmpleoService.toggleFavorito(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misFavoritos(req, res, next) {
    try {
      const data = await EmpleoService.misFavoritos(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async esFavorito(req, res, next) {
    try {
      const data = await EmpleoService.esFavorito(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Ofertas propias ──────────────────────────────────────────
  async crearOferta(req, res, next) {
    try {
      const data = await EmpleoService.crearOferta(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async actualizarOferta(req, res, next) {
    try {
      const data = await EmpleoService.actualizarOferta(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cambiarEstadoOferta(req, res, next) {
    try {
      const data = await EmpleoService.cambiarEstado(req.usuario.id, Number(req.params.id), req.body.estado);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misOfertas(req, res, next) {
    try {
      const data = await EmpleoService.misOfertas(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Hoja de vida ─────────────────────────────────────────────
  async obtenerMiHojaDeVida(req, res, next) {
    try {
      const data = await EmpleoService.obtenerMiHojaDeVida(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async guardarHojaDeVida(req, res, next) {
    try {
      const data = await EmpleoService.guardarHojaDeVida(req.usuario.id, req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // POST /empleo/hoja-de-vida/cv (multipart, campo "cv")
  async subirCvHojaDeVida(req, res, next) {
    try {
      if (!req.file) throw new ErrorValidacion("Adjunta un archivo PDF (campo 'cv')");
      const base = `${req.protocol}://${req.get("host")}`;
      const cloudUrl = await subirDocumentoACloudinary(req.file.path, "afromercado/hojas-de-vida");
      let cvUrl;
      if (cloudUrl) {
        cvUrl = cloudUrl;
        fs.unlink(req.file.path, () => {});
      } else {
        cvUrl = `${base}/uploads/hojas-de-vida/${req.file.filename}`;
      }
      const data = await EmpleoService.guardarCvHojaDeVida(req.usuario.id, cvUrl);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Postulaciones ────────────────────────────────────────────
  async postularse(req, res, next) {
    try {
      const data = await EmpleoService.postularse(req.usuario.id, Number(req.params.id), req.body.mensaje, req.body.respuestas);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misPostulaciones(req, res, next) {
    try {
      const data = await EmpleoService.misPostulaciones(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async postulacionesDeOferta(req, res, next) {
    try {
      const data = await EmpleoService.postulacionesDeOferta(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cambiarEstadoPostulacion(req, res, next) {
    try {
      const { estado, notasPublicador } = req.body;
      const data = await EmpleoService.cambiarEstadoPostulacion(req.usuario.id, Number(req.params.id), estado, notasPublicador);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async retirarPostulacion(req, res, next) {
    try {
      const data = await EmpleoService.retirarPostulacion(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Admin: moderación ────────────────────────────────────────
  async listarPendientesModeracion(req, res, next) {
    try {
      const data = await EmpleoService.listarPendientesModeracion();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async moderar(req, res, next) {
    try {
      const data = await EmpleoService.moderar(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Denuncias ────────────────────────────────────────────────
  async denunciarOferta(req, res, next) {
    try {
      const data = await EmpleoService.denunciarOferta(req.usuario.id, Number(req.params.id), req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async yaDenuncie(req, res, next) {
    try {
      const data = await EmpleoService.yaDenuncie(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── Admin: denuncias ─────────────────────────────────────────
  async listarDenunciasPendientes(req, res, next) {
    try {
      const data = await EmpleoService.listarDenunciasPendientes();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async resolverDenuncia(req, res, next) {
    try {
      const data = await EmpleoService.resolverDenuncia(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = EmpleoController;
