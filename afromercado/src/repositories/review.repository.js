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

  async crearTienda({ comercioId, compradorId, pedidoId, calificacion, comentario }) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { comercioId, compradorId, pedidoId, calificacion, comentario },
        include: { comprador: { select: { nombre: true } } },
      });

      const comercio = await tx.comercio.findUnique({
        where: { id: comercioId },
        select: { calificacion: true, totalReviews: true },
      });

      const calActual = Number(comercio.calificacion ?? 0);
      const totalActual = comercio.totalReviews ?? 0;
      const nuevaCal = (calActual * totalActual + calificacion) / (totalActual + 1);

      await tx.comercio.update({
        where: { id: comercioId },
        data: {
          calificacion: Math.round(nuevaCal * 10) / 10,
          totalReviews: totalActual + 1,
        },
      });

      return review;
    });
  },

  async listarPorComercio(comercioId) {
    return prisma.review.findMany({
      where: { comercioId },
      orderBy: { createdAt: "desc" },
      include: { comprador: { select: { nombre: true } } },
      take: 50,
    });
  },

  async existeTiendaDelComprador(compradorId, pedidoId) {
    return prisma.review.findUnique({
      where: { pedidoId },
    });
  },

  async compradorTienePedidoEntregadoEnComercio(compradorId, comercioId) {
    return prisma.pedido.findFirst({
      where: {
        compradorId,
        estado: "ENTREGADO",
        subPedidos: { some: { comercioId } },
      },
    });
  },
};

module.exports = ReviewRepository;
