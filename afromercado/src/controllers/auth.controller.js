// ============================================================
//  Controlador de Autenticación
//  Recibe la petición HTTP, llama al servicio y responde.
//  No tiene lógica de negocio.
// ============================================================
const AuthService = require("../services/auth.service");

const AuthController = {
  async registrar(req, res, next) {
    try {
      const resultado = await AuthService.registrar(req.body);
      res.status(201).json({ ok: true, ...resultado });
    } catch (e) {
      next(e); // lo maneja el middleware de errores
    }
  },

  async login(req, res, next) {
    try {
      const resultado = await AuthService.login(req.body);
      res.status(200).json({ ok: true, ...resultado });
    } catch (e) {
      next(e);
    }
  },

  // Devuelve los datos del usuario autenticado (requiere token)
  async yo(req, res) {
    res.json({ ok: true, usuario: req.usuario });
  },
};

module.exports = AuthController;
