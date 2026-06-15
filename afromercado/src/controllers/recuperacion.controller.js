const RecuperacionService = require("../services/recuperacion.service");

const RecuperacionController = {
  async solicitarCodigo(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "El campo email es obligatorio." });
      const resultado = await RecuperacionService.solicitarCodigo(email.toLowerCase().trim());
      res.json({ ok: true, ...resultado });
    } catch (err) {
      next(err);
    }
  },

  async verificarCodigo(req, res, next) {
    try {
      const { email, codigo } = req.body;
      if (!email || !codigo) return res.status(400).json({ error: "Email y código son obligatorios." });
      const resultado = await RecuperacionService.verificarCodigo(email.toLowerCase().trim(), String(codigo).trim());
      res.json({ ok: true, ...resultado });
    } catch (err) {
      next(err);
    }
  },

  async cambiarPassword(req, res, next) {
    try {
      const { resetToken, nuevaPassword } = req.body;
      const resultado = await RecuperacionService.cambiarPassword(resetToken, nuevaPassword);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = RecuperacionController;
