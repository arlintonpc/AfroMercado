// ============================================================
//  Repositorio de Comercios — capa de acceso a datos
//  Solo esta capa habla con la base de datos (Prisma).
// ============================================================
const prisma = require("../config/prisma");

const ComercioRepository = {
  async buscarPorUsuarioId(usuarioId) {
    return prisma.comercio.findUnique({ where: { usuarioId } });
  },

  async buscarPorUsuarioIdConCuenta(usuarioId) {
    return prisma.comercio.findUnique({
      where: { usuarioId },
      include: { cuentaDispersion: true },
    });
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

  // ── Denuncias ─────────────────────────────────────────────────
  async crearDenuncia(data) {
    return prisma.denunciaComercio.create({ data });
  },

  async buscarDenuncia(comercioId, denuncianteId) {
    return prisma.denunciaComercio.findUnique({
      where: { comercioId_denuncianteId: { comercioId, denuncianteId } },
    });
  },

  async buscarDenunciaPorId(id) {
    return prisma.denunciaComercio.findUnique({
      where: { id },
      include: { comercio: { select: { id: true, nombre: true, usuarioId: true } } },
    });
  },

  async listarDenunciasPendientes() {
    return prisma.denunciaComercio.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        comercio: { select: { id: true, nombre: true, usuarioId: true } },
        denunciante: { select: { id: true, nombre: true, email: true } },
      },
    });
  },

  async actualizarDenuncia(id, data) {
    return prisma.denunciaComercio.update({ where: { id }, data });
  },
};

module.exports = ComercioRepository;
