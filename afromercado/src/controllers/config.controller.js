const prisma = require("../config/prisma");
const Reglas = require("../config/reglas");

const MODOS_VALIDOS  = ["FIJAS", "DINAMICO", "ALEATORIO"];
const FUENTES_VALIDAS = ["ORGANICO", "CAMPANAS", "MIXTO"];

// Reglas que el frontend puede leer sin autenticación (no sensibles).
const REGLAS_PUBLICAS = [
  "envio_gratis_umbral_plataforma",
  "envio_gratis_vendedor_permitido",
  "envio_politica_multicomercio",
  "cupon_combinable_con_oferta",
  "whatsapp_boton_activo",
  "legal_razon_social",
  "legal_nit",
  "legal_direccion",
  "legal_email",
  "legal_telefono",
];

function upsert(clave, valor) {
  return prisma.config.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  });
}

const ConfigController = {
  async heroGet(req, res, next) {
    try {
      const rows = await prisma.config.findMany({
        where: { clave: { in: ["hero.modo", "hero.intervaloSegundos", "hero.fuente"] } },
      });
      const map = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
      res.json({
        ok: true,
        modo:               map["hero.modo"]               ?? "FIJAS",
        intervaloSegundos:  Number(map["hero.intervaloSegundos"] ?? 10),
        fuente:             map["hero.fuente"]              ?? "ORGANICO",
      });
    } catch (err) { next(err); }
  },

  // GET /config/publicas → reglas no sensibles para el frontend
  async publicasGet(req, res, next) {
    try {
      const data = {};
      for (const clave of REGLAS_PUBLICAS) {
        data[clave] = await Reglas.obtener(clave);
      }
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async heroPut(req, res, next) {
    try {
      const { modo, intervaloSegundos, fuente } = req.body;
      if (modo   && !MODOS_VALIDOS.includes(modo))    return res.status(400).json({ error: "Modo inválido." });
      if (fuente && !FUENTES_VALIDAS.includes(fuente)) return res.status(400).json({ error: "Fuente inválida." });

      const intervalo = Math.max(5, Math.min(300, Number(intervaloSegundos ?? 10)));
      const ops = [];
      if (modo)   ops.push(upsert("hero.modo", modo));
      if (fuente) ops.push(upsert("hero.fuente", fuente));
      ops.push(upsert("hero.intervaloSegundos", String(intervalo)));
      await Promise.all(ops);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = ConfigController;
