// ============================================================
//  Servicio de Pedidos — lógica de negocio
// ============================================================
const prisma = require("../config/prisma");
const CarritoRepository = require("../repositories/carrito.repository");
const DireccionRepository = require("../repositories/direccion.repository");
const PedidoRepository = require("../repositories/pedido.repository");
const CuponRepository = require("../repositories/cupon.repository");
const { calcularDesglose, calcularDesgloseConIva, redondear } = require("../utils/comision");
const ConfigFiscalRepository = require("../repositories/config-fiscal.repository");
const config = require("../config");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const { ofertaTieneCupo, ofertaVigente, precioVigente } = require("../utils/ofertas");
const NotificacionService = require("./notificacion.service");
const Reglas = require("../config/reglas");
const { cotizarEnvio } = require("../utils/envio");

const ESTADOS_CANCELABLES = ["PENDIENTE_PAGO", "VERIFICANDO_PAGO"];

function extraerDepartamentoDesdeDireccionTexto(direccionTexto) {
  if (!direccionTexto) return null;
  const partes = String(direccionTexto)
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  for (let i = partes.length - 1; i >= 0; i -= 1) {
    const parte = partes[i];
    if (/^tel:/i.test(parte)) continue;
    if (/^indicaciones:/i.test(parte)) continue;
    return parte;
  }
  return null;
}

function pesoDeItems(items) {
  return items.reduce((acum, item) => {
    const pu = item.producto.pesoKg != null ? Number(item.producto.pesoKg) : 1;
    return acum + (Number.isFinite(pu) ? pu : 1) * item.cantidad;
  }, 0);
}

async function comercioRegalaEnvio(comercioId, subtotalComercio) {
  const cfg = await prisma.config.findUnique({
    where: { clave: `envio_gratis_comercio:${comercioId}` },
  });
  const umbral = cfg && cfg.valor ? Number(cfg.valor) : null;
  return umbral !== null && umbral > 0 && subtotalComercio >= umbral;
}

async function calcularCostoEnvioServidor({ usuarioId, direccionId, departamento, itemsConPrecio, subtotalGeneral = 0, subtotalesPorComercio = null, porComercio = null }) {
  // Departamento de entrega
  let departamentoEnvio = departamento?.trim() || null;
  if (direccionId != null) {
    const direccionIdNum = Number(direccionId);
    if (!Number.isInteger(direccionIdNum) || direccionIdNum <= 0) {
      throw new ErrorValidacion("direccionId inválido");
    }
    const direccion = await DireccionRepository.buscarPorId(direccionIdNum, usuarioId);
    if (!direccion) {
      throw new ErrorNoEncontrado("Dirección no encontrada");
    }
    departamentoEnvio = direccion.departamento;
  }
  if (!departamentoEnvio) {
    throw new ErrorValidacion("No pudimos determinar el departamento de entrega");
  }

  const accionSinTarifa = await Reglas.obtener("envio_sin_tarifa_accion");
  const SIN_ENVIO = "No hay envío disponible a este destino por ahora. Escríbenos al soporte para coordinarlo.";

  // 1) Envío gratis de plataforma (campaña global por monto) — aplica a todo el pedido.
  const umbralPlataforma = await Reglas.numero("envio_gratis_umbral_plataforma");
  if (umbralPlataforma > 0 && subtotalGeneral >= umbralPlataforma) return 0;

  const vendedorPermitido = await Reglas.bool("envio_gratis_vendedor_permitido");
  const politica = await Reglas.obtener("envio_politica_multicomercio");
  const grupos = porComercio ? Object.values(porComercio) : null;

  // 2) Política "por comercio": un envío por cada tienda (cada productor despacha).
  if (politica === "por_comercio" && grupos && grupos.length > 1) {
    let total = 0;
    for (const g of grupos) {
      const cid = g.comercio.id;
      const subC = subtotalesPorComercio?.get(cid) ?? 0;
      if (vendedorPermitido && (await comercioRegalaEnvio(cid, subC))) continue;
      const base = await cotizarEnvio({ departamento: departamentoEnvio, pesoKg: pesoDeItems(g.items), accionSinTarifa });
      if (base === null) throw new ErrorValidacion(SIN_ENVIO);
      total += base;
    }
    return total;
  }

  // 3) Consolidado: un solo envío para todo el pedido.
  const precioBase = await cotizarEnvio({ departamento: departamentoEnvio, pesoKg: pesoDeItems(itemsConPrecio), accionSinTarifa });
  if (precioBase === null) throw new ErrorValidacion(SIN_ENVIO);
  if (vendedorPermitido && subtotalesPorComercio && subtotalesPorComercio.size === 1) {
    const [[cid, subC]] = subtotalesPorComercio;
    if (await comercioRegalaEnvio(cid, subC)) return 0;
  }
  return precioBase;
}

