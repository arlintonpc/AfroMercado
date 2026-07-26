// ============================================================
//  Servicio de Pagos — lógica de negocio
// ============================================================
const prisma = require("../config/prisma");
const PagoRepository = require("../repositories/pago.repository");
const PedidoRepository = require("../repositories/pedido.repository");
const {
  ErrorValidacion,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorConflicto,
} = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const PaymentConfigService = require("./payment-config.service");
const { bloquearPedido } = require("../utils/bloqueos-transaccionales");

const METODOS_VALIDOS = ["NEQUI", "DAVIPLATA", "TRANSFERENCIA", "EFECTIVO"];

async function validarPagosManualesActivos() {
  if (!await PaymentConfigService.pagosManualesHabilitados()) {
    throw new ErrorValidacion("Los pagos manuales estan deshabilitados. Usa el checkout digital.");
  }
}

const PagoService = {
  /**
   * Crea un pago para un pedido del comprador.
   * Idempotente: si el idempotencyKey ya existe, retorna el pago existente.
   */
  async crearPago(usuarioId, { pedidoId, metodo, referencia, idempotencyKey }) {
    await validarPagosManualesActivos();
    if (!idempotencyKey) {
      throw new ErrorValidacion("El idempotencyKey es obligatorio");
    }
    if (!pedidoId) {
      throw new ErrorValidacion("El pedidoId es obligatorio");
    }
    if (!metodo || !METODOS_VALIDOS.includes(metodo)) {
      throw new ErrorValidacion(
        `Método de pago inválido. Opciones: ${METODOS_VALIDOS.join(", ")}`
      );
    }

    const pedidoIdNum = Number(pedidoId);

    // Validar propiedad antes de consultar una clave que podria pertenecer a otro usuario.
    const pedido = await PedidoRepository.buscarPorId(pedidoIdNum);
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    if (pedido.compradorId !== usuarioId) {
      throw new ErrorProhibido("Este pedido no te pertenece");
    }

    const existente = await PagoRepository.buscarPorIdempotencyKey(idempotencyKey);
    if (existente) {
      if (existente.pedidoId !== pedidoIdNum || existente.metodo !== metodo) {
        throw new ErrorConflicto(
          "La clave de idempotencia ya fue usada con una solicitud diferente"
        );
      }
      return existente;
    }

    if (pedido.estado !== "PENDIENTE_PAGO") {
      throw new ErrorValidacion(
        `No se puede pagar un pedido en estado "${pedido.estado}"`
      );
    }

    // 3-4. Crear pago (PENDIENTE) y mover pedido a VERIFICANDO_PAGO en una transacción.
    let pago;
    try {
      pago = await prisma.$transaction(async (tx) => {
        await bloquearPedido(tx, pedidoIdNum);
        const pedidoActual = await tx.pedido.findUnique({
          where: { id: pedidoIdNum },
          select: { compradorId: true, estado: true, total: true },
        });
        if (!pedidoActual) throw new ErrorNoEncontrado("Pedido no encontrado");
        if (pedidoActual.compradorId !== usuarioId) {
          throw new ErrorProhibido("Este pedido no te pertenece");
        }

        const concurrente = await PagoRepository.buscarPorIdempotencyKey(
          idempotencyKey,
          tx
        );
        if (concurrente) {
          if (
            concurrente.pedidoId !== pedidoIdNum ||
            concurrente.metodo !== metodo
          ) {
            throw new ErrorConflicto(
              "La clave de idempotencia ya fue usada con una solicitud diferente"
            );
          }
          return concurrente;
        }

        if (pedidoActual.estado !== "PENDIENTE_PAGO") {
          throw new ErrorValidacion(
            `No se puede pagar un pedido en estado "${pedidoActual.estado}"`
          );
        }

        const nuevoPago = await PagoRepository.crear(
          {
            pedidoId: pedidoIdNum,
            monto: pedidoActual.total,
            metodo,
            estado: "PENDIENTE",
            referencia: referencia || null,
            idempotencyKey,
          },
          tx
        );

        await PedidoRepository.actualizarEstado(pedidoIdNum, "VERIFICANDO_PAGO", tx);

        return nuevoPago;
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const concurrente = await PagoRepository.buscarPorIdempotencyKey(idempotencyKey);
      if (
        !concurrente ||
        concurrente.pedidoId !== pedidoIdNum ||
        concurrente.metodo !== metodo
      ) {
        throw new ErrorConflicto(
          "La clave de idempotencia ya fue usada con una solicitud diferente"
        );
      }
      return concurrente;
    }

    // 5. Retornar pago
    return pago;
  },

  /**
   * Adjunta el comprobante de pago (URL del archivo subido) y pasa el pago a
   * estado VERIFICANDO para que el administrador lo revise.
   */
  async adjuntarComprobante(usuarioId, pagoId, comprobanteUrl) {
    await validarPagosManualesActivos();
    if (!comprobanteUrl) {
      throw new ErrorValidacion("Falta el comprobante");
    }
    const pago = await PagoRepository.buscarPorId(Number(pagoId));
    if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");

    // Validar ownership: el pago pertenece a un pedido del usuario.
    if (!pago.pedido || pago.pedido.compradorId !== usuarioId) {
      throw new ErrorProhibido("Este pago no te pertenece");
    }
    if (!["PENDIENTE", "VERIFICANDO"].includes(pago.estado)) {
      throw new ErrorValidacion("Este pago ya fue procesado y no admite un nuevo comprobante");
    }
    if (!["PENDIENTE_PAGO", "VERIFICANDO_PAGO"].includes(pago.pedido.estado)) {
      throw new ErrorValidacion("Este pedido ya fue procesado y no admite nuevos comprobantes");
    }

    const pagoActualizado = await PagoRepository.actualizar(pago.id, {
      comprobanteUrl,
      estado: "VERIFICANDO",
    });

    setImmediate(async () => {
      try {
        const pedidoCompleto = await prisma.pedido.findUnique({
          where: { id: pago.pedidoId },
          include: { comprador: { select: { nombre: true, email: true, telefono: true } } }
        });
        if (pedidoCompleto) {
          await NotificacionService.comprobanteSubido({
            pedido: pedidoCompleto,
            comprador: pedidoCompleto.comprador,
          });
        }
      } catch (e) {
        console.error("[NOTIF] Error en comprobanteSubido:", e.message);
      }
    });

    return pagoActualizado;
  },

  /**
   * Devuelve las instrucciones de pago para el comprador: a qué número Nequi /
   * Daviplata de la plataforma transferir, el monto y la referencia sugerida.
   */
  async obtenerInstruccionesPago(usuarioId, pedidoId) {
    await validarPagosManualesActivos();
    const pedido = await PedidoRepository.buscarPorId(Number(pedidoId));
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    if (pedido.compradorId !== usuarioId) {
      throw new ErrorProhibido("Este pedido no te pertenece");
    }
    if (!["PENDIENTE_PAGO", "VERIFICANDO_PAGO"].includes(pedido.estado)) {
      throw new ErrorValidacion(
        `No se pueden consultar instrucciones para un pedido en estado "${pedido.estado}"`
      );
    }

    return {
      pedidoId: pedido.id,
      monto: pedido.total,
      referenciaSugerida: `PED-${pedido.id}`,
      metodos: {
        NEQUI: process.env.PLATAFORMA_NEQUI || null,
        DAVIPLATA: process.env.PLATAFORMA_DAVIPLATA || null,
      },
      instrucciones:
        "Transfiere el monto exacto al número Nequi o Daviplata de Teravia, " +
        "usando la referencia sugerida en el mensaje. Luego sube el comprobante " +
        "para que verifiquemos tu pago.",
    };
  },
};

module.exports = PagoService;
