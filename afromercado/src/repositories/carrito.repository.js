// ============================================================
//  Repositorio de Carrito — capa de acceso a datos
// ============================================================
const prisma = require("../config/prisma");

const CarritoRepository = {
  async obtenerCarrito(usuarioId) {
    return prisma.carritoItem.findMany({
      where: {
        usuarioId,
        producto: { deletedAt: null },
      },
      include: {
        producto: {
          include: { comercio: true },
        },
      },
    });
  },

  async agregarItem(usuarioId, productoId, cantidad, precio) {
    return prisma.carritoItem.upsert({
      where: { usuarioId_productoId: { usuarioId, productoId } },
      update: { cantidad, precioAlAgregar: precio },
      create: { usuarioId, productoId, cantidad, precioAlAgregar: precio },
    });
  },

  async actualizarCantidad(usuarioId, productoId, cantidad) {
    return prisma.carritoItem.update({
      where: { usuarioId_productoId: { usuarioId, productoId } },
      data: { cantidad },
    });
  },

  async eliminarItem(usuarioId, productoId) {
    // deleteMany: no lanza si el item no existe (idempotente).
    return prisma.carritoItem.deleteMany({
      where: { usuarioId, productoId },
    });
  },

  async vaciarCarrito(usuarioId) {
    return prisma.carritoItem.deleteMany({ where: { usuarioId } });
  },
};

module.exports = CarritoRepository;
