// ============================================================
//  Servicio de Administración — verificación de pagos y métricas
// ============================================================
const prisma = require("../config/prisma");
const PagoRepository = require("../repositories/pago.repository");
const PedidoRepository = require("../repositories/pedido.repository");
const {
  ErrorValidacion,
  ErrorNoEncontrado,
} = require("../utils/errores");
const NotificacionService = require("./notificacion.service");

const ACCIONES_VALIDAS = ["APROBAR", "RECHAZAR"];

const AdminService = {
  /**
   * Lista los pagos a la espera de verificación (estado VERIFICANDO).
   */
  async listarPagosPendientes() {
    return PagoRepository.listarPendientes();
  },

  /**
   * Verifica un pago: lo aprueba o lo rechaza.
   *
   * APROBAR:
   *   - Pago -> CONFIRMADO (verificadoPor, verificadoAt)
   *   - Pedido -> CONFIRMADO
   *   - Descontar stock real y liberar stockReservado de todos los items (atómico)
   *   - Los SubPedidos ya se crean en el checkout: aquí solo se confirman
   *   - Incrementar totalVentas de cada comercio (un SubPedido = una venta)
   *
   * RECHAZAR:
   *   - Pago -> FALLIDO
   *   - Pedido -> PAGO_FALLIDO
   *   - Liberar stockReservado
   *   - Guardar notas
   */
  async verificarPago(adminId, pagoId, { accion, notas }) {
    if (!accion || !ACCIONES_VALIDAS.includes(accion)) {
      throw new ErrorValidacion(
        `Acción inválida. Opciones: ${ACCIONES_VALIDAS.join(", ")}`
      );
    }

    const pago = await PagoRepository.buscarPorId(Number(pagoId));
    if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");

    // El pago debe estar en un estado revisable.
    if (!["VERIFICANDO", "PENDIENTE"].includes(pago.estado)) {
      throw new ErrorValidacion(
        `Este pago ya fue procesado (estado actual: ${pago.estado})`
      );
    }

    // Cargamos el pedido con sus subPedidos e items para conocer cantidades.
    const pedido = await PedidoRepository.buscarPorId(pago.pedidoId);
    if (!pedido) throw new ErrorNoEncontrado("Pedido asociado no encontrado");

    if (accion === "APROBAR") {
      const resultadoAprobar = await prisma.$transaction(async (tx) => {
        // 1. Descontar stock real y liberar el reservado de cada item, de forma
        //    atómica. Cada item pertenece a un subPedido del pedido.
        for (const sub of pedido.subPedidos) {
          for (const item of sub.items) {
            const result = await tx.$executeRaw`
              UPDATE "Producto"
              SET "stock" = "stock" - ${item.cantidad},
                  "stockReservado" = GREATEST("stockReservado" - ${item.cantidad}, 0)
              WHERE id = ${item.productoId}
                AND "stock" >= ${item.cantidad}
            `;
            if (result === 0) {
              throw new ErrorValidacion(
                `Stock insuficiente para confirmar el producto #${item.productoId}`
              );
            }
          }
        }

        // 2. Confirmar SubPedidos existentes (no se duplican: ya vienen del checkout).
        await tx.subPedido.updateMany({
          where: { pedidoId: pedido.id },
          data: { estado: "CONFIRMADO" },
        });

        // 3. Incrementar totalVentas de cada comercio (un SubPedido = una venta).
        const ventasPorComercio = {};
        for (const sub of pedido.subPedidos) {
          ventasPorComercio[sub.comercioId] =
            (ventasPorComercio[sub.comercioId] || 0) + 1;
        }
        for (const [comercioId, cantidad] of Object.entries(ventasPorComercio)) {
          await tx.comercio.update({
            where: { id: Number(comercioId) },
            data: { totalVentas: { increment: cantidad } },
          });
        }

        // 4. Confirmar el pago.
        const pagoActualizado = await PagoRepository.actualizar(
          pago.id,
          {
            estado: "CONFIRMADO",
            verificadoPor: adminId,
            verificadoAt: new Date(),
            notas: notas || null,
          },
          tx
        );

        // 5. Confirmar el pedido.
        await PedidoRepository.actualizarEstado(pedido.id, "CONFIRMADO", tx);

        return {
          accion: "APROBAR",
          pago: pagoActualizado,
          mensaje: "Pago aprobado, pedido confirmado y stock descontado",
        };
      });

      // Notificar fuera de la transacción
      const pedidoId = pedido.id;
      setImmediate(async () => {
        try {
          const pedidoCompleto = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            include: {
              comprador: { select: { id: true, nombre: true, email: true, telefono: true } },
              subPedidos: {
                include: {
                  comercio: {
                    include: { usuario: { select: { nombre: true, email: true, telefono: true } } }
                  },
                  items: { include: { producto: { select: { nombre: true } } } }
                }
              }
            }
          });
          if (pedidoCompleto) {
            await NotificacionService.pagoAprobado({
              pedido: pedidoCompleto,
              comprador: pedidoCompleto.comprador,
              comerciantes: pedidoCompleto.subPedidos.map(sp => sp.comercio),
            });
          }
        } catch (e) {
          console.error("[NOTIF] Error en pagoAprobado:", e.message);
        }
      });

      return resultadoAprobar;
    }

    // accion === "RECHAZAR"
    const resultadoRechazar = await prisma.$transaction(async (tx) => {
      // Liberar el stock reservado de cada item.
      for (const sub of pedido.subPedidos) {
        for (const item of sub.items) {
          await tx.$executeRaw`
            UPDATE "Producto"
            SET "stockReservado" = GREATEST("stockReservado" - ${item.cantidad}, 0)
            WHERE id = ${item.productoId}
          `;
          if (item.ofertaId) {
            await tx.$executeRaw`
              UPDATE "Oferta"
              SET "stockUsado" = GREATEST("stockUsado" - ${item.cantidad}, 0)
              WHERE id = ${item.ofertaId}
            `;
          }
        }
      }

      const pagoActualizado = await PagoRepository.actualizar(
        pago.id,
        {
          estado: "FALLIDO",
          verificadoPor: adminId,
          verificadoAt: new Date(),
          notas: notas || null,
        },
        tx
      );

      await PedidoRepository.actualizarEstado(pedido.id, "PAGO_FALLIDO", tx);

      return {
        accion: "RECHAZAR",
        pago: pagoActualizado,
        mensaje: "Pago rechazado y stock liberado",
      };
    });

    // Notificar fuera de la transacción
    const pedidoIdRechazado = pedido.id;
    setImmediate(async () => {
      try {
        const pedidoCompleto = await prisma.pedido.findUnique({
          where: { id: pedidoIdRechazado },
          include: { comprador: { select: { nombre: true, email: true, telefono: true } } }
        });
        if (pedidoCompleto) {
          await NotificacionService.pagoRechazado({
            pedido: pedidoCompleto,
            comprador: pedidoCompleto.comprador,
            motivo: notas || null,
          });
        }
      } catch (e) {
        console.error("[NOTIF] Error en pagoRechazado:", e.message);
      }
    });

    return resultadoRechazar;
  },

  /**
   * Métricas globales del marketplace.
   */
  async estadisticas() {
    const [
      totalPedidos,
      pedidosPendientesPago,
      pagosPorVerificar,
      totalComercios,
      totalProductos,
      ventas,
    ] = await Promise.all([
      prisma.pedido.count(),
      prisma.pedido.count({ where: { estado: "PENDIENTE_PAGO" } }),
      prisma.pago.count({ where: { estado: "VERIFICANDO" } }),
      prisma.comercio.count(),
      prisma.producto.count({ where: { deletedAt: null } }),
      prisma.pedido.aggregate({
        _sum: { total: true },
        where: { estado: { in: ["CONFIRMADO", "ENTREGADO"] } },
      }),
    ]);

    return {
      totalPedidos,
      pedidosPendientesPago,
      pagosPorVerificar,
      totalComercios,
      totalProductos,
      ventasConfirmadas: Number(ventas._sum.total || 0),
    };
  },

  async listarComercios({ soloSinVerificar = false } = {}) {
    return prisma.comercio.findMany({
      where: soloSinVerificar ? { verificado: false, activo: true } : { activo: true },
      orderBy: [{ verificado: "asc" }, { createdAt: "desc" }],
      include: {
        usuario: { select: { nombre: true, email: true, telefono: true } },
        _count: { select: { productos: true } },
      },
    });
  },

  async verificarComerciante(adminId, comercioId, { accion, motivo }) {
    const ACCIONES = ["APROBAR", "RECHAZAR", "SUSPENDER", "REHABILITAR"];
    if (!ACCIONES.includes(accion)) {
      throw new ErrorValidacion(`Acción inválida. Opciones: ${ACCIONES.join(", ")}`);
    }
    const comercio = await prisma.comercio.findUnique({ where: { id: comercioId } });
    if (!comercio) throw new ErrorNoEncontrado("Comercio no encontrado");

    const ESTADO_MAP = {
      APROBAR:     "APROBADO",
      RECHAZAR:    "RECHAZADO",
      SUSPENDER:   "SUSPENDIDO",
      REHABILITAR: "APROBADO",
    };
    const nuevoEstado = ESTADO_MAP[accion];
    const estaActivo  = nuevoEstado === "APROBADO";

    const actualizado = await prisma.comercio.update({
      where: { id: comercioId },
      data: {
        estadoRegistro: nuevoEstado,
        verificado:     estaActivo,
        activo:         estaActivo,
        motivoRechazo:  accion === "RECHAZAR" || accion === "SUSPENDER" ? (motivo?.trim() || null) : null,
        revisadoPor:    adminId,
        revisadoAt:     new Date(),
      },
      include: { usuario: { select: { id: true, nombre: true, email: true, telefono: true } } },
    });

    // Log de moderación
    await prisma.accionModeracion.create({
      data: { adminId, targetId: comercioId, targetTipo: "COMERCIO", accion, motivo: motivo?.trim() || null },
    });

    // Notificar al comerciante
    setImmediate(async () => {
      try {
        if (accion === "APROBAR" && actualizado.usuario?.id) {
          await NotificacionService.comercioVerificado({ comercio: actualizado, usuario: actualizado.usuario });
        }
        if ((accion === "RECHAZAR" || accion === "SUSPENDER") && actualizado.usuario?.id) {
          await NotificacionService.crearYEnviar({
            usuarioId: actualizado.usuario.id,
            tipo: accion === "RECHAZAR" ? "COMERCIO_RECHAZADO" : "COMERCIO_SUSPENDIDO",
            titulo: accion === "RECHAZAR" ? "Solicitud de comercio rechazada" : "Comercio suspendido",
            mensaje: motivo?.trim() || "El administrador revisó tu solicitud.",
          });
        }
      } catch (e) {
        console.error("[NOTIF] verificarComerciante:", e.message);
      }
    });

    return actualizado;
  },

  async listarComerciosAdmin({ soloSinVerificar = false, estado = null } = {}) {
    const where = {};
    if (estado) {
      where.estadoRegistro = estado;
    } else if (soloSinVerificar) {
      where.estadoRegistro = "PENDIENTE_REVISION";
    }
    return prisma.comercio.findMany({
      where,
      orderBy: [{ estadoRegistro: "asc" }, { createdAt: "desc" }],
      include: {
        usuario: { select: { id: true, nombre: true, email: true, telefono: true, tipoDocumento: true, numeroDocumento: true, createdAt: true } },
        _count: { select: { productos: true } },
        comisiones: { where: { OR: [{ hasta: null }, { hasta: { gt: new Date() } }] }, orderBy: { desde: "desc" }, take: 1 },
      },
    });
  },
};

module.exports = AdminService;
