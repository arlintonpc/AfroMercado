// ============================================================
//  Repositorio de Usuarios — capa de acceso a datos
//  Solo esta capa habla con la base de datos (Prisma).
// ============================================================
const prisma = require("../config/prisma");

const UsuarioRepository = {
  async crear(datos) {
    return prisma.usuario.create({ data: datos });
  },

  async buscarPorEmail(email) {
    const emailNormalizado = String(email || "").trim().toLowerCase();
    return prisma.usuario.findFirst({
      where: {
        email: {
          equals: emailNormalizado,
          mode: "insensitive",
        },
      },
    });
  },

  async buscarPorTelefono(telefono) {
    // telefono no es @unique en el schema → findFirst, no findUnique
    return prisma.usuario.findFirst({ where: { telefono } });
  },

  async buscarPorId(id) {
    return prisma.usuario.findUnique({ where: { id } });
  },

  async actualizar(id, datos) {
    return prisma.usuario.update({
      where: { id },
      data: datos,
    });
  },
};

module.exports = UsuarioRepository;
