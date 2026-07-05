const prisma = require("../config/prisma");
const { ErrorNoEncontrado, ErrorValidacion } = require("../utils/errores");
const {
  obtenerConfiguracionPago,
  calcularPagoEntrega,
} = require("../services/pago-repartidor.service");

function formatPeriodo(desde, hasta) {
  const d = new Date(desde).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const h = new Date(hasta).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `${d} – ${h}`;
}

function fechaPeriodo(valor, finDelDia = false) {
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return new Date(`${texto}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}-05:00`);
  }
  return new Date(valor);
}

const LiquidacionController = {
  // GET /admin/liquidaciones?tipo=&estado=&pagina=
  async listar(req, res, next) {
    try {
      const { tipo, estado, pagina = 1 } = req.query;
      const paginaNumero = Number(pagina);
      if (!Number.isInteger(paginaNumero) || paginaNumero < 1) {
        throw new ErrorValidacion("pagina debe ser un entero mayor o igual a 1");
      }
      const where = {};
      if (tipo   && ["COMERCIANTE", "REPARTIDOR"].includes(tipo))   where.tipo   = tipo;
      if (estado && ["PENDIENTE", "PAGADA", "CANCELADA"].includes(estado)) where.estado = estado;

      const [items, total] = await Promise.all([
        prisma.liquidacion.findMany({
          where,
          include: {
            beneficiario: {
              select: {
                id: true, nombre: true, email: true, telefono: true,
                comercio: { select: { nombre: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          skip: (paginaNumero - 1) * 20,
        }),
        prisma.liquidacion.count({ where }),
      ]);

      res.json({
        ok: true,
        data: {
          items,
          total,
          paginas: Math.ceil(total / 20),
          pagina: paginaNumero,
        },
      });
    } catch (e) { next(e); }
  },

  // GET /admin/liquidaciones/resumen — saldos pendientes por comerciante/repartidor
  async resumen(req, res, next) {
    try {
      const [
        comercios,
        subPedidosEntregados,
        liquidacionesComerciantes,
        repartidores,
        entregasEntregadas,
        liquidacionesRepartidores,
        configuracionPago,
      ] = await Promise.all([
        prisma.comercio.findMany({
          include: {
            usuario: {
              select: { id: true, nombre: true, email: true, telefono: true },
            },
          },
        }),
        prisma.subPedido.groupBy({
          by: ["comercioId"],
          where: { estado: "ENTREGADO" },
          _sum: { neto: true },
        }),
        prisma.liquidacion.groupBy({
          by: ["beneficiarioId"],
          where: { tipo: "COMERCIANTE", estado: { in: ["PENDIENTE", "PAGADA"] } },
          _sum: { monto: true },
        }),
        prisma.usuario.findMany({
          where: { rol: "REPARTIDOR" },
          select: { id: true, nombre: true, email: true, telefono: true },
        }),
        prisma.entrega.findMany({
          where: { estado: "ENTREGADA", repartidorId: { not: null } },
          select: {
            repartidorId: true,
            pagoRepartidor: true,
            subPedido: {
              select: {
                pedido: {
                  select: {
                    costoEnvio: true,
                    _count: { select: { subPedidos: true } },
                  },
                },
              },
            },
          },
        }),
        prisma.liquidacion.groupBy({
          by: ["beneficiarioId"],
          where: { tipo: "REPARTIDOR", estado: { in: ["PENDIENTE", "PAGADA"] } },
          _sum: { monto: true },
        }),
        obtenerConfiguracionPago(),
      ]);

      const ganadoPorComercio = new Map(
        subPedidosEntregados.map((row) => [row.comercioId, Number(row._sum.neto || 0)]),
      );
      const liquidadoPorComercio = new Map(
        liquidacionesComerciantes.map((row) => [row.beneficiarioId, Number(row._sum.monto || 0)]),
      );
      const pagosPorRepartidor = new Map();
      for (const entrega of entregasEntregadas) {
        if (entrega.repartidorId === null) continue;
        const acumulado = pagosPorRepartidor.get(entrega.repartidorId) || {
          totalEntregas: 0,
          totalGanado: 0,
        };
        acumulado.totalEntregas += 1;
        acumulado.totalGanado += calcularPagoEntrega(
          entrega,
          configuracionPago.modo,
          configuracionPago.valor,
        );
        pagosPorRepartidor.set(entrega.repartidorId, acumulado);
      }
      const liquidadoPorRepartidor = new Map(
        liquidacionesRepartidores.map((row) => [row.beneficiarioId, Number(row._sum.monto || 0)]),
      );

      const comerciantes = comercios.reduce((acc, comercio) => {
        const totalGanado = ganadoPorComercio.get(comercio.id) || 0;
        const totalLiquidado = liquidadoPorComercio.get(comercio.usuarioId) || 0;
        const pendiente = totalGanado - totalLiquidado;
        if (pendiente > 0) {
          acc.push({
            usuario: {
              id: comercio.usuario.id,
              nombre: comercio.usuario.nombre,
              email: comercio.usuario.email,
            },
            tipo: "COMERCIANTE",
            pendiente,
            comercioNombre: comercio.nombre,
            dueno: comercio.usuario.nombre,
            telefono: comercio.usuario.telefono,
            totalGanado,
            totalLiquidado,
          });
        }
        return acc;
      }, []);
      comerciantes.sort((a, b) => b.pendiente - a.pendiente);

      const repartidoresPendientes = repartidores.reduce((acc, repartidor) => {
        const pago = pagosPorRepartidor.get(repartidor.id) || {
          totalEntregas: 0,
          totalGanado: 0,
        };
        const { totalEntregas, totalGanado } = pago;
        const totalLiquidado = liquidadoPorRepartidor.get(repartidor.id) || 0;
        const pendiente = totalGanado - totalLiquidado;
        if (pendiente > 0) {
          acc.push({
            usuario: {
              id: repartidor.id,
              nombre: repartidor.nombre,
              email: repartidor.email,
            },
            tipo: "REPARTIDOR",
            pendiente,
            nombre: repartidor.nombre,
            telefono: repartidor.telefono,
            totalEntregas,
            totalGanado,
            totalLiquidado,
          });
        }
        return acc;
      }, []);
      repartidoresPendientes.sort((a, b) => b.pendiente - a.pendiente);

      const resumen = [
        ...comerciantes.map((c) => ({
          usuario: c.usuario,
          tipo: c.tipo,
          pendiente: c.pendiente,
          comercioNombre: c.comercioNombre,
        })),
        ...repartidoresPendientes.map((r) => ({
          usuario: r.usuario,
          tipo: r.tipo,
          pendiente: r.pendiente,
          totalEntregas: r.totalEntregas,
        })),
      ].sort((a, b) => b.pendiente - a.pendiente);

      res.json({
        ok: true,
        data: resumen,
        meta: {
          comerciantes,
          repartidores: repartidoresPendientes,
          tarifaEntrega: configuracionPago.modo === "fijo" ? configuracionPago.valor : null,
          pagoRepartidor: configuracionPago,
        },
      });
    } catch (e) { next(e); }
  },

  // POST /admin/liquidaciones
  async crear(req, res, next) {
    try {
      const { tipo, beneficiarioId, periodoDesde, periodoHasta, cuentaDestino, notas } = req.body;

      if (!["COMERCIANTE", "REPARTIDOR"].includes(tipo))
        throw new ErrorValidacion("tipo debe ser COMERCIANTE o REPARTIDOR");
      if (!beneficiarioId) throw new ErrorValidacion("beneficiarioId es requerido");
      if (!periodoDesde || !periodoHasta) throw new ErrorValidacion("periodoDesde y periodoHasta son requeridos");

      const desde = fechaPeriodo(periodoDesde);
      const hasta = fechaPeriodo(periodoHasta, true);
      if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde) {
        throw new ErrorValidacion("periodoHasta debe ser posterior a periodoDesde");
      }

      const beneficiarioNumero = Number(beneficiarioId);
      if (!Number.isInteger(beneficiarioNumero) || beneficiarioNumero < 1) {
        throw new ErrorValidacion("beneficiarioId debe ser un entero válido");
      }

      const configuracionPago = tipo === "REPARTIDOR"
        ? await obtenerConfiguracionPago()
        : null;

      const liq = await prisma.$transaction(async (tx) => {
        const existente = await tx.liquidacion.findFirst({
          where: {
            beneficiarioId: beneficiarioNumero,
            tipo,
            estado: { in: ["PENDIENTE", "PAGADA"] },
            periodoDesde: { lte: hasta },
            periodoHasta: { gte: desde },
          },
          select: { id: true },
        });
        if (existente) {
          throw new ErrorValidacion("Ya existe una liquidación que cubre total o parcialmente ese período");
        }

        let monto = 0;
        let disputasAplicadas = [];
        if (tipo === "COMERCIANTE") {
          const comercio = await tx.comercio.findUnique({
            where: { usuarioId: beneficiarioNumero },
            select: { id: true },
          });
          if (!comercio) throw new ErrorValidacion("El usuario no tiene comercio registrado");

          const ganado = await tx.subPedido.aggregate({
            _sum: { neto: true },
            where: {
              comercioId: comercio.id,
              estado: "ENTREGADO",
              updatedAt: { gte: desde, lte: hasta },
            },
          });
          const bruto = Number(ganado._sum.neto || 0);

          // Reembolsos de disputas ya aprobados y aún no descontados de ninguna
          // liquidación: se consumen en orden FIFO (más antiguo primero) hasta
          // agotar lo ganado en el período. Nunca se crea una liquidación con
          // monto negativo — lo que no alcance a cubrirse queda pendiente
          // (notaCreditoAplicada sigue en false) para la siguiente ronda.
          const reembolsosPendientes = await tx.disputa.findMany({
            where: {
              comercioId: comercio.id,
              estado: { in: ["RESUELTA_REEMBOLSO_TOTAL", "RESUELTA_REEMBOLSO_PARCIAL"] },
              notaCreditoAplicada: false,
            },
            orderBy: { resueltoAt: "asc" },
            select: { id: true, montoDescuentoComercio: true },
          });

          let disponible = bruto;
          for (const d of reembolsosPendientes) {
            const descuento = Number(d.montoDescuentoComercio || 0);
            if (descuento > disponible) break; // FIFO estricto: no saltar al siguiente si el actual no alcanza
            disponible -= descuento;
            disputasAplicadas.push(d.id);
          }
          monto = disponible;
        } else {
          const entregas = await tx.entrega.findMany({
            where: {
              repartidorId: beneficiarioNumero,
              estado: "ENTREGADA",
              updatedAt: { gte: desde, lte: hasta },
            },
            select: {
              pagoRepartidor: true,
              subPedido: {
                select: {
                  pedido: {
                    select: {
                      costoEnvio: true,
                      _count: { select: { subPedidos: true } },
                    },
                  },
                },
              },
            },
          });
          monto = entregas.reduce(
            (total, entrega) => total + calcularPagoEntrega(
              entrega,
              configuracionPago.modo,
              configuracionPago.valor,
            ),
            0,
          );
        }

        if (monto <= 0) {
          throw new ErrorValidacion("No hay saldo pendiente a liquidar en ese período");
        }

        const nuevaLiquidacion = await tx.liquidacion.create({
          data: {
            tipo,
            beneficiarioId: beneficiarioNumero,
            monto,
            periodoDesde: desde,
            periodoHasta: hasta,
            cuentaDestino: cuentaDestino?.trim() || null,
            notas: notas?.trim() || null,
            creadoPor: req.usuario.id,
          },
          include: {
            beneficiario: {
              select: { nombre: true, email: true, comercio: { select: { nombre: true } } },
            },
          },
        });

        if (disputasAplicadas.length > 0) {
          await tx.disputa.updateMany({
            where: { id: { in: disputasAplicadas } },
            data: { notaCreditoAplicada: true, notaCreditoLiquidacionId: nuevaLiquidacion.id },
          });
        }

        return nuevaLiquidacion;
      }, { isolationLevel: "Serializable" });

      res.status(201).json({ ok: true, data: liq });
    } catch (e) {
      if (e?.code === "P2034") {
        return next(new ErrorValidacion("La liquidación cambió mientras se procesaba; intenta de nuevo"));
      }
      next(e);
    }
  },

  // PATCH /admin/liquidaciones/:id/pagar
  async marcarPagada(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new ErrorValidacion("id de liquidación inválido");
      }
      const { comprobante, comprobanteUrl, notas } = req.body || {};
      const urlComprobante = typeof comprobante === "string" ? comprobante : comprobanteUrl;

      const cambio = await prisma.liquidacion.updateMany({
        where: { id, estado: "PENDIENTE" },
        data: {
          estado:      "PAGADA",
          comprobante: typeof urlComprobante === "string" ? urlComprobante.trim() || null : null,
          ...(notas?.trim() ? { notas: notas.trim() } : {}),
          pagadoPor:   req.usuario.id,
          pagadoAt:    new Date(),
        },
      });
      if (cambio.count === 0) {
        const existe = await prisma.liquidacion.findUnique({ where: { id }, select: { estado: true } });
        if (!existe) throw new ErrorNoEncontrado("Liquidación no encontrada");
        throw new ErrorValidacion("Solo se pueden pagar liquidaciones pendientes");
      }

      const actualizada = await prisma.liquidacion.findUnique({
        where: { id },
        include: {
          beneficiario: { select: { nombre: true, email: true, telefono: true } },
        },
      });

      res.json({ ok: true, data: actualizada });
    } catch (e) { next(e); }
  },

  async cancelar(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new ErrorValidacion("id de liquidación inválido");
      }
      const { notas } = req.body || {};
      const cambio = await prisma.liquidacion.updateMany({
        where: { id, estado: "PENDIENTE" },
        data: {
          estado: "CANCELADA",
          notas: notas?.trim() || undefined,
        },
      });
      if (cambio.count === 0) {
        const existe = await prisma.liquidacion.findUnique({ where: { id }, select: { estado: true } });
        if (!existe) throw new ErrorNoEncontrado("Liquidación no encontrada");
        throw new ErrorValidacion("Solo se pueden cancelar liquidaciones pendientes");
      }
      const actualizada = await prisma.liquidacion.findUnique({
        where: { id },
        include: {
          beneficiario: { select: { nombre: true, email: true, telefono: true } },
        },
      });
      res.json({ ok: true, data: actualizada });
    } catch (e) {
      next(e);
    }
  },

  // GET /mis-liquidaciones — para comerciantes y repartidores
  async misLiquidaciones(req, res, next) {
    try {
      const items = await prisma.liquidacion.findMany({
        where: { beneficiarioId: req.usuario.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ ok: true, data: items });
    } catch (e) { next(e); }
  },

  // GET /admin/liquidaciones/comercio/:comercioId/reembolsos-pendientes — para
  // que el admin vea, antes de crear la liquidación, cuánto se le va a
  // descontar a ese comercio por disputas ya resueltas con reembolso.
  async reembolsosPendientes(req, res, next) {
    try {
      const comercioId = Number(req.params.comercioId);
      if (!Number.isInteger(comercioId) || comercioId < 1) {
        throw new ErrorValidacion("comercioId inválido");
      }
      const items = await prisma.disputa.findMany({
        where: {
          comercioId,
          estado: { in: ["RESUELTA_REEMBOLSO_TOTAL", "RESUELTA_REEMBOLSO_PARCIAL"] },
          notaCreditoAplicada: false,
        },
        orderBy: { resueltoAt: "asc" },
        select: { id: true, moduloOrigen: true, referenciaId: true, montoReembolsoAprobado: true, montoDescuentoComercio: true, resueltoAt: true },
      });
      const totalDescuento = items.reduce((s, d) => s + Number(d.montoDescuentoComercio || 0), 0);
      res.json({ ok: true, data: { items, totalDescuento } });
    } catch (e) { next(e); }
  },
};

module.exports = LiquidacionController;
