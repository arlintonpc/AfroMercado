const prisma = require("../config/prisma");

const DireccionRepository = {
  async listarPorUsuario(usuarioId) {
    return prisma.direccion.findMany({
      where: { usuarioId, deletedAt: null },
      orderBy: [{ esPrincipal: "desc" }, { id: "asc" }],
    });
  },

  async buscarPorId(id, usuarioId) {
    return prisma.direccion.findFirst({
      where: { id, usuarioId, deletedAt: null },
    });
  },

  async crear(usuarioId, datos) {
    return prisma.direccion.create({
      data: {
        usuarioId,
        alias: datos.alias,
        linea1: datos.linea1,
        barrio: datos.barrio ?? null,
        municipio: datos.municipio,
        departamento: datos.departamento,
        referencia: datos.referencia ?? null,
        telefono: datos.telefono ?? null,
        esPrincipal: datos.esPrincipal ?? false,
      },
    });
  },

  async actualizar(id, usuarioId, datos) {
    return prisma.direccion.update({
      where: { id },
      data: {
        alias: datos.alias,
        linea1: datos.linea1,
        barrio: datos.barrio ?? null,
        municipio: datos.municipio,
        departamento: datos.departamento,
        referencia: datos.referencia ?? null,
        telefono: datos.telefono ?? null,
        esPrincipal: datos.esPrincipal ?? false,
      },
    });
  },

  async eliminar(id, usuarioId) {
    return prisma.direccion.updateMany({
      where: { id, usuarioId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },

  async quitarPrincipal(usuarioId) {
    return prisma.direccion.updateMany({
      where: { usuarioId, esPrincipal: true, deletedAt: null },
      data: { esPrincipal: false },
    });
  },

  async marcarPrincipal(id, usuarioId) {
    await prisma.direccion.updateMany({
      where: { usuarioId, esPrincipal: true, deletedAt: null },
      data: { esPrincipal: false },
    });
    return prisma.direccion.update({
      where: { id },
      data: { esPrincipal: true },
    });
  },

  async contarPorUsuario(usuarioId) {
    return prisma.direccion.count({
      where: { usuarioId, deletedAt: null },
    });
  },
};

module.exports = DireccionRepository;
