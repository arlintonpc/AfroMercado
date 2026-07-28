const crypto = require("crypto");
const prisma = require("../config/prisma");
const ComercioRepository = require("../repositories/comercio.repository");
const {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorValidacion,
} = require("../utils/errores");
const { bloquearProducto } = require("../utils/bloqueos-transaccionales");

const TIPOS_AJUSTE = new Set([
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "MERMA",
  "DEVOLUCION_CLIENTE",
]);
const CATEGORIAS_GASTO = new Set([
  "FLETE", "EMPAQUE", "TRANSPORTE", "SERVICIO", "NOMINA", "ARRIENDO", "OTRO",
]);
const TIPOS_CAJA = new Set(["INGRESO", "EGRESO"]);

function numero(valor) {
  return Number(valor || 0);
}

function validarEnteroPositivo(valor, campo) {
  if (!Number.isInteger(Number(valor)) || Number(valor) <= 0) {
    throw new ErrorValidacion(`${campo} debe ser un entero mayor que cero`);
  }
  return Number(valor);
}

function codigoCompra() {
  return `INV-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function rangoFechas({ desde, hasta } = {}) {
  const fecha = {};
  if (desde) fecha.gte = new Date(`${desde}T00:00:00`);
  if (hasta) fecha.lte = new Date(`${hasta}T23:59:59.999`);
  if (Number.isNaN(fecha.gte?.getTime()) || Number.isNaN(fecha.lte?.getTime())) {
    throw new ErrorValidacion("El rango de fechas no es vÃ¡lido");
  }
  return Object.keys(fecha).length ? fecha : undefined;
}

function costoPromedioPonderado({ stockAnterior, costoAnterior, cantidad, costoUnitario }) {
  const unidadesFinales = stockAnterior + cantidad;
  if (unidadesFinales <= 0) return 0;
  return Number(
    ((stockAnterior * costoAnterior + cantidad * costoUnitario) / unidadesFinales).toFixed(2)
  );
}

function compraCoincideConSolicitud(compra, { proveedorId, items }) {
  const proveedorNormalizado = proveedorId ? Number(proveedorId) : null;
  if (Number(compra.proveedorId || 0) !== Number(proveedorNormalizado || 0)) return false;

  const existentes = [...(compra.items || [])]
    .map((item) => ({
      productoId: Number(item.productoId),
      cantidad: Number(item.cantidad),
      costoUnitario: Number(item.costoUnitario),
    }))
    .sort((a, b) => a.productoId - b.productoId);
  const solicitados = [...items].sort((a, b) => a.productoId - b.productoId);

  return existentes.length === solicitados.length && existentes.every((item, indice) => {
    const solicitado = solicitados[indice];
    return item.productoId === solicitado.productoId
      && item.cantidad === solicitado.cantidad
      && item.costoUnitario === solicitado.costoUnitario;
  });
}

async function comercioDeUsuario(usuarioId) {
  const comercio = await ComercioRepository.buscarPorUsuarioId(Number(usuarioId));
  if (!comercio) throw new ErrorProhibido("No tienes un comercio registrado");
  return comercio;
}

async function productoPropioBloqueado(tx, comercioId, productoId) {
  await bloquearProducto(tx, productoId);
  const producto = await tx.producto.findUnique({
    where: { id: Number(productoId) },
    select: {
      id: true,
      comercioId: true,
      nombre: true,
      stock: true,
      stockMinimo: true,
      stockBajoNotificadoAt: true,
      stockReservado: true,
      costoPromedio: true,
    },
  });
  if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
  if (producto.comercioId !== Number(comercioId)) {
    throw new ErrorProhibido("El producto no pertenece a tu comercio");
  }
  return producto;
}

async function crearMovimiento(tx, data) {
  return tx.movimientoInventario.create({ data });
}

async function registrarVentaConfirmadaEnTx(tx, { comercioId, pedidoItem }) {
  const existente = await tx.movimientoInventario.findUnique({
    where: { pedidoItemId: Number(pedidoItem.id) },
  });
  if (existente) return { yaRegistrado: true, producto: null };

  const producto = await productoPropioBloqueado(tx, comercioId, pedidoItem.productoId);
  const cantidad = validarEnteroPositivo(pedidoItem.cantidad, "La cantidad de venta");
  if (producto.stock < cantidad) {
    throw new ErrorValidacion(`Stock insuficiente para confirmar el producto #${pedidoItem.productoId}`);
  }

  const stockPosterior = producto.stock - cantidad;
  const actualizado = await tx.producto.update({
    where: { id: producto.id },
    data: {
      stock: stockPosterior,
      stockReservado: Math.max(0, producto.stockReservado - cantidad),
    },
    select: {
      id: true,
      nombre: true,
      comercioId: true,
      stock: true,
      stockMinimo: true,
      stockBajoNotificadoAt: true,
    },
  });
  const costo = numero(producto.costoPromedio);
  await crearMovimiento(tx, {
    comercioId: Number(comercioId),
    productoId: producto.id,
    tipo: "VENTA",
    cantidad: -cantidad,
    stockAnterior: producto.stock,
    stockPosterior,
    costoUnitario: costo,
    costoPromedioAnterior: costo,
    costoPromedioPosterior: costo,
    valorTotal: Number((costo * cantidad).toFixed(2)),
    pedidoItemId: Number(pedidoItem.id),
    motivo: "Salida automática por venta confirmada",
  });
  return { yaRegistrado: false, producto: actualizado };
}

