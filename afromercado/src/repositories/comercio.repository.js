// ============================================================
//  Repositorio de Comercios — capa de acceso a datos
//  Solo esta capa habla con la base de datos (Prisma).
// ============================================================
const prisma = require("../config/prisma");

const ComercioRepository = {
  async buscarPorUsuarioId(usuarioId) {
    return prisma.comercio.findUnique({ where: { usuarioId } });
  },

  async buscarPorId(id) {
    return prisma.comercio.findUnique({ where: { id: Number(id) } });
  },

  async crear(data) {
    return prisma.comercio.create({ data });
  },

  async actualizar(id, data) {
    return prisma.comercio.update({ where: { id: Number(id) }, data });
  },

  async listar({ municipio, pagina = 1, porPagina = 20 } = {}) {
    const where = { activo: true };
    if (municipio) where.municipio = municipio;

    const [total, items] = await Promise.all([
      prisma.comercio.count({ where }),
      prisma.comercio.findMany({
        where,
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { total, pagina, porPagina, items };
  },
};

module.exports = ComercioRepository;
