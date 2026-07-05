// ============================================================
//  Repositorio de Carrito — capa de acceso a datos
// ============================================================
const prisma = require("../config/prisma");
const { filtroComercioPublicable } = require("../utils/comercio-publicacion");

const CarritoRepository = {
  async obtenerCarrito(usuarioId) {
    const ahora = new Date();
    return prisma.carritoItem.findMany({
      where: {
        usuarioId,
        producto: {
          deletedAt: null,
          activo: true,
          comercio: filtroComercioPublicable(),
        },
      },
      include: {
        producto: {
          include: {
            comercio: { include: { configFiscal: { select: { ivaActivo: true, ivaPorcentaje: true } } } },
            ofertas: {
              where: { activa: true, inicio: { lte: ahora }, fin: { gte: ahora } },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
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

  async actualizarCantidad(usuarioId, productoId, cantidad, precio) {
    return prisma.carritoItem.update({
      where: { usuarioId_productoId: { usuarioId, productoId } },
      data: precio !== undefined ? { cantidad, precioAlAgregar: precio } : { cantidad },
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
