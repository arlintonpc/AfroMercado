const prisma = require("../config/prisma");

const ConfigRepository = {
  async obtener(clave) {
    const row = await prisma.config.findUnique({ where: { clave } });
    return row?.valor ?? null;
  },

  async guardar(clave, valor) {
    return prisma.config.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });
  },

  async obtenerVarios(claves) {
    const rows = await prisma.config.findMany({ where: { clave: { in: claves } } });
    return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
  },
};

module.exports = ConfigRepository;
