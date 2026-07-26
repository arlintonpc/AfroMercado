const prisma = require("../config/prisma");
const {
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorValidacion,
  ErrorConflicto,
} = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const FacturacionService = require("./facturacion.service");
const FidelizacionService = require("./fidelizacion.service");
const VisibilidadRepository = require("../repositories/visibilidad.repository");
const PagoPublicidadService = require("./pago-publicidad.service");
const { bloquearPedido } = require("../utils/bloqueos-transaccionales");
const {
  normalizarProveedor,
  obtenerProveedor,
  obtenerProveedorConfigurado,
} = require("./payments/provider-factory");

const ESTADOS_CONFIRMABLES = ["PENDIENTE", "VERIFICANDO"];
const ESTADOS_PEDIDO_PAGABLES = ["PENDIENTE_PAGO", "VERIFICANDO_PAGO"];
const ESTADOS_APROBADOS = ["APPROVED", "APROBADO", "CONFIRMED", "CONFIRMADO", "PAID", "SUCCESS", "SUCCESSFUL"];
const ESTADOS_FALLIDOS = ["DECLINED", "REJECTED", "FAILED", "FALLIDO", "ERROR", "CANCELLED", "CANCELED", "EXPIRED", "VOIDED"];
const MAX_INTENTOS_DISPERSION = 5;
const BACKOFF_DISPERSION_MINUTOS = [5, 15, 30, 60, 120];

function numero(valor) {
  return valor == null ? 0 : Number(valor);
}

function datosFalloDispersion(dispersion, mensaje, ahora = new Date()) {
  const intentos = numero(dispersion.intentosFallidos) + 1;
  const minutos = BACKOFF_DISPERSION_MINUTOS[
    Math.min(intentos - 1, BACKOFF_DISPERSION_MINUTOS.length - 1)
  ];
  return {
    estado: "FALLIDA",
    errorMensaje: mensaje,
    intentosFallidos: { increment: 1 },
    proximoReintentoAt:
      intentos >= MAX_INTENTOS_DISPERSION
        ? null
        : new Date(ahora.getTime() + minutos * 60 * 1000),
  };
}

function referenciaPago(pedido) {
  const codigo = pedido.codigo || `PED-${pedido.id}`;
  return `${codigo}-${Date.now()}`;
}

function mapearPagoDigital(pago) {
  if (!pago) return null;
  return {
    id: pago.id,
    pedidoId: pago.pedidoId,
    monto: numero(pago.monto),
    metodo: pago.metodo,
    estado: pago.estado,
    proveedor: pago.proveedor,
    moneda: pago.moneda,
    checkoutUrl: pago.providerCheckoutUrl,
    providerPaymentId: pago.providerPaymentId,
    providerReference: pago.providerReference,
    providerStatus: pago.providerStatus,
    expiraAt: pago.expiraAt,
    confirmadoAt: pago.confirmadoAt,
    dispersiones: (pago.dispersiones || []).map((d) => ({
      id: d.id,
      subPedidoId: d.subPedidoId,
      comercioId: d.comercioId,
      estado: d.estado,
      montoBruto: numero(d.montoBruto),
      comision: numero(d.comision),
      montoNeto: numero(d.montoNeto),
      providerTransferId: d.providerTransferId,
      providerStatus: d.providerStatus,
    })),
  };
}

function checkoutDigitalListo(pago) {
  return Boolean(
    pago?.providerCheckoutUrl ||
    pago?.providerPaymentId ||
    ["FALLIDO", "CONFIRMADO", "REEMBOLSADO"].includes(pago?.estado)
  );
}

async function esperarCheckoutConcurrente(idempotencyKey, pagoInicial) {
  let pago = pagoInicial;
  for (let intento = 0; intento < 20 && !checkoutDigitalListo(pago); intento += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    pago = await prisma.pago.findUnique({
      where: { idempotencyKey },
      include: { dispersiones: true },
    });
  }
  if (!checkoutDigitalListo(pago)) {
    throw new ErrorConflicto(
      "El checkout se esta creando. Intenta consultar nuevamente en unos segundos"
    );
  }
  return mapearPagoDigital(pago);
}

