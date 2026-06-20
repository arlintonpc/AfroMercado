// ============================================================
//  Controlador de Usuario
//  Recibe la petición HTTP, llama al servicio y responde.
// ============================================================
const UsuarioService = require("../services/usuario.service");

const UsuarioController = {
  async obtenerPerfil(req, res, next) {
    try {
      const perfil = await UsuarioService.obtenerPerfil(req.usuario.id);
      res.json({ ok: true, data: perfil });
    } catch (err) {
      next(err);
    }
  },

  async actualizarPerfil(req, res, next) {
    try {
      const actualizado = await UsuarioService.actualizarPerfil(req.usuario.id, req.body);
      res.json({ ok: true, data: actualizado });
    } catch (err) {
      next(err);
    }
  },

  async cambiarPassword(req, res, next) {
    try {
      await UsuarioService.cambiarPassword(req.usuario.id, req.body);
      res.json({ ok: true, mensaje: "Contraseña actualizada correctamente." });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = UsuarioController;
