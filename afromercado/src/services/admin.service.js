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
const VisibilidadRepository = require("../repositories/visibilidad.repository");

const ACCIONES_VALIDAS = ["APROBAR", "RECHAZAR"];

function tieneDocumentoIdentidadCompleto(comercio) {
  return Boolean(
    (comercio.fotoDocumentoFrenteUrl || comercio.fotoDocumentoUrl) &&
    comercio.fotoDocumentoReversoUrl
  );
}

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

        await VisibilidadRepository.atribuirPedidoConfirmado(tx, pedido);

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
    if ((accion === "APROBAR" || accion === "REHABILITAR") && !tieneDocumentoIdentidadCompleto(comercio)) {
      throw new ErrorValidacion("No se puede aprobar el comercio sin frente y reverso del documento de identidad.");
    }

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
      include: {
        usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
        cambiosCriticos: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    // Log de moderación
    if (!estaActivo) {
      await prisma.producto.updateMany({
        where: { comercioId, activo: true },
        data: { activo: false },
      });
    }

    await prisma.accionModeracion.create({
      data: { adminId, targetId: comercioId, targetTipo: "COMERCIO", accion, motivo: motivo?.trim() || null },
    });

    await prisma.cambioCriticoComercio.updateMany({
      where: { comercioId, estado: "PENDIENTE" },
      data: {
        estado: accion === "APROBAR" || accion === "REHABILITAR"
          ? "APROBADO"
          : accion === "SUSPENDER"
            ? "SUSPENDIDO"
            : "RECHAZADO",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        motivo: motivo?.trim() || null,
      },
    });

    const actualizadoFinal = await prisma.comercio.findUnique({
      where: { id: comercioId },
      include: {
        usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
        cambiosCriticos: { orderBy: { createdAt: "desc" }, take: 5 },
      },
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

    return actualizadoFinal || actualizado;
  },

  // Aprobar/rechazar una declaración de organización territorial pendiente
  // (Módulo D institucional). A diferencia de verificarComerciante, esto NO
  // toca estadoRegistro/verificado/activo del comercio — declarar una
  // organización territorial no es señal de riesgo de fraude de pagos, así
  // que nunca pausa la tienda. Solo al APROBAR se copian los datos del
  // snapshot a los campos reales de Comercio.
  async revisarDeclaracionTerritorial(adminId, comercioId, { accion, motivo } = {}) {
    if (!ACCIONES_VALIDAS.includes(accion)) {
      throw new ErrorValidacion(`Acción inválida. Opciones: ${ACCIONES_VALIDAS.join(", ")}`);
    }

    const pendiente = await prisma.cambioCriticoComercio.findFirst({
      where: { comercioId, tipo: "DECLARACION_TERRITORIAL", estado: "PENDIENTE" },
      orderBy: { createdAt: "desc" },
    });
    if (!pendiente) {
      throw new ErrorNoEncontrado("No hay una declaración territorial pendiente de revisión para este comercio.");
    }

    const snapshot = pendiente.snapshotNuevo || {};
    const datosComercio = accion === "APROBAR"
      ? {
          organizacionTerritorialTipo: snapshot.tipo,
          organizacionTerritorialNombre: snapshot.nombreOrganizacion,
          organizacionTerritorialFecha: new Date(),
        }
      : {};

    const [comercio] = await prisma.$transaction([
      prisma.comercio.update({
        where: { id: comercioId },
        data: datosComercio,
        include: {
          usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
          cambiosCriticos: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      }),
      prisma.cambioCriticoComercio.update({
        where: { id: pendiente.id },
        data: {
          estado: accion === "APROBAR" ? "APROBADO" : "RECHAZADO",
          revisadoPor: adminId,
          revisadoAt: new Date(),
          motivo: motivo?.trim() || null,
        },
      }),
      prisma.accionModeracion.create({
        data: {
          adminId,
          targetId: comercioId,
          targetTipo: "COMERCIO",
          accion: `${accion}_DECLARACION_TERRITORIAL`,
          motivo: motivo?.trim() || null,
        },
      }),
    ]);

    setImmediate(async () => {
      try {
        if (comercio.usuario?.id) {
          await NotificacionService.crearYEnviar({
            usuarioId: comercio.usuario.id,
            tipo: accion === "APROBAR" ? "DECLARACION_TERRITORIAL_APROBADA" : "DECLARACION_TERRITORIAL_RECHAZADA",
            titulo: accion === "APROBAR" ? "Declaración territorial aprobada" : "Declaración territorial rechazada",
            mensaje: accion === "APROBAR"
              ? "Tu declaración de organización territorial fue aprobada."
              : (motivo?.trim() || "El equipo revisó tu declaración territorial y no fue aprobada."),
          });
        }
      } catch (e) {
        console.error("[NOTIF] revisarDeclaracionTerritorial:", e.message);
      }
    });

    return comercio;
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
        cambiosCriticos: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
  },

  // ── Métodos para el panel de administración ───────────────────

  /**
   * Resumen de métricas para el dashboard del panel admin.
   * Nota: Comercio y Usuario usan createdAt; reservas usan creadoAt.
   * Categoria no tiene campo "orden" ni "descripcion" en el schema actual.
   * Producto no tiene campo "destacado" en el schema actual.
   */
  async dashboard() {
    const [
      totalComercios,
      comerciosActivos,
      totalUsuarios,
      totalProductos,
    ] = await Promise.all([
      prisma.comercio.count(),
      prisma.comercio.count({ where: { activo: true } }),
      prisma.usuario.count(),
      prisma.producto.count({ where: { activo: true, deletedAt: null } }),
    ]);

    // Reservas del mes actual (cada módulo usa "creadoAt")
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [reservasTour, reservasHotel, reservasTransporte, pedidosExpress] = await Promise.all([
      prisma.reservaTour.count({ where: { creadoAt: { gte: inicioMes } } }),
      prisma.reservaHotel.count({ where: { creadoAt: { gte: inicioMes } } }),
      prisma.reservaTransporte.count({ where: { creadoAt: { gte: inicioMes } } }),
      prisma.pedidoExpress.count({ where: { creadoAt: { gte: inicioMes } } }),
    ]);

    // Comercios nuevos por semana (últimas 4 semanas) — Comercio usa createdAt
    const comerciosPorSemana = await prisma.$queryRaw`
      SELECT DATE_TRUNC('week', "createdAt") as semana, COUNT(*)::int as total
      FROM "Comercio"
      WHERE "createdAt" >= NOW() - INTERVAL '28 days'
      GROUP BY semana ORDER BY semana
    `;

    // Alertas: comercios activos sin productos activos
    const comerciosSinProductos = await prisma.comercio.count({
      where: { activo: true, productos: { none: { activo: true, deletedAt: null } } },
    });

    return {
      totalComercios,
      comerciosActivos,
      totalUsuarios,
      totalProductos,
      reservasMes: reservasTour + reservasHotel + reservasTransporte + pedidosExpress,
      pedidosExpress,
      comerciosPorSemana,
      alertas: { comerciosSinProductos },
    };
  },

  /**
   * Detalle completo de un comercio para el panel admin.
   */
  async detalleComercio(id) {
    return prisma.comercio.findUniqueOrThrow({
      where: { id },
      include: {
        usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
        _count: { select: { productos: true } },
        configHotel: { select: { id: true, nombre: true, activo: true } },
        configTour: { select: { id: true, nombre: true, activo: true } },
        configExpress: { select: { id: true, activo: true } },
        configTransporte: { select: { id: true, nombre: true, activo: true } },
        comisiones: {
          where: { OR: [{ hasta: null }, { hasta: { gt: new Date() } }] },
          orderBy: { desde: "desc" },
          take: 1,
        },
      },
    });
  },

  /**
   * Activa o desactiva un comercio directamente (sin flujo de verificación).
   * Para el flujo de verificación formal usa verificarComerciante().
   */
  async cambiarEstadoComercio(id, activo, motivo) {
    return prisma.comercio.update({
      where: { id },
      data: { activo: Boolean(activo) },
      select: { id: true, nombre: true, activo: true },
    });
  },

  /**
   * Cambia el rol de un usuario.
   * Roles válidos según el enum Rol del schema: COMPRADOR, COMERCIANTE, REPARTIDOR, ADMIN.
   */
  async cambiarRol(id, rol) {
    const rolesValidos = ["COMPRADOR", "COMERCIANTE", "REPARTIDOR", "ADMIN"];
    if (!rolesValidos.includes(rol)) throw new ErrorValidacion("Rol inválido. Opciones: " + rolesValidos.join(", "));
    return prisma.usuario.update({
      where: { id },
      data: { rol },
      select: { id: true, nombre: true, email: true, rol: true },
    });
  },

  /**
   * Elimina una categoría. Lanzará error de Prisma si tiene productos asociados.
   * La categoría solo tiene: id, nombre, slug, icono, activa (no tiene "orden" ni "descripcion").
   */
  async eliminarCategoria(id) {
    return prisma.categoria.delete({ where: { id } });
  },

  /**
   * "Destacar" un producto.
   * NOTA: el schema actual de Producto NO tiene campo "destacado".
   * Este método lanza un error informativo para que el frontend sepa
   * que la funcionalidad requiere una migración de schema.
   * Cuando se agregue `destacado Boolean @default(false)` a Producto,
   * reemplazar el body por: return prisma.producto.update({ where: { id }, data: { destacado } });
   */
  async destacarProducto(id, destacado) {
    throw new ErrorValidacion(
      "El campo 'destacado' no existe en el schema actual. Agrega `destacado Boolean @default(false)` al modelo Producto y ejecuta la migración correspondiente."
    );
  },
};

module.exports = AdminService;