function obtenerMontoEventoCentavos(evento) {
  const tx = evento?.payload?.data?.transaction || evento?.payload?.transaction || evento?.payload?.data || {};
  const valor = tx.amount_in_cents ?? tx.amountInCents ?? evento?.payload?.amount_in_cents;
  if (valor == null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function validarMontoEvento(pago, evento) {
  const reportado = obtenerMontoEventoCentavos(evento);
  if (reportado == null) return;
  const esperado = Math.round(Number(pago.monto || 0) * 100);
  if (reportado !== esperado) {
    throw new ErrorValidacion(
      `La pasarela reporto un monto distinto al esperado (${reportado} vs ${esperado} centavos)`
    );
  }
}

async function cargarPedido(pedidoId, db = prisma) {
  return db.pedido.findUnique({
    where: { id: Number(pedidoId) },
    include: {
      comprador: { select: { id: true, nombre: true, email: true, telefono: true } },
      subPedidos: {
        include: {
          comercio: {
            include: {
              usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
            },
          },
          items: { include: { producto: { select: { id: true, nombre: true } } } },
        },
      },
    },
  });
}

async function obtenerCuentasDispersion(pedido, proveedorNombre) {
  const comercioIds = pedido.subPedidos.map((sp) => sp.comercioId);
  const cuentas = await prisma.cuentaDispersionComercio.findMany({
    where: { comercioId: { in: comercioIds } },
  });
  const porComercio = new Map(cuentas.map((cuenta) => [cuenta.comercioId, cuenta]));
  const faltantes = [];
  const pendientes = [];
  const proveedorDiferente = [];

  for (const subPedido of pedido.subPedidos) {
    const cuenta = porComercio.get(subPedido.comercioId);
    const comercioNombre = subPedido.comercio?.nombre || `Comercio ${subPedido.comercioId}`;
    if (!cuenta) {
      faltantes.push(comercioNombre);
      continue;
    }
    if (cuenta.estado !== "VERIFICADA" || !cuenta.providerRecipientId) {
      pendientes.push(comercioNombre);
      continue;
    }
    if (cuenta.proveedor !== proveedorNombre) {
      proveedorDiferente.push(comercioNombre);
    }
  }

  const problemas = [];
  if (faltantes.length > 0) {
    problemas.push(`sin cuenta registrada: ${faltantes.join(", ")}`);
  }
  if (pendientes.length > 0) {
    problemas.push(`con cuenta pendiente de verificacion: ${pendientes.join(", ")}`);
  }
  if (proveedorDiferente.length > 0) {
    problemas.push(`sin cuenta activa para ${proveedorNombre}: ${proveedorDiferente.join(", ")}`);
  }

  if (problemas.length > 0) {
    throw new ErrorValidacion(
      `Algunas tiendas de tu pedido aun no tienen pagos digitales activos (${problemas.join("; ")}). Puedes intentar mas tarde o comprar productos de tiendas que ya tengan cuenta de pago configurada.`
    );
  }

  return porComercio;
}

async function notificarPagoAprobado(pedidoId) {
  setImmediate(async () => {
    try {
      const pedidoCompleto = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          comprador: { select: { id: true, nombre: true, email: true, telefono: true } },
          subPedidos: {
            include: {
              comercio: {
                include: { usuario: { select: { nombre: true, email: true, telefono: true } } },
              },
              items: { include: { producto: { select: { nombre: true } } } },
            },
          },
        },
      });
      if (!pedidoCompleto) return;
      await NotificacionService.pagoAprobado({
        pedido: pedidoCompleto,
        comprador: pedidoCompleto.comprador,
        comerciantes: pedidoCompleto.subPedidos.map((sp) => sp.comercio),
      });
    } catch (e) {
      console.error("[NOTIF] Error en pago digital aprobado:", e.message);
    }
  });
}

async function liberarStockPedido(tx, pedido) {
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
}

