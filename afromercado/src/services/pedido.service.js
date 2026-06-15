// ============================================================
//  Servicio de Pedidos — lógica de negocio
// ============================================================
const prisma = require("../config/prisma");
const CarritoRepository = require("../repositories/carrito.repository");
const PedidoRepository = require("../repositories/pedido.repository");
const { calcularDesglose } = require("../utils/comision");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");

const ESTADOS_CANCELABLES = ["PENDIENTE_PAGO", "VERIFICANDO_PAGO"];

const PedidoService = {
  async checkout(usuarioId, datos = {}) {
    const { direccionTexto, direccionId, notas } = datos;
    if (!direccionTexto || !direccionTexto.trim()) {
      throw new ErrorValidacion("La dirección de entrega es obligatoria");
    }

    // 1. Obtener carrito
    const items = await CarritoRepository.obtenerCarrito(usuarioId);
    if (!items.length) throw new ErrorValidacion("El carrito está vacío");

    // 2. Agrupar por comercioId
    const porComercio = {};
    for (const item of items) {
      const cid = item.producto.comercioId;
      if (!porComercio[cid]) porComercio[cid] = { comercio: item.producto.comercio, items: [] };
      porComercio[cid].items.push(item);
    }

    // 3. Verificar stock disponible (fuera de la tx, rápido)
    for (const item of items) {
      const p = item.producto;
      const disponible = p.stock - p.stockReservado;
      if (disponible < item.cantidad) {
        throw new ErrorValidacion(
          `Stock insuficiente para "${p.nombre}". Disponible: ${disponible}`
        );
      }
    }

    // 4. Calcular montos
    let subtotalGeneral = 0;
    let comisionGeneral = 0;
    const subPedidosData = Object.values(porComercio).map(({ comercio, items: itms }) => {
      const subtotalComercio = itms.reduce(
        (acc, i) => acc + Number(i.producto.precio) * i.cantidad,
        0
      );
      const desglose = calcularDesglose(subtotalComercio, 0.1);
      subtotalGeneral += desglose.subtotal;
      comisionGeneral += desglose.comision;

      return {
        comercioId: comercio.id,
        subtotal: desglose.subtotal,
        comision: desglose.comision,
        neto: desglose.montoComerciante,
        items: itms.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          precioUnitario: Number(i.producto.precio),
          subtotal: Number(i.producto.precio) * i.cantidad,
        })),
      };
    });
    // El comprador paga el subtotal; la comisión sale de la parte del comerciante
    const totalGeneral = subtotalGeneral;

    // 5. Transacción atómica
    const pedido = await prisma.$transaction(async (tx) => {
      // 5a. Reservar stock con UPDATE atómico
      for (const item of items) {
        const result = await tx.$executeRaw`
          UPDATE "Producto"
          SET "stockReservado" = "stockReservado" + ${item.cantidad}
          WHERE id = ${item.productoId}
            AND ("stock" - "stockReservado") >= ${item.cantidad}
        `;
        if (result === 0) {
          throw new ErrorValidacion(
            `No hay stock suficiente para "${item.producto.nombre}" al momento de confirmar`
          );
        }
      }

      // 5b. Crear pedido con expiresAt = now + 30 min
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const nuevoPedido = await PedidoRepository.crear(
        {
          compradorId: usuarioId,
          subtotal: subtotalGeneral,
          comisionTotal: comisionGeneral,
          total: totalGeneral,
          direccionTexto: direccionTexto.trim(),
          direccionId,
          notas,
          expiresAt,
          subPedidos: subPedidosData,
        },
        tx
      );

      // 5e. Vaciar carrito
      await tx.carritoItem.deleteMany({ where: { usuarioId } });

      return nuevoPedido;
    });

    return {
      pedido,
      instruccionesPago: {
        mensaje: "Tienes 30 minutos para completar el pago antes de que el pedido expire.",
        expiresAt: pedido.expiresAt,
        total: pedido.total,
      },
    };
  },

  async cancelar(usuarioId, pedidoId) {
    const pedido = await PedidoRepository.buscarPorId(pedidoId);
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    if (pedido.compradorId !== usuarioId) throw new ErrorProhibido("No puedes cancelar este pedido");
    if (!ESTADOS_CANCELABLES.includes(pedido.estado)) {
      throw new ErrorValidacion(`No se puede cancelar un pedido en estado "${pedido.estado}"`);
    }

    await prisma.$transaction(async (tx) => {
      // Liberar stockReservado
      for (const sub of pedido.subPedidos) {
        for (const item of sub.items) {
          await tx.$executeRaw`
            UPDATE "Producto"
            SET "stockReservado" = GREATEST("stockReservado" - ${item.cantidad}, 0)
            WHERE id = ${item.productoId}
          `;
        }
      }
      await PedidoRepository.actualizarEstado(pedidoId, "CANCELADO", tx);
    });

    return { mensaje: "Pedido cancelado exitosamente" };
  },

  async listar(usuarioId) {
    return PedidoRepository.listarPorComprador(usuarioId);
  },

  async detalle(usuarioId, pedidoId) {
    const pedido = await PedidoRepository.buscarPorId(pedidoId);
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    if (pedido.compradorId !== usuarioId) throw new ErrorProhibido("No tienes acceso a este pedido");
    return pedido;
  },
};

module.exports = PedidoService;