const PedidoService = {
  async checkout(usuarioId, datos = {}) {
    const { direccionTexto, direccionId, departamento, notas, codigoCupon } = datos;
    if (!direccionTexto || !direccionTexto.trim()) {
      throw new ErrorValidacion("La dirección de entrega es obligatoria");
    }

    // 1. Obtener carrito
    const items = await CarritoRepository.obtenerCarrito(usuarioId);
    if (!items.length) throw new ErrorValidacion("El carrito está vacío");

    const ahora = new Date();
    const itemsConPrecio = items.map((item) => {
      const ofertaParaUnidad = ofertaVigente(item.producto, ahora, 1);
      if (ofertaParaUnidad && !ofertaTieneCupo(ofertaParaUnidad, item.cantidad)) {
        const restantes = Math.max(
          0,
          Number(ofertaParaUnidad.stockLimite) - Number(ofertaParaUnidad.stockUsado)
        );
        throw new ErrorValidacion(
          `La oferta de "${item.producto.nombre}" solo tiene ${restantes} unidad(es) disponibles.`
        );
      }

      const precioInfo = precioVigente(item.producto, ahora, item.cantidad);
      const precioAlAgregar = Number(item.precioAlAgregar);
      if (precioAlAgregar > 0 && precioInfo.precioFinal > precioAlAgregar) {
        throw new ErrorValidacion(
          `El precio de "${item.producto.nombre}" cambió. Revisa tu carrito antes de confirmar.`
        );
      }
      return {
        ...item,
        precioUnitario: precioInfo.precioFinal,
        ofertaId: precioInfo.oferta?.id ?? null,
      };
    });

    // 2. Agrupar por comercioId
    const porComercio = {};
    for (const item of itemsConPrecio) {
      const cid = item.producto.comercioId;
      if (!porComercio[cid]) porComercio[cid] = { comercio: item.producto.comercio, items: [] };
      porComercio[cid].items.push(item);
    }

    // 3. Verificar stock disponible (fuera de la tx, rápido)
    for (const item of itemsConPrecio) {
      const p = item.producto;
      const disponible = p.stock - p.stockReservado;
      if (disponible < item.cantidad) {
        throw new ErrorValidacion(
          `Stock insuficiente para "${p.nombre}". Disponible: ${disponible}`
        );
      }
    }

    // 4. Calcular montos — tasa en cascada: override por comercio > Config global > env
    const comercioIds = Object.keys(porComercio).map(Number);

    // Candado: nadie puede comprar sus propios productos (conflicto de interés).
    const comercioPropio = await prisma.comercio.findFirst({
      where: { id: { in: comercioIds }, usuarioId },
      select: { id: true },
    });
    if (comercioPropio) {
      throw new ErrorValidacion("No puedes comprar productos de tu propia tienda.");
    }
    const ahora2 = new Date();
    const [overridesComision, configGlobal, configFiscalPorComercio] = await Promise.all([
      prisma.comisionComercio.findMany({
        where: {
          comercioId: { in: comercioIds },
          desde: { lte: ahora2 },
          OR: [{ hasta: null }, { hasta: { gt: ahora2 } }],
        },
        orderBy: { desde: "desc" },
      }),
      prisma.config.findUnique({ where: { clave: "comision_global" } }),
      ConfigFiscalRepository.buscarPorComercioIds(comercioIds),
    ]);
    const tasaGlobal = configGlobal
      ? parseFloat(configGlobal.valor)
      : config.comisionPorcentaje;
    const tasaPorComercio = new Map(
      overridesComision.map((o) => [o.comercioId, Number(o.tasa)])
    );

    let subtotalGeneral = 0;
    let comisionGeneral = 0;
    let ivaGeneral = 0;
    const subtotalesPorComercio = new Map();
    const subtotalesElegibles = new Map(); // subtotal de items SIN oferta, por comercio (para cupón no combinable)
    const subPedidosData = Object.values(porComercio).map(({ comercio, items: itms }) => {
      const subtotalComercio = itms.reduce(
        (acc, i) => acc + Number(i.precioUnitario) * i.cantidad,
        0
      );
      const subtotalSinOferta = itms.reduce(
        (acc, i) => acc + (i.ofertaId ? 0 : Number(i.precioUnitario) * i.cantidad),
        0
      );
      const tasa = tasaPorComercio.get(comercio.id) ?? tasaGlobal;
      // El IVA se calcula sobre el subtotal antes del cupón (mismo tratamiento
      // que la comisión cuando comision_base no es "post_descuento" — ver más
      // abajo). No se recalcula proporcionalmente si se aplica un cupón porque
      // hoy IVA está apagado por defecto y es un caso borde tributario que
      // amerita confirmarse con un contador antes de ajustarlo.
      const desglose = calcularDesgloseConIva(subtotalComercio, configFiscalPorComercio.get(comercio.id), tasa);
      subtotalGeneral += desglose.subtotal;
      comisionGeneral += desglose.comision;
      ivaGeneral += desglose.iva;
      subtotalesPorComercio.set(comercio.id, desglose.subtotal);
      subtotalesElegibles.set(comercio.id, redondear(subtotalSinOferta));

      return {
        comercioId: comercio.id,
        subtotal: desglose.subtotal,
        comision: desglose.comision,
        tasaComisionAplicada: tasa,
        iva: desglose.iva,
        neto: desglose.montoComerciante,
        items: itms.map((i) => ({
          productoId: i.productoId,
          ofertaId: i.ofertaId,
          cantidad: i.cantidad,
          precioUnitario: Number(i.precioUnitario),
          subtotal: Number(i.precioUnitario) * i.cantidad,
        })),
      };
    });
    // El comprador paga el subtotal + costoEnvio; la comisión sale de la parte del comerciante
    const departamentoEnvio = departamento?.trim() || extraerDepartamentoDesdeDireccionTexto(direccionTexto);
    if (!departamentoEnvio) {
      throw new ErrorValidacion("No pudimos determinar el departamento de entrega");
    }

    const costoEnvioCalculado = await calcularCostoEnvioServidor({
      usuarioId,
      direccionId,
      itemsConPrecio,
      departamento: departamentoEnvio,
      subtotalGeneral,
      subtotalesPorComercio,
      porComercio,
    });
    const costoEnvioNum = costoEnvioCalculado ?? 0;
    let totalGeneral = subtotalGeneral + costoEnvioNum;
    let cuponId = null;
    let cuponDescuento = null;

    // La validación del cupón se hace dentro de la transacción, con bloqueo.

    // 5. Transacción atómica
    const pedido = await prisma.$transaction(async (tx) => {
      // 5a. Reservar stock con UPDATE atómico
      for (const item of itemsConPrecio) {
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

        if (item.ofertaId) {
          const ofertaActualizada = await tx.$executeRaw`
            UPDATE "Oferta"
            SET "stockUsado" = "stockUsado" + ${item.cantidad}
            WHERE id = ${item.ofertaId}
              AND "activa" = true
              AND "inicio" <= ${ahora}
              AND "fin" >= ${ahora}
              AND ("stockLimite" IS NULL OR ("stockUsado" + ${item.cantidad}) <= "stockLimite")
          `;
          if (ofertaActualizada === 0) {
            throw new ErrorValidacion(
              `La oferta de "${item.producto.nombre}" ya no está disponible.`
            );
          }
        }
      }

      if (codigoCupon) {
        // cupon_combinable_con_oferta: si es false, el descuento no aplica a
        // productos que ya están en oferta (base "elegible" = sin ofertas).
        const combinable = await Reglas.bool("cupon_combinable_con_oferta");
        const resultadoCupon = await CuponRepository.validarParaCheckout(tx, {
          codigo: codigoCupon.trim().toUpperCase(),
          usuarioId,
          subtotal: subtotalGeneral,
          subtotalesPorComercio,
          ...(combinable ? {} : { subtotalesElegibles }),
        });
        if (resultadoCupon.error) throw new ErrorValidacion(resultadoCupon.error);
        // Fallback de alianza comercial: no es un Cupon propio, no tiene id ni
        // se registra en CuponUso (ver AlianzaService.validarCodigoAlianza).
        if (!resultadoCupon.esAlianza) {
          cuponId = resultadoCupon.cupon.id;
        }
        cuponDescuento = resultadoCupon.descuento;
        totalGeneral = resultadoCupon.totalConDescuento + costoEnvioNum;
      }

      // Regla comision_base: si es "post_descuento" (por defecto), la comisión
      // se calcula sobre el monto YA descontado por el cupón, prorrateando el
      // descuento entre comercios por su participación en el subtotal.
      let comisionTotalFinal = comisionGeneral;
      let subPedidosFinal = subPedidosData;
      if (cuponDescuento && cuponDescuento > 0) {
        const comisionBase = await Reglas.obtener("comision_base");
        if (comisionBase === "post_descuento") {
          comisionTotalFinal = 0;
          subPedidosFinal = subPedidosData.map((sp) => {
            const share = subtotalGeneral > 0 ? (sp.subtotal / subtotalGeneral) * cuponDescuento : 0;
            const comision = redondear(Math.max(0, sp.subtotal - share) * sp.tasaComisionAplicada);
            comisionTotalFinal += comision;
            return { ...sp, comision, neto: redondear(sp.subtotal - comision) };
          });
          comisionTotalFinal = redondear(comisionTotalFinal);
        }
      }

      // El IVA se suma al total una sola vez aquí, después de cualquier ajuste
      // por cupón hecho arriba (con o sin cupón, totalGeneral ya tiene su valor
      // final salvo el envío + IVA en este punto).
      totalGeneral = redondear(totalGeneral + ivaGeneral);

      // 5b. Crear pedido con expiresAt = now + 30 min
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const nuevoPedido = await PedidoRepository.crear(
        {
          compradorId: usuarioId,
          subtotal: subtotalGeneral,
          comisionTotal: comisionTotalFinal,
          ivaTotal: ivaGeneral,
          total: totalGeneral,
          costoEnvio: costoEnvioNum,
          direccionTexto: direccionTexto.trim(),
          direccionId,
          notas,
          expiresAt,
          subPedidos: subPedidosFinal,
          // cuponId solo aplica a cupones propios del marketplace; el descuento
          // de una alianza comercial se registra igual (columna independiente)
          // pero sin cuponId, porque no existe una fila Cupon que referenciar.
          ...(cuponId !== null ? { cuponId } : {}),
          ...(cuponDescuento ? { cuponDescuento } : {}),
        },
        tx
      );

      if (cuponId !== null) {
        await CuponRepository.registrarUso({ cuponId, usuarioId, pedidoId: nuevoPedido.id }, tx);
        await CuponRepository.incrementarUso(cuponId, tx);
      }

      // 5e. Vaciar carrito
      await tx.carritoItem.deleteMany({ where: { usuarioId } });

      return nuevoPedido;
    });

    const resultado = {
      pedido,
      instruccionesPago: {
        mensaje: "Tienes 30 minutos para completar el pago en la pasarela antes de que el pedido expire.",
        expiresAt: pedido.expiresAt,
        total: pedido.total,
      },
    };

    // Notificar de forma asincrónica sin bloquear el response
    setImmediate(async () => {
      try {
        const compradorCompleto = await prisma.usuario.findUnique({
          where: { id: resultado.pedido.compradorId },
          select: { id: true, nombre: true, email: true, telefono: true }
        });
        await NotificacionService.checkoutCompletado({
          pedido: resultado.pedido,
          comprador: compradorCompleto,
          comerciantes: resultado.pedido.subPedidos?.map(sp => sp.comercio) || [],
        });

        // Notificar a cada comerciante involucrado (PEDIDO_NUEVO in-app)
        for (const sp of (resultado.pedido.subPedidos || [])) {
          await NotificacionService.pedidoNuevoComercio(
            sp.comercioId,
            resultado.pedido.id,
            compradorCompleto?.nombre || "Un comprador",
            sp.subtotal
          );
        }
      } catch (e) {
        console.error("[NOTIF] Error en checkoutCompletado:", e.message);
      }
    });

    return resultado;
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
          if (item.ofertaId) {
            await tx.$executeRaw`
              UPDATE "Oferta"
              SET "stockUsado" = GREATEST("stockUsado" - ${item.cantidad}, 0)
              WHERE id = ${item.ofertaId}
            `;
          }
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