async function confirmarPedidoPorPago(tx, pago) {
  const pedido = pago.pedido;
  const productosStockBajo = [];
  for (const sub of pedido.subPedidos) {
    for (const item of sub.items) {
      const filas = await tx.$queryRaw`
        UPDATE "Producto"
        SET "stock" = "stock" - ${item.cantidad},
            "stockReservado" = GREATEST("stockReservado" - ${item.cantidad}, 0)
        WHERE id = ${item.productoId}
          AND "stock" >= ${item.cantidad}
        RETURNING id, nombre, "comercioId", stock, "stockMinimo", "stockBajoNotificadoAt"
      `;
      if (filas.length === 0) {
        throw new ErrorValidacion(
          `Stock insuficiente para confirmar el producto #${item.productoId}`
        );
      }
      const p = filas[0];
      if (p.stockMinimo > 0 && p.stock <= p.stockMinimo && p.stockBajoNotificadoAt === null) {
        await tx.producto.update({ where: { id: p.id }, data: { stockBajoNotificadoAt: new Date() } });
        productosStockBajo.push({ id: p.id, nombre: p.nombre, comercioId: p.comercioId, stock: p.stock });
      }
    }
  }

  await tx.subPedido.updateMany({
    where: { pedidoId: pedido.id },
    data: { estado: "CONFIRMADO" },
  });

  const ventasPorComercio = {};
  for (const sub of pedido.subPedidos) {
    ventasPorComercio[sub.comercioId] = (ventasPorComercio[sub.comercioId] || 0) + 1;
  }
  for (const [comercioId, cantidad] of Object.entries(ventasPorComercio)) {
    await tx.comercio.update({
      where: { id: Number(comercioId) },
      data: { totalVentas: { increment: cantidad } },
    });
  }

  await VisibilidadRepository.atribuirPedidoConfirmado(tx, pedido);

  return productosStockBajo;
}

