// ============================================================
//  Repositorio de Pedidos — capa de acceso a datos
// ============================================================
const prisma = require("../config/prisma");

function generarCodigoPedido() {
  const d = new Date();
  const yr = String(d.getFullYear()).slice(2);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sfx = '';
  for (let i = 0; i < 4; i++) sfx += chars[Math.floor(Math.random() * chars.length)];
  return `AFM-${yr}${mo}-${sfx}`;
}

function mapearPedido(p) {
  if (!p) return p;
  return {
    ...p,
    subtotal:      Number(p.subtotal),
    comisionTotal: Number(p.comisionTotal),
    ivaTotal:      Number(p.ivaTotal ?? 0),
    total:         Number(p.total),
    costoEnvio:    Number(p.costoEnvio ?? 0),
    cuponDescuento: p.cuponDescuento != null ? Number(p.cuponDescuento) : null,
    subPedidos: (p.subPedidos || []).map(sp => ({
      ...sp,
      subtotal:             Number(sp.subtotal),
      comision:             Number(sp.comision),
      iva:                  Number(sp.iva ?? 0),
      neto:                 Number(sp.neto),
      tasaComisionAplicada: sp.tasaComisionAplicada != null ? Number(sp.tasaComisionAplicada) : null,
      items: (sp.items || []).map(item => ({
        ...item,
        precioUnitario: Number(item.precioUnitario),
        subtotal:       Number(item.subtotal),
        producto: item.producto ? { ...item.producto, precio: Number(item.producto.precio) } : item.producto,
      })),
    })),
  };
}

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
      ivaTotal,
      total,
      costoEnvio,
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
        ivaTotal: ivaTotal ?? 0,
        total,
        costoEnvio: costoEnvio ?? 0,
        direccionTexto,
        direccionId: direccionId ?? null,
        notas: notas ?? null,
        expiresAt,
        codigo: generarCodigoPedido(),
        // cuponId solo existe para cupones propios del marketplace; cuponDescuento
        // se guarda independiente porque también aplica a descuentos de alianza
        // comercial (fallback sin fila Cupon propia — ver AlianzaService).
        ...(cuponId != null ? { cuponId } : {}),
        ...(cuponDescuento != null ? { cuponDescuento } : {}),
        estado: "PENDIENTE_PAGO",
        subPedidos: {
          create: subPedidos.map((sp) => ({
            comercioId: sp.comercioId,
            subtotal: sp.subtotal,
            comision: sp.comision,
            tasaComisionAplicada: sp.tasaComisionAplicada ?? null,
            iva: sp.iva ?? 0,
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
    const p = await prisma.pedido.findUnique({
      where: { id },
      include: {
        subPedidos: {
          include: {
            items: { include: { producto: true } },
            comercio: true,
            entrega: { include: { calificacion: true } },
          },
        },
      },
    });
    return mapearPedido(p);
  },

  async listarPorComprador(compradorId) {
    const pedidos = await prisma.pedido.findMany({
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
    return pedidos.map(mapearPedido);
  },

  async actualizarEstado(id, estado, tx) {
    const db = tx || prisma;
    return db.pedido.update({ where: { id }, data: { estado } });
  },
};

module.exports = PedidoRepository;
