// ============================================================
//  Controlador de Autenticación
//  Recibe la petición HTTP, llama al servicio y responde.
//  No tiene lógica de negocio.
// ============================================================
const AuthService = require("../services/auth.service");

const setTokenCookie = (res, token) => {
  res.cookie('afromercado_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
  });
};

const AuthController = {
  async registrar(req, res, next) {
    try {
      const resultado = await AuthService.registrar(req.body);
      setTokenCookie(res, resultado.token);
      res.status(201).json({ ok: true, ...resultado });
    } catch (e) {
      next(e); // lo maneja el middleware de errores
    }
  },

  async login(req, res, next) {
    try {
      const resultado = await AuthService.login(req.body);
      setTokenCookie(res, resultado.token);
      res.status(200).json({ ok: true, ...resultado });
    } catch (e) {
      next(e);
    }
  },

  async logout(req, res) {
    res.clearCookie('afromercado_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.json({ ok: true });
  },

  // Devuelve los datos del usuario autenticado (requiere token)
  async yo(req, res) {
    res.json({ ok: true, usuario: req.usuario });
  },
};

module.exports = AuthController;