const InventarioService = {
  async listarProveedores(usuarioId) {
    const comercio = await comercioDeUsuario(usuarioId);
    return prisma.proveedorInventario.findMany({
      where: { comercioId: comercio.id },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    });
  },

  async crearProveedor(usuarioId, datos) {
    const comercio = await comercioDeUsuario(usuarioId);
    const nombre = String(datos.nombre || "").trim();
    if (!nombre) throw new ErrorValidacion("El nombre del proveedor es obligatorio");
    try {
      return await prisma.proveedorInventario.create({
        data: {
          comercioId: comercio.id,
          nombre,
          nit: datos.nit?.trim() || null,
          telefono: datos.telefono?.trim() || null,
          email: datos.email?.trim() || null,
          direccion: datos.direccion?.trim() || null,
          notas: datos.notas?.trim() || null,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new ErrorConflicto("Ya existe un proveedor con ese nombre en tu comercio");
      }
      throw error;
    }
  },

  async crearCompraRecibida(usuarioId, datos) {
    const comercio = await comercioDeUsuario(usuarioId);
    const idempotencyKey = String(datos.idempotencyKey || "").trim();
    if (!idempotencyKey) throw new ErrorValidacion("El idempotencyKey es obligatorio");
    if (!Array.isArray(datos.items) || datos.items.length === 0) {
      throw new ErrorValidacion("La compra debe incluir al menos un producto");
    }

    const items = datos.items.map((item) => ({
      productoId: Number(item.productoId),
      cantidad: validarEnteroPositivo(item.cantidad, "La cantidad"),
      costoUnitario: Number(item.costoUnitario),
    }));
    if (items.some((item) => !Number.isFinite(item.costoUnitario) || item.costoUnitario < 0)) {
      throw new ErrorValidacion("El costo unitario debe ser un número mayor o igual a cero");
    }
    if (new Set(items.map((item) => item.productoId)).size !== items.length) {
      throw new ErrorValidacion("Un producto solo puede aparecer una vez en la compra");
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const previa = await tx.compraInventario.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });
        if (previa) {
          if (previa.comercioId !== comercio.id) {
            throw new ErrorConflicto("La clave de idempotencia pertenece a otra operación");
          }
          if (!compraCoincideConSolicitud(previa, { proveedorId: datos.proveedorId, items })) {
            throw new ErrorConflicto("La clave de idempotencia ya fue usada con una compra diferente");
          }
          return previa;
        }

        if (datos.proveedorId) {
          const proveedor = await tx.proveedorInventario.findFirst({
            where: { id: Number(datos.proveedorId), comercioId: comercio.id, activo: true },
          });
          if (!proveedor) throw new ErrorValidacion("El proveedor no pertenece a tu comercio o está inactivo");
        }

        const total = items.reduce((suma, item) => suma + item.cantidad * item.costoUnitario, 0);
        const compra = await tx.compraInventario.create({
          data: {
            comercioId: comercio.id,
            proveedorId: datos.proveedorId ? Number(datos.proveedorId) : null,
            codigo: codigoCompra(),
            idempotencyKey,
            estado: "BORRADOR",
            fechaCompra: datos.fechaCompra ? new Date(datos.fechaCompra) : new Date(),
            notas: datos.notas?.trim() || null,
            total: Number(total.toFixed(2)),
            creadoPor: Number(usuarioId),
          },
        });

        for (const item of [...items].sort((a, b) => a.productoId - b.productoId)) {
          const producto = await productoPropioBloqueado(tx, comercio.id, item.productoId);
          const costoAnterior = numero(producto.costoPromedio);
          const costoPosterior = costoPromedioPonderado({
            stockAnterior: producto.stock,
            costoAnterior,
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
          });
          const stockPosterior = producto.stock + item.cantidad;
          const compraItem = await tx.compraInventarioItem.create({
            data: {
              compraId: compra.id,
              productoId: producto.id,
              cantidad: item.cantidad,
              costoUnitario: item.costoUnitario,
              subtotal: Number((item.cantidad * item.costoUnitario).toFixed(2)),
            },
          });
          await tx.producto.update({
            where: { id: producto.id },
            data: {
              stock: stockPosterior,
              costoPromedio: costoPosterior,
              costoActualizadoAt: new Date(),
              ...(producto.stockMinimo > 0 && stockPosterior > producto.stockMinimo
                ? { stockBajoNotificadoAt: null }
                : {}),
            },
          });
          await crearMovimiento(tx, {
            comercioId: comercio.id,
            productoId: producto.id,
            tipo: "COMPRA",
            cantidad: item.cantidad,
            stockAnterior: producto.stock,
            stockPosterior,
            costoUnitario: item.costoUnitario,
            costoPromedioAnterior: costoAnterior,
            costoPromedioPosterior: costoPosterior,
            valorTotal: Number((item.cantidad * item.costoUnitario).toFixed(2)),
            compraItemId: compraItem.id,
            creadoPor: Number(usuarioId),
            motivo: "Recepción de compra",
          });
        }

        return tx.compraInventario.update({
          where: { id: compra.id },
          data: { estado: "RECIBIDA", recibidoAt: new Date() },
          include: { proveedor: true, items: { include: { producto: true } } },
        });
      });
    } catch (error) {
      if (error?.code === "P2002") {
        const previa = await prisma.compraInventario.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });
        if (previa?.comercioId === comercio.id) {
          if (!compraCoincideConSolicitud(previa, { proveedorId: datos.proveedorId, items })) {
            throw new ErrorConflicto("La clave de idempotencia ya fue usada con una compra diferente");
          }
          return previa;
        }
      }
      throw error;
    }
  },

  async registrarAjuste(usuarioId, datos) {
    const comercio = await comercioDeUsuario(usuarioId);
    const tipo = String(datos.tipo || "").trim().toUpperCase();
    if (!TIPOS_AJUSTE.has(tipo)) throw new ErrorValidacion("Tipo de movimiento no válido");
    const cantidadBase = validarEnteroPositivo(datos.cantidad, "La cantidad");
    const esSalida = tipo === "AJUSTE_SALIDA" || tipo === "MERMA";
    const cantidad = esSalida ? -cantidadBase : cantidadBase;
    const motivo = String(datos.motivo || "").trim();
    if (!motivo) throw new ErrorValidacion("El motivo del ajuste es obligatorio");
    const idempotencyKey = String(datos.idempotencyKey || "").trim();
    if (!idempotencyKey) throw new ErrorValidacion("El idempotencyKey es obligatorio");

    return prisma.$transaction(async (tx) => {
      const previo = await tx.movimientoInventario.findUnique({ where: { idempotencyKey } });
      if (previo) {
        if (previo.comercioId !== comercio.id) {
          throw new ErrorConflicto("La clave de idempotencia pertenece a otra operación");
        }
        return previo;
      }
      const producto = await productoPropioBloqueado(tx, comercio.id, datos.productoId);
      const stockPosterior = producto.stock + cantidad;
      if (stockPosterior < 0) throw new ErrorValidacion("El movimiento no puede dejar el stock negativo");
      const costo = numero(producto.costoPromedio);
      await tx.producto.update({
        where: { id: producto.id },
        data: {
          stock: stockPosterior,
          ...(producto.stockMinimo > 0 && stockPosterior > producto.stockMinimo
            ? { stockBajoNotificadoAt: null }
            : {}),
        },
      });
      return crearMovimiento(tx, {
        comercioId: comercio.id,
        productoId: producto.id,
        tipo,
        cantidad,
        stockAnterior: producto.stock,
        stockPosterior,
        costoUnitario: costo,
        costoPromedioAnterior: costo,
        costoPromedioPosterior: costo,
        valorTotal: Number((Math.abs(cantidad) * costo).toFixed(2)),
        idempotencyKey,
        motivo,
        creadoPor: Number(usuarioId),
      });
    });
  },

  async resumen(usuarioId) {
    const comercio = await comercioDeUsuario(usuarioId);
    const [productos, movimientos, compras] = await Promise.all([
      prisma.producto.findMany({
        where: { comercioId: comercio.id, deletedAt: null },
        select: { id: true, nombre: true, stock: true, stockReservado: true, stockMinimo: true, costoPromedio: true },
      }),
      prisma.movimientoInventario.findMany({
        where: { comercioId: comercio.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { producto: { select: { nombre: true, unidad: true } } },
      }),
      prisma.compraInventario.findMany({
        where: { comercioId: comercio.id },
        orderBy: { fechaCompra: "desc" },
        take: 20,
        include: { proveedor: { select: { nombre: true } }, items: true },
      }),
    ]);
    const valorInventario = productos.reduce(
      (suma, producto) => suma + producto.stock * numero(producto.costoPromedio),
      0
    );
    return {
      productos,
      movimientos,
      compras,
      resumen: {
        productos: productos.length,
        unidadesDisponibles: productos.reduce((suma, producto) => suma + producto.stock, 0),
        valorInventario: Number(valorInventario.toFixed(2)),
        stockBajo: productos.filter((producto) => producto.stockMinimo > 0 && producto.stock <= producto.stockMinimo),
        margenDisponible: false,
        mensajeMargen: "El margen con cupones se habilitará cuando se defina la política de financiación de descuentos.",
      },
    };
  },

  async listarMovimientos(usuarioId, filtros = {}) {
    const comercio = await comercioDeUsuario(usuarioId);
    const where = {
      comercioId: comercio.id,
      ...(filtros.productoId ? { productoId: Number(filtros.productoId) } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    };
    return prisma.movimientoInventario.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(Number(filtros.limite) || 100, 1), 250),
      include: { producto: { select: { id: true, nombre: true, fotoUrl: true, unidad: true } } },
    });
  },

  async crearGasto(usuarioId, datos) {
    const comercio = await comercioDeUsuario(usuarioId);
    const categoria = String(datos.categoria || "").trim().toUpperCase();
    const concepto = String(datos.concepto || "").trim();
    const monto = Number(datos.monto);
    if (!CATEGORIAS_GASTO.has(categoria)) throw new ErrorValidacion("CategorÃ­a de gasto no vÃ¡lida");
    if (!concepto) throw new ErrorValidacion("El concepto del gasto es obligatorio");
    if (!Number.isFinite(monto) || monto <= 0) throw new ErrorValidacion("El monto debe ser mayor que cero");
    const fecha = datos.fecha ? new Date(datos.fecha) : new Date();
    if (Number.isNaN(fecha.getTime())) throw new ErrorValidacion("La fecha del gasto no es vÃ¡lida");
    return prisma.gastoOperativo.create({
      data: {
        comercioId: comercio.id,
        categoria,
        concepto,
        monto: Number(monto.toFixed(2)),
        fecha,
        notas: datos.notas?.trim() || null,
        creadoPor: Number(usuarioId),
      },
    });
  },

  async listarGastos(usuarioId, filtros = {}) {
    const comercio = await comercioDeUsuario(usuarioId);
    return prisma.gastoOperativo.findMany({
      where: { comercioId: comercio.id, ...(rangoFechas(filtros) ? { fecha: rangoFechas(filtros) } : {}) },
      orderBy: { fecha: "desc" },
      take: Math.min(Math.max(Number(filtros.limite) || 100, 1), 250),
    });
  },

  async resumenFinanciero(usuarioId, filtros = {}) {
    const comercio = await comercioDeUsuario(usuarioId);
    const rango = rangoFechas(filtros);
    const [ventas, gastos] = await Promise.all([
      prisma.movimientoInventario.findMany({
        where: { comercioId: comercio.id, tipo: "VENTA", ...(rango ? { createdAt: rango } : {}) },
        include: { pedidoItem: { select: { subtotal: true } } },
      }),
      prisma.gastoOperativo.findMany({
        where: { comercioId: comercio.id, ...(rango ? { fecha: rango } : {}) },
        orderBy: { fecha: "desc" },
      }),
    ]);
    const ingresosBrutos = ventas.reduce((total, venta) => total + numero(venta.pedidoItem?.subtotal), 0);
    const costoVentas = ventas.reduce((total, venta) => total + numero(venta.valorTotal), 0);
    const gastosOperativos = gastos.reduce((total, gasto) => total + numero(gasto.monto), 0);
    const utilidadBruta = ingresosBrutos - costoVentas;
    const utilidadOperativa = utilidadBruta - gastosOperativos;
    return {
      periodo: { desde: filtros.desde || null, hasta: filtros.hasta || null },
      politicaContable: {
        base: "CAJA_PROVISIONAL",
        impuestos: "INFORMATIVOS",
        cupones: "EXCLUIDOS_HASTA_DEFINICION",
        esResultadoOficial: false,
      },
      ventas: ventas.length,
      ingresosBrutos: Number(ingresosBrutos.toFixed(2)),
      costoVentas: Number(costoVentas.toFixed(2)),
      utilidadBruta: Number(utilidadBruta.toFixed(2)),
      gastosOperativos: Number(gastosOperativos.toFixed(2)),
      utilidadOperativa: Number(utilidadOperativa.toFixed(2)),
      margenBrutoPorcentaje: ingresosBrutos ? Number(((utilidadBruta / ingresosBrutos) * 100).toFixed(2)) : 0,
      gastos,
      advertenciaCupones: "Este resumen no distribuye descuentos por cupÃ³n ni impuestos hasta que se apruebe su polÃ­tica contable.",
    };
  },

  async crearCuentaOperativa(usuarioId, datos) {
    const comercio = await comercioDeUsuario(usuarioId);
    const tipo = String(datos.tipo || "").toUpperCase();
    const concepto = String(datos.concepto || "").trim();
    const montoOriginal = Number(datos.montoOriginal);
    if (!TIPOS_CAJA.has(tipo)) throw new ErrorValidacion("Tipo de cuenta no vÃ¡lido");
    if (!concepto || !Number.isFinite(montoOriginal) || montoOriginal <= 0) {
      throw new ErrorValidacion("Concepto y monto original mayor que cero son obligatorios");
    }
    return prisma.cuentaOperativa.create({
      data: {
        comercioId: comercio.id, tipo, concepto, montoOriginal: Number(montoOriginal.toFixed(2)),
        contraparte: datos.contraparte?.trim() || null,
        fechaVencimiento: datos.fechaVencimiento ? new Date(datos.fechaVencimiento) : null,
        notas: datos.notas?.trim() || null,
      },
    });
  },

  async listarCuentasOperativas(usuarioId, filtros = {}) {
    const comercio = await comercioDeUsuario(usuarioId);
    const tipo = filtros.tipo ? String(filtros.tipo).toUpperCase() : undefined;
    const estado = filtros.estado ? String(filtros.estado).toUpperCase() : undefined;
    return prisma.cuentaOperativa.findMany({
      where: { comercioId: comercio.id, ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) },
      orderBy: [{ fechaVencimiento: "asc" }, { createdAt: "desc" }], take: 250,
      include: { abonos: { orderBy: { fecha: "desc" } } },
    });
  },

  async registrarAbono(usuarioId, cuentaId, datos) {
    const comercio = await comercioDeUsuario(usuarioId);
    const monto = Number(datos.monto);
    if (!Number.isFinite(monto) || monto <= 0) throw new ErrorValidacion("El abono debe ser mayor que cero");
    return prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaOperativa.findFirst({ where: { id: Number(cuentaId), comercioId: comercio.id } });
      if (!cuenta) throw new ErrorNoEncontrado("Cuenta operativa no encontrada");
      if (["PAGADA", "CANCELADA"].includes(cuenta.estado)) throw new ErrorValidacion("La cuenta ya no admite abonos");
      const saldo = numero(cuenta.montoOriginal) - numero(cuenta.montoPagado);
      if (monto > saldo) throw new ErrorValidacion("El abono no puede superar el saldo pendiente");
      const montoPagado = Number((numero(cuenta.montoPagado) + monto).toFixed(2));
      const estado = montoPagado >= numero(cuenta.montoOriginal) ? "PAGADA" : "PARCIAL";
      const movimiento = await tx.movimientoCaja.create({ data: {
        comercioId: comercio.id, cuentaOperativaId: cuenta.id, tipo: cuenta.tipo, monto: Number(monto.toFixed(2)),
        concepto: datos.concepto?.trim() || `Abono: ${cuenta.concepto}`, notas: datos.notas?.trim() || null, creadoPor: Number(usuarioId),
      } });
      await tx.cuentaOperativa.update({ where: { id: cuenta.id }, data: { montoPagado, estado } });
      return movimiento;
    });
  },

  async resumenCaja(usuarioId, filtros = {}) {
    const comercio = await comercioDeUsuario(usuarioId);
    const rango = rangoFechas(filtros);
    const movimientos = await prisma.movimientoCaja.findMany({ where: { comercioId: comercio.id, ...(rango ? { fecha: rango } : {}) } });
    const ingresos = movimientos.filter((m) => m.tipo === "INGRESO").reduce((t, m) => t + numero(m.monto), 0);
    const egresos = movimientos.filter((m) => m.tipo === "EGRESO").reduce((t, m) => t + numero(m.monto), 0);
    return { ingresos: Number(ingresos.toFixed(2)), egresos: Number(egresos.toFixed(2)), saldo: Number((ingresos - egresos).toFixed(2)), movimientos };
  },

  async kardexValorizado(usuarioId, filtros = {}) {
    const comercio = await comercioDeUsuario(usuarioId);
    const where = { comercioId: comercio.id, ...(filtros.productoId ? { productoId: Number(filtros.productoId) } : {}) };
    const [productos, movimientos] = await Promise.all([
      prisma.producto.findMany({ where: { comercioId: comercio.id, deletedAt: null, ...(filtros.productoId ? { id: Number(filtros.productoId) } : {}) }, select: { id: true, nombre: true, unidad: true, stock: true, stockReservado: true, costoPromedio: true, stockMinimo: true } }),
      prisma.movimientoInventario.findMany({ where: { ...where, ...(rangoFechas(filtros) ? { createdAt: rangoFechas(filtros) } : {}) }, orderBy: { createdAt: 'desc' }, take: 500, include: { producto: { select: { nombre: true, unidad: true } } } }),
    ]);
    return {
      existencias: productos.map((p) => ({ ...p, costoPromedio: numero(p.costoPromedio), valorInventario: Number((p.stock * numero(p.costoPromedio)).toFixed(2)), disponible: p.stock - p.stockReservado })),
      movimientos,
    };
  },

  async alertasOperativas(usuarioId) {
    const comercio = await comercioDeUsuario(usuarioId);
    const ahora = new Date();
    const [stockBajo, vencidas, caja] = await Promise.all([
      prisma.producto.findMany({ where: { comercioId: comercio.id, deletedAt: null, stockMinimo: { gt: 0 } }, select: { id: true, nombre: true, stock: true, stockMinimo: true } }),
      prisma.cuentaOperativa.findMany({ where: { comercioId: comercio.id, estado: { in: ['PENDIENTE', 'PARCIAL'] }, fechaVencimiento: { lt: ahora } }, select: { id: true, concepto: true, montoOriginal: true, montoPagado: true, fechaVencimiento: true } }),
      this.resumenCaja(usuarioId),
    ]);
    return { stockBajo: stockBajo.filter((producto) => producto.stock <= producto.stockMinimo), cuentasVencidas: vencidas, cajaNegativa: caja.saldo < 0, saldoCaja: caja.saldo };
  },

  registrarVentaConfirmadaEnTx,
};

module.exports = InventarioService;