const PagoDigitalService = {
  async crearCheckout(usuarioId, { pedidoId, idempotencyKey }) {
    if (!idempotencyKey) throw new ErrorValidacion("El idempotencyKey es obligatorio");
    if (!pedidoId) throw new ErrorValidacion("El pedidoId es obligatorio");

    const pedido = await cargarPedido(pedidoId);
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    if (pedido.compradorId !== usuarioId) {
      throw new ErrorProhibido("Este pedido no te pertenece");
    }

    const existente = await prisma.pago.findUnique({
      where: { idempotencyKey },
      include: { dispersiones: true },
    });
    if (existente) {
      if (existente.pedidoId !== pedido.id || existente.metodo !== "PASARELA") {
        throw new ErrorConflicto(
          "La clave de idempotencia ya fue usada con una solicitud diferente"
        );
      }
      return esperarCheckoutConcurrente(idempotencyKey, existente);
    }

    if (!ESTADOS_PEDIDO_PAGABLES.includes(pedido.estado)) {
      throw new ErrorValidacion(`No se puede pagar un pedido en estado "${pedido.estado}"`);
    }
    if (pedido.expiresAt && pedido.expiresAt.getTime() < Date.now()) {
      throw new ErrorValidacion("El tiempo para pagar este pedido expiro");
    }

    const { nombre: proveedorNombre, provider: proveedor } = await obtenerProveedorConfigurado();
    const cuentasPorComercio = await obtenerCuentasDispersion(pedido, proveedorNombre);
    const referencia = referenciaPago(pedido);

    let pago;
    try {
      const resultadoCreacion = await prisma.$transaction(async (tx) => {
        await bloquearPedido(tx, pedido.id);
        const pedidoActual = await tx.pedido.findUnique({
          where: { id: pedido.id },
          select: {
            compradorId: true,
            estado: true,
            total: true,
            expiresAt: true,
          },
        });
        if (!pedidoActual) throw new ErrorNoEncontrado("Pedido no encontrado");
        if (pedidoActual.compradorId !== usuarioId) {
          throw new ErrorProhibido("Este pedido no te pertenece");
        }

        const concurrente = await tx.pago.findUnique({
          where: { idempotencyKey },
          include: { dispersiones: true },
        });
        if (concurrente) {
          if (
            concurrente.pedidoId !== pedido.id ||
            concurrente.metodo !== "PASARELA"
          ) {
            throw new ErrorConflicto(
              "La clave de idempotencia ya fue usada con una solicitud diferente"
            );
          }
          return { pago: concurrente, reutilizado: true };
        }

        if (!ESTADOS_PEDIDO_PAGABLES.includes(pedidoActual.estado)) {
          throw new ErrorValidacion(
            `No se puede pagar un pedido en estado "${pedidoActual.estado}"`
          );
        }
        if (pedidoActual.expiresAt && pedidoActual.expiresAt.getTime() < Date.now()) {
          throw new ErrorValidacion("El tiempo para pagar este pedido expiro");
        }

        const nuevoPago = await tx.pago.create({
          data: {
            pedidoId: pedido.id,
            monto: pedidoActual.total,
            metodo: "PASARELA",
            estado: "PENDIENTE",
            idempotencyKey,
            proveedor: proveedorNombre,
            moneda: "COP",
            providerReference: referencia,
            providerStatus: "CREATED",
            expiraAt: pedidoActual.expiresAt,
          },
        });

        await tx.pagoDispersion.createMany({
          data: pedido.subPedidos.map((sp) => {
            const cuenta = cuentasPorComercio.get(sp.comercioId);
            return {
              pagoId: nuevoPago.id,
              subPedidoId: sp.id,
              comercioId: sp.comercioId,
              cuentaDispersionId: cuenta.id,
              proveedor: proveedorNombre,
              estado: "PENDIENTE",
              montoBruto: sp.subtotal,
              comision: sp.comision,
              montoNeto: sp.neto,
            };
          }),
        });

        await tx.pedido.update({
          where: { id: pedido.id },
          data: { estado: "VERIFICANDO_PAGO" },
        });

        return {
          pago: await tx.pago.findUnique({
            where: { id: nuevoPago.id },
            include: { dispersiones: true },
          }),
          reutilizado: false,
        };
      });
      pago = resultadoCreacion.pago;
      if (resultadoCreacion.reutilizado) {
        return esperarCheckoutConcurrente(idempotencyKey, pago);
      }
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const concurrente = await prisma.pago.findUnique({
        where: { idempotencyKey },
        include: { dispersiones: true },
      });
      if (
        !concurrente ||
        concurrente.pedidoId !== pedido.id ||
        concurrente.metodo !== "PASARELA"
      ) {
        throw new ErrorConflicto(
          "La clave de idempotencia ya fue usada con una solicitud diferente"
        );
      }
      return esperarCheckoutConcurrente(idempotencyKey, concurrente);
    }

    try {
      const checkout = await proveedor.crearCheckout({
        pago,
        pedido,
        dispersiones: pago.dispersiones,
      });

      pago = await prisma.pago.update({
        where: { id: pago.id },
        data: {
          providerPaymentId: checkout.providerPaymentId || null,
          providerCheckoutUrl: checkout.checkoutUrl || null,
          providerStatus: checkout.providerStatus || "CREATED",
          providerPayload: checkout.payload || null,
        },
        include: { dispersiones: true },
      });
    } catch (e) {
      await prisma.$transaction(async (tx) => {
        await tx.pago.update({
          where: { id: pago.id },
          data: {
            estado: "FALLIDO",
            providerStatus: "ERROR",
            notas: e.message,
          },
        });
        await tx.pedido.updateMany({
          where: { id: pedido.id, estado: "VERIFICANDO_PAGO" },
          data: { estado: "PENDIENTE_PAGO" },
        });
        await tx.pagoDispersion.updateMany({
          where: { pagoId: pago.id },
          data: { estado: "FALLIDA", errorMensaje: e.message },
        });
      });
      throw e;
    }

    return mapearPagoDigital(pago);
  },

  async consultarPorPago(usuarioId, pagoId) {
    const pago = await prisma.pago.findUnique({
      where: { id: Number(pagoId) },
      include: { pedido: true, dispersiones: true },
    });
    if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");
    if (pago.pedido.compradorId !== usuarioId) {
      throw new ErrorProhibido("Este pago no te pertenece");
    }
    return mapearPagoDigital(pago);
  },

  async consultarPorPedido(usuarioId, pedidoId) {
    const pedidoIdNum = Number(pedidoId);
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoIdNum } });
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    if (pedido.compradorId !== usuarioId) {
      throw new ErrorProhibido("Este pedido no te pertenece");
    }
    const pago = await prisma.pago.findFirst({
      where: { pedidoId: pedidoIdNum, metodo: "PASARELA" },
      orderBy: { createdAt: "desc" },
      include: { dispersiones: true },
    });
    return mapearPagoDigital(pago);
  },

  async confirmarPago(pagoId, evento = {}) {
    const resultado = await prisma.$transaction(async (tx) => {
      const referenciaPago = await tx.pago.findUnique({
        where: { id: Number(pagoId) },
        select: { pedidoId: true },
      });
      if (!referenciaPago) throw new ErrorNoEncontrado("Pago no encontrado");

      await bloquearPedido(tx, referenciaPago.pedidoId);

      const pago = await tx.pago.findUnique({
        where: { id: Number(pagoId) },
        include: {
          pedido: {
            include: {
              comprador: { select: { id: true, nombre: true, email: true, telefono: true } },
              subPedidos: {
                include: {
                  comercio: true,
                  items: true,
                },
              },
            },
          },
        },
      });
      if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");
      if (pago.estado === "CONFIRMADO") return { pago, yaConfirmado: true };

      if (!ESTADOS_PEDIDO_PAGABLES.includes(pago.pedido.estado)) {
        const motivoConciliacion =
          `La pasarela aprobo el pago, pero el pedido esta en estado ` +
          `${pago.pedido.estado}. Requiere conciliacion y posible reembolso.`;
        const notas = pago.notas?.includes(motivoConciliacion)
          ? pago.notas
          : [pago.notas, motivoConciliacion].filter(Boolean).join("\n");
        const actualizado = await tx.pago.update({
          where: { id: pago.id },
          data: {
            estado: pago.estado === "REEMBOLSADO" ? "REEMBOLSADO" : "VERIFICANDO",
            providerStatus: evento.estado || "APPROVED",
            providerPayload: evento.payload || pago.providerPayload,
            notas,
          },
          include: { dispersiones: true },
        });
        return {
          pago: actualizado,
          yaConfirmado: false,
          requiereConciliacion: true,
          motivoConciliacion,
        };
      }

      if (!ESTADOS_CONFIRMABLES.includes(pago.estado)) {
        throw new ErrorValidacion(`Este pago no se puede confirmar desde estado ${pago.estado}`);
      }

      const productosStockBajo = await confirmarPedidoPorPago(tx, pago);

      const actualizado = await tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: "CONFIRMADO",
          providerStatus: evento.estado || "APPROVED",
          providerPayload: evento.payload || pago.providerPayload,
          confirmadoAt: new Date(),
          verificadoAt: new Date(),
          notas: evento.tipo ? `Confirmado por webhook ${evento.tipo}` : pago.notas,
        },
        include: { dispersiones: true },
      });

      await tx.pedido.update({
        where: { id: pago.pedidoId },
        data: { estado: "CONFIRMADO" },
      });

      return {
        pago: actualizado,
        yaConfirmado: false,
        subPedidoIds: pago.pedido.subPedidos.map((sp) => sp.id),
        productosStockBajo,
        compradorId: pago.pedido.compradorId,
      };
    });

    if (!resultado.yaConfirmado && !resultado.requiereConciliacion) {
      try {
        await this.ejecutarDispersiones(resultado.pago.id);
      } catch (e) {
        console.error("[PAGOS] Dispersion fallida tras pago aprobado:", e.message);
        await prisma.pago.update({
          where: { id: resultado.pago.id },
          data: {
            notas: `Pago aprobado; dispersion pendiente/fallida: ${e.message}`,
          },
        });
        if (e.requiereConciliacionDispersion) {
          NotificacionService.dispersionFallidaAdmin({
            pagoId: resultado.pago.id,
            intentos: 1,
          }).catch((errorNotificacion) =>
            console.error("[PAGOS] No se pudo alertar dispersion incierta:", errorNotificacion.message)
          );
        }
      }
      await notificarPagoAprobado(resultado.pago.pedidoId);

      for (const subPedidoId of resultado.subPedidoIds || []) {
        FacturacionService.emitirParaReferencia("PEDIDO", subPedidoId).catch((e) =>
          console.error(`[FACTURACION] emisión fallida para SubPedido #${subPedidoId}, quedará en reintento:`, e.message)
        );
      }

      for (const p of resultado.productosStockBajo || []) {
        NotificacionService.stockBajo({ comercioId: p.comercioId, producto: p }).catch((e) =>
          console.error("[STOCK-BAJO] notificar:", e.message)
        );
      }

      FidelizacionService.otorgarPuntosPorCompra(resultado.compradorId, {
        moduloOrigen: "PEDIDO",
        referenciaId: resultado.pago.pedidoId,
        subtotal: Number(resultado.pago.monto),
      }).catch((e) => console.error("[FIDELIZACION] otorgar puntos fallido:", e.message));
    }

    const pagoMapeado = mapearPagoDigital(
      await prisma.pago.findUnique({
        where: { id: resultado.pago.id },
        include: { dispersiones: true },
      })
    );
    return resultado.requiereConciliacion
      ? {
          ...pagoMapeado,
          requiereConciliacion: true,
          motivoConciliacion: resultado.motivoConciliacion,
        }
      : pagoMapeado;
  },

  async fallarPago(pagoId, motivo = "Pago rechazado por la pasarela") {
    const resultado = await prisma.$transaction(async (tx) => {
      const referenciaPago = await tx.pago.findUnique({
        where: { id: Number(pagoId) },
        select: { pedidoId: true },
      });
      if (!referenciaPago) throw new ErrorNoEncontrado("Pago no encontrado");

      await bloquearPedido(tx, referenciaPago.pedidoId);

      const pago = await tx.pago.findUnique({
        where: { id: Number(pagoId) },
        include: {
          pedido: { include: { subPedidos: { include: { items: true } } } },
        },
      });
      if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");
      if (["CONFIRMADO", "FALLIDO"].includes(pago.estado)) return pago;

      const pedidoYaLiberoStock = ["CANCELADO", "EXPIRADO", "PAGO_FALLIDO"]
        .includes(pago.pedido.estado);
      if (!pedidoYaLiberoStock && !ESTADOS_PEDIDO_PAGABLES.includes(pago.pedido.estado)) {
        throw new ErrorValidacion(
          `El fallo del pago requiere conciliacion porque el pedido esta en estado ` +
          `"${pago.pedido.estado}"`
        );
      }
      if (!pedidoYaLiberoStock) {
        await liberarStockPedido(tx, pago.pedido);
        await tx.pedido.update({
          where: { id: pago.pedidoId },
          data: { estado: "PAGO_FALLIDO" },
        });
      }
      await tx.pagoDispersion.updateMany({
        where: { pagoId: pago.id },
        data: { estado: "CANCELADA", errorMensaje: motivo },
      });
      return tx.pago.update({
        where: { id: pago.id },
        data: { estado: "FALLIDO", providerStatus: "FAILED", notas: motivo },
      });
    });
    return resultado;
  },

  async ejecutarDispersiones(pagoId) {
    const ahora = new Date();
    const leaseHasta = new Date(ahora.getTime() + 10 * 60 * 1000);
    const reclamadas = await prisma.pagoDispersion.updateMany({
      where: {
        pagoId: Number(pagoId),
        pago: { estado: "CONFIRMADO" },
        estado: { in: ["PENDIENTE", "FALLIDA"] },
        OR: [
          { proximoReintentoAt: null },
          { proximoReintentoAt: { lte: ahora } },
        ],
      },
      data: {
        proximoReintentoAt: leaseHasta,
        errorMensaje: null,
      },
    });
    if (reclamadas.count === 0) return [];

    const pago = await prisma.pago.findUnique({
      where: { id: Number(pagoId) },
      include: {
        dispersiones: {
          where: {
            estado: { in: ["PENDIENTE", "FALLIDA"] },
            proximoReintentoAt: leaseHasta,
          },
          include: { cuentaDispersion: true },
        },
      },
    });
    if (!pago || pago.dispersiones.length === 0) return [];

    const proveedor = obtenerProveedor(pago.proveedor);
    const actualizadas = [];
    const errores = [];
    let requiereConciliacion = false;

    // Cada dispersion usa su propio request. Asi un reintento parcial nunca
    // reutiliza una clave idempotente con un cuerpo de lote diferente.
    for (const dispersion of pago.dispersiones) {
      let resultados;
      try {
        resultados = await proveedor.dispersar({
          pago,
          dispersiones: [dispersion],
        });
      } catch (e) {
        const envioIncierto = e?.envioIncierto === true;
        const data = envioIncierto
          ? {
              estado: "ENVIADA",
              providerStatus: "ENVIO_INCIERTO",
              errorMensaje:
                `${e.message}. No se reintentara automaticamente para evitar un pago duplicado.`,
              intentosFallidos: { increment: 1 },
              proximoReintentoAt: null,
              enviadaAt: new Date(),
            }
          : datosFalloDispersion(dispersion, e.message);
        actualizadas.push(
          await prisma.pagoDispersion.update({
            where: { id: dispersion.id },
            data,
          })
        );
        errores.push(`dispersion #${dispersion.id}: ${data.errorMensaje}`);
        if (envioIncierto) {
          requiereConciliacion = true;
        }
        continue;
      }

      const resultado = Array.isArray(resultados)
        ? resultados.find((item) => item.id === dispersion.id)
        : null;
      if (!resultado) {
        const mensaje =
          `La pasarela no devolvio resultado para la dispersion #${dispersion.id}. ` +
          "No se reintentara automaticamente para evitar un pago duplicado.";
        actualizadas.push(
          await prisma.pagoDispersion.update({
            where: { id: dispersion.id },
            data: {
              estado: "ENVIADA",
              providerStatus: "ENVIO_INCIERTO",
              errorMensaje: mensaje,
              intentosFallidos: { increment: 1 },
              proximoReintentoAt: null,
              enviadaAt: new Date(),
            },
          })
        );
        errores.push(`dispersion #${dispersion.id}: ${mensaje}`);
        requiereConciliacion = true;
        continue;
      }

      const estado = resultado.estado || "ENVIADA";
      const data = {
        estado,
        providerTransferId: resultado.providerTransferId || null,
        providerStatus: resultado.providerStatus || estado,
        errorMensaje: resultado.errorMensaje || null,
        proximoReintentoAt: null,
        ...(estado === "PROGRAMADA" ? { programadaAt: new Date() } : {}),
        ...(estado === "ENVIADA" ? { enviadaAt: new Date() } : {}),
        ...(estado === "CONFIRMADA"
          ? { enviadaAt: new Date(), confirmadaAt: new Date() }
          : {}),
      };

      if (estado === "FALLIDA") {
        Object.assign(
          data,
          datosFalloDispersion(
            dispersion,
            resultado.errorMensaje || `La pasarela reporto ${resultado.providerStatus || estado}`
          )
        );
        errores.push(`dispersion #${dispersion.id}: ${data.errorMensaje}`);
      }

      // Si esta escritura falla despues de que la pasarela acepto el envio,
      // dejamos el lease y el contador intactos. El siguiente intento usara
      // exactamente la misma clave idempotente.
      actualizadas.push(
        await prisma.pagoDispersion.update({
          where: { id: dispersion.id },
          data,
        })
      );
    }

    if (errores.length > 0) {
      const error = new Error(`No se completaron todas las dispersiones: ${errores.join("; ")}`);
      error.requiereConciliacionDispersion = requiereConciliacion;
      error.resultados = actualizadas;
      throw error;
    }
    return actualizadas;
  },

  async procesarWebhook(proveedorParam, { body, headers, rawBody }) {
    const proveedorNombre = normalizarProveedor(proveedorParam);
    const proveedor = obtenerProveedor(proveedorNombre);
    const evento = await proveedor.interpretarWebhook({ body, headers, rawBody });

    const [pagoPorIdProveedor, pagoPorReferencia] = await Promise.all([
      evento.providerPaymentId
        ? prisma.pago.findFirst({
            where: {
              proveedor: proveedorNombre,
              providerPaymentId: evento.providerPaymentId,
            },
          })
        : null,
      evento.providerReference
        ? prisma.pago.findFirst({
            where: {
              proveedor: proveedorNombre,
              providerReference: evento.providerReference,
            },
          })
        : null,
    ]);
    let conflictoIdentificadores =
      pagoPorIdProveedor &&
      pagoPorReferencia &&
      pagoPorIdProveedor.id !== pagoPorReferencia.id
        ? "Los identificadores del webhook corresponden a pagos diferentes"
        : null;
    let pago = conflictoIdentificadores
      ? null
      : (pagoPorIdProveedor || pagoPorReferencia);

    if (
      !conflictoIdentificadores &&
      pago &&
      evento.providerPaymentId &&
      pago.providerPaymentId &&
      pago.providerPaymentId !== evento.providerPaymentId
    ) {
      conflictoIdentificadores =
        "El identificador de transaccion del webhook no coincide con el pago";
      pago = null;
    }
    if (
      !conflictoIdentificadores &&
      pago &&
      evento.providerReference &&
      pago.providerReference &&
      pago.providerReference !== evento.providerReference
    ) {
      conflictoIdentificadores =
        "La referencia del webhook no coincide con el pago";
      pago = null;
    }

    if (pago && evento.providerPaymentId && !pago.providerPaymentId) {
      try {
        pago = await prisma.pago.update({
          where: { id: pago.id },
          data: { providerPaymentId: evento.providerPaymentId },
          include: { dispersiones: true },
        });
      } catch (e) {
        if (e?.code !== "P2002") throw e;
        conflictoIdentificadores =
          "El identificador de la pasarela ya pertenece a otro pago";
        pago = null;
      }
    }

    let eventoDb;
    try {
      eventoDb = await prisma.pagoEvento.create({
        data: {
          pagoId: pago?.id || null,
          proveedor: proveedorNombre,
          eventoId: evento.eventoId || null,
          tipo: evento.tipo || "payment.event",
          estado: evento.estado || null,
          payload: evento.payload || body || {},
          firma: evento.firma || null,
          procesado: false,
        },
      });
    } catch (e) {
      if (e?.code === "P2002") {
        const existente = evento.eventoId
          ? await prisma.pagoEvento.findUnique({
              where: {
                proveedor_eventoId: {
                  proveedor: proveedorNombre,
                  eventoId: evento.eventoId,
                },
              },
            })
          : null;
        if (!existente || existente.procesado) {
          return { ok: true, duplicado: true };
        }
        eventoDb = existente;
      } else {
        throw e;
      }
    }

    if (conflictoIdentificadores) {
      await prisma.pagoEvento.update({
        where: { id: eventoDb.id },
        data: {
          procesado: true,
          processedAt: new Date(),
          errorMensaje: conflictoIdentificadores,
        },
      });
      return {
        ok: false,
        recibido: true,
        procesado: true,
        error: conflictoIdentificadores,
      };
    }

    if (!pago) {
      // Early-return para pagos de reservas de hotel (referencia HOTEL-...)
      if (evento.providerReference && String(evento.providerReference).startsWith("HOTEL-")) {
        const HotelService = require("./hotel.service");
        try {
          await HotelService.confirmarPagoHotel(evento.providerReference, evento.estado);
          await prisma.pagoEvento.update({
            where: { id: eventoDb.id },
            data: { procesado: true, processedAt: new Date() },
          });
        } catch (e) {
          await prisma.pagoEvento.update({
            where: { id: eventoDb.id },
            data: { errorMensaje: e.message },
          });
        }
        return { ok: true, recibido: true, procesado: true, recurso: "HOTEL" };
      }

      let solicitudPublicidad = null;
      try {
        solicitudPublicidad = await PagoPublicidadService.procesarWebhook(proveedorNombre, evento);
      } catch (e) {
        await prisma.pagoEvento.update({
          where: { id: eventoDb.id },
          data: { errorMensaje: e.message },
        });
        throw e;
      }
      if (solicitudPublicidad) {
        await prisma.pagoEvento.update({
          where: { id: eventoDb.id },
          data: { procesado: true, processedAt: new Date() },
        });
        return {
          ok: true,
          recibido: true,
          procesado: true,
          recurso: "PUBLICIDAD",
          solicitudPublicidadId: solicitudPublicidad.id,
        };
      }

      await prisma.pagoEvento.update({
        where: { id: eventoDb.id },
        data: { errorMensaje: "Pago no encontrado para el evento" },
      });
      return { ok: false, recibido: true, error: "Pago no encontrado" };
    }

    const estado = String(evento.estado || "").trim().toUpperCase();
    let conciliacion = null;
    try {
      if (ESTADOS_APROBADOS.includes(estado)) {
        validarMontoEvento(pago, evento);
        const confirmacion = await this.confirmarPago(pago.id, evento);
        if (confirmacion.requiereConciliacion) {
          conciliacion = confirmacion.motivoConciliacion;
        }
      } else if (ESTADOS_FALLIDOS.includes(estado)) {
        await this.fallarPago(pago.id, `Pasarela reporto estado ${estado}`);
      } else {
        await prisma.pago.update({
          where: { id: pago.id },
          data: { providerStatus: estado || "PENDING", providerPayload: evento.payload || body || {} },
        });
      }

      await prisma.pagoEvento.update({
        where: { id: eventoDb.id },
        data: {
          procesado: true,
          processedAt: new Date(),
          errorMensaje: conciliacion || null,
        },
      });
      return {
        ok: true,
        recibido: true,
        procesado: true,
        ...(conciliacion ? { requiereConciliacion: true } : {}),
      };
    } catch (e) {
      await prisma.pagoEvento.update({
        where: { id: eventoDb.id },
        data: { errorMensaje: e.message },
      });
      throw e;
    }
  },
};

module.exports = PagoDigitalService;
