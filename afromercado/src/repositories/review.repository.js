const prisma = require("../config/prisma");
const { recalcularCalificacionComercio } = require("../utils/resena");

const AUTOR_NOMBRE = { autor: { select: { nombre: true } } };

function _mapProducto(r) {
  return {
    id: r.id,
    productoId: r.entidadId,
    compradorId: r.autorId,
    calificacion: r.calificacion,
    comentario: r.comentario,
    createdAt: r.createdAt,
    ...(r.autor ? { comprador: { nombre: r.autor.nombre } } : {}),
  };
}

function _mapTienda(r) {
  return {
    id: r.id,
    comercioId: r.comercioId,
    compradorId: r.autorId,
    pedidoId: r.entidadId,
    calificacion: r.calificacion,
    comentario: r.comentario,
    createdAt: r.createdAt,
    ...(r.autor ? { comprador: { nombre: r.autor.nombre } } : {}),
  };
}

const ReviewRepository = {
  async crear({ productoId, compradorId, calificacion, comentario }) {
    const producto = await prisma.producto.findUnique({ where: { id: productoId }, select: { comercioId: true } });
    const resena = await prisma.resena.create({
      data: {
        tipoEntidad: "PRODUCTO", entidadId: productoId, comercioId: producto?.comercioId ?? null,
        autorId: compradorId, calificacion, comentario,
      },
      include: AUTOR_NOMBRE,
    });
    return _mapProducto(resena);
  },

  async listarPorProducto(productoId) {
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "PRODUCTO", entidadId: productoId },
      orderBy: { createdAt: "desc" },
      include: AUTOR_NOMBRE,
    });
    return rows.map(_mapProducto);
  },

  async existeDelComprador(compradorId, productoId) {
    return prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "PRODUCTO", entidadId: productoId, autorId: compradorId } },
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
    const res = await prisma.resena.aggregate({
      where: { tipoEntidad: "PRODUCTO", entidadId: productoId },
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
      const resena = await tx.resena.create({
        data: { tipoEntidad: "PEDIDO", entidadId: pedidoId, comercioId, autorId: compradorId, calificacion, comentario },
        include: AUTOR_NOMBRE,
      });
      await recalcularCalificacionComercio(tx, comercioId);
      return _mapTienda(resena);
    });
  },

  async listarPorComercio(comercioId) {
    const rows = await prisma.resena.findMany({
      where: { tipoEntidad: "PEDIDO", comercioId },
      orderBy: { createdAt: "desc" },
      include: AUTOR_NOMBRE,
      take: 50,
    });
    return rows.map(_mapTienda);
  },

  async existeTiendaDelComprador(compradorId, pedidoId) {
    return prisma.resena.findUnique({
      where: { tipoEntidad_entidadId_autorId: { tipoEntidad: "PEDIDO", entidadId: pedidoId, autorId: compradorId } },
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
