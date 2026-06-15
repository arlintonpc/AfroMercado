// ============================================================
//  Repositorio de Pagos — capa de acceso a datos
// ============================================================
const prisma = require("../config/prisma");

const PagoRepository = {
  /**
   * Crea un Pago. Acepta una transacción opcional.
   * @param {object} datos - { pedidoId, monto, metodo, estado?, referencia?, idempotencyKey }
   * @param {object} [tx] - instancia de transacción de Prisma
   */
  async crear(datos, tx) {
    const db = tx || prisma;
    return db.pago.create({ data: datos });
  },

  async buscarPorIdempotencyKey(idempotencyKey) {
    return prisma.pago.findUnique({ where: { idempotencyKey } });
  },

  async buscarPorId(id) {
    return prisma.pago.findUnique({
      where: { id },
      include: { pedido: true },
    });
  },

  async buscarPorPedido(pedidoId) {
    return prisma.pago.findMany({
      where: { pedidoId },
      orderBy: { createdAt: "desc" },
    });
  },

  async actualizar(id, datos, tx) {
    const db = tx || prisma;
    return db.pago.update({ where: { id }, data: datos });
  },

  /**
   * Lista los pagos que están en estado VERIFICANDO (a la espera de revisión
   * por parte del administrador), incluyendo el pedido y el comprador.
   */
  async listarPendientes() {
    return prisma.pago.findMany({
      where: { estado: "VERIFICANDO" },
      orderBy: { createdAt: "asc" },
      include: {
        pedido: {
          include: {
            comprador: {
              select: { id: true, nombre: true, email: true, telefono: true },
            },
            subPedidos: {
              include: {
                comercio: { select: { id: true, nombre: true } },
                items: { include: { producto: { select: { id: true, nombre: true } } } },
              },
            },
          },
        },
      },
    });
  },
};

module.exports = PagoRepository;
