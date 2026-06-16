const prisma = require("../config/prisma");

const ReviewRepository = {
  async crear({ productoId, compradorId, calificacion, comentario }) {
    return prisma.reviewProducto.create({
      data: { productoId, compradorId, calificacion, comentario },
      include: { comprador: { select: { nombre: true } } },
    });
  },

  async listarPorProducto(productoId) {
    return prisma.reviewProducto.findMany({
      where: { productoId },
      orderBy: { createdAt: "desc" },
      include: { comprador: { select: { nombre: true } } },
    });
  },

  async existeDelComprador(compradorId, productoId) {
    return prisma.reviewProducto.findUnique({
      where: { compradorId_productoId: { compradorId, productoId } },
    });
  },

  async compradorComproProducto(compradorId, productoId) {
    const item = await prisma.pedidoItem.findFirst({
      where: {
        productoId,
        subPedido: {
          pedido: {
            compradorId,
            estado: { in: ["CONFIRMADO", "ENTREGADO"] },
          },
        },
      },
    });
    return !!item;
  },

  async promedioProducto(productoId) {
    const res = await prisma.reviewProducto.aggregate({
      where: { productoId },
      _avg: { calificacion: true },
      _count: { id: true },
    });
    return {
      promedio: res._avg.calificacion ? Math.round(res._avg.calificacion * 10) / 10 : null,
      total: res._count.id,
    };
  },
};

module.exports = ReviewRepository;
