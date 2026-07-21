// ============================================================
//  Controlador de Autenticación
//  Recibe la petición HTTP, llama al servicio y responde.
//  No tiene lógica de negocio.
// ============================================================
const AuthService = require("../services/auth.service");

// Frontend (Vercel) y backend (Render) viven en dominios distintos, asi que
// esto es cross-site de verdad, no solo cross-origin. Una cookie SameSite=Lax
// no se envia en peticiones fetch/XHR cross-site (solo en navegacion top-level),
// por eso en produccion necesita SameSite=None + Secure. En dev ambos corren en
// localhost (mismo site, distinto puerto) y sin HTTPS, asi que ahi se mantiene Lax.
const esProduccion = process.env.NODE_ENV === 'production';

const setTokenCookie = (res, token) => {
  res.cookie('afromercado_token', token, {
    httpOnly: true,
    secure: esProduccion,
    sameSite: esProduccion ? 'none' : 'lax',
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
      secure: esProduccion,
      sameSite: esProduccion ? 'none' : 'lax'
    });
    res.json({ ok: true });
  },

  // Devuelve los datos del usuario autenticado (requiere token)
  async yo(req, res) {
    res.json({ ok: true, usuario: req.usuario });
  },
};

module.exports = AuthController;
