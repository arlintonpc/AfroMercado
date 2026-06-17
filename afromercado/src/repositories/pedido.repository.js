// ============================================================
//  Repositorio de Pedidos — capa de acceso a datos
// ============================================================
const prisma = require("../config/prisma");

const PedidoRepository = {
  /**
   * Crea un Pedido con sus SubPedidos y PedidoItems dentro de una transacción.
   * @param {object} datos - { compradorId, subtotal, comisionTotal, total, direccionTexto, direccionId?, notas?, expiresAt, subPedidos: [...] }
   * @param {object} tx - instancia de transacción de Prisma
   */
  async crear(datos, tx) {
    const db = tx || prisma;
    const {
      compradorId,
      subtotal,
      comisionTotal,
      total,
      direccionTexto,
      direccionId,
      notas,
      expiresAt,
      subPedidos,
      cuponId,
      cuponDescuento,
    } = datos;

    const pedido = await db.pedido.create({
      data: {
        compradorId,
        subtotal,
        comisionTotal,
        total,
        direccionTexto,
        direccionId: direccionId ?? null,
        notas: notas ?? null,
        expiresAt,
        ...(cuponId != null ? { cuponId, cuponDescuento: cuponDescuento ?? null } : {}),
        estado: "PENDIENTE_PAGO",
        subPedidos: {
          create: subPedidos.map((sp) => ({
            comercioId: sp.comercioId,
            subtotal: sp.subtotal,
            comision: sp.comision,
            neto: sp.neto,
            estado: "CONFIRMADO",
            items: {
              create: sp.items.map((item) => ({
                productoId: item.productoId,
                ofertaId: item.ofertaId ?? null,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                subtotal: item.subtotal,
              })),
            },
          })),
        },
      },
      include: {
        subPedidos: {
          include: {
            items: { include: { producto: { select: { nombre: true } } } },
            comercio: { include: { usuario: { select: { nombre: true } } } },
          },
        },
      },
    });

    return pedido;
  },

  async buscarPorId(id) {
    return prisma.pedido.findUnique({
      where: { id },
      include: {
        subPedidos: {
          include: {
            items: { include: { producto: true } },
            comercio: true,
          },
        },
      },
    });
  },

  async listarPorComprador(compradorId) {
    return prisma.pedido.findMany({
      where: { compradorId },
      orderBy: { createdAt: "desc" },
      include: {
        subPedidos: {
          include: {
            comercio: true,
            items: { include: { producto: true } },
          },
        },
      },
    });
  },

  async actualizarEstado(id, estado, tx) {
    const db = tx || prisma;
    return db.pedido.update({ where: { id }, data: { estado } });
  },
};

module.exports = PedidoRepository;
