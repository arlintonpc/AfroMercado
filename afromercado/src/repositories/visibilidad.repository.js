const prisma = require("../config/prisma");

const VENTANA_ATRIBUCION_DIAS = 7;

function limpiarTexto(valor, max = 500) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto ? texto.slice(0, max) : null;
}

const VisibilidadRepository = {
  async crear({ comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta, adminId }) {
    return prisma.visibilidadPagada.create({
      data: {
        comercioId: Number(comercioId),
        productoId: productoId ? Number(productoId) : null,
        tipo,
        inicio: new Date(inicio),
        fin: new Date(fin),
        montoCOP,
        notas: notas || null,
        etiqueta: etiqueta?.trim() || null,
        creadoPor: Number(adminId),
      },
      include: { comercio: { select: { nombre: true } }, producto: { select: { nombre: true } } },
    });
  },

  async listarActivas(tipo) {
    const ahora = new Date();
    return prisma.visibilidadPagada.findMany({
      where: { activa: true, inicio: { lte: ahora }, fin: { gt: ahora }, ...(tipo ? { tipo } : {}) },
      include: {
        comercio: { select: { id: true, nombre: true } },
        producto: {
          select: {
            id: true, nombre: true, precio: true, fotoUrl: true, unidad: true,
            comercio: { select: { id: true, nombre: true, municipio: true, verificado: true, calificacion: true, totalVentas: true } },
          },
        },
      },
      orderBy: { inicio: "asc" },
    });
  },

  async listarTodas({ pagina = 1, porPagina = 20 } = {}) {
    const skip = (pagina - 1) * porPagina;
    const [total, items] = await Promise.all([
      prisma.visibilidadPagada.count(),
      prisma.visibilidadPagada.findMany({
        include: {
          comercio: { select: { nombre: true } },
          producto: { select: { nombre: true } },
          admin: { select: { nombre: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: porPagina,
      }),
    ]);
    return { items, total, paginas: Math.ceil(total / porPagina), pagina };
  },

  async desactivar(id) {
    return prisma.visibilidadPagada.update({
      where: { id: Number(id) },
      data: { activa: false },
    });
  },

  async buscarPorId(id) {
    return prisma.visibilidadPagada.findUnique({ where: { id: Number(id) } });
  },

  // Incrementa vistas en el slot activo asociado a un producto.
  // Si el producto tiene varios slots activos, incrementa el más reciente.
  async registrarVistaProducto(productoId) {
    const ahora = new Date();
    const slot = await prisma.visibilidadPagada.findFirst({
      where: { productoId: Number(productoId), activa: true, inicio: { lte: ahora }, fin: { gt: ahora } },
      orderBy: { createdAt: "desc" },
    });
    if (!slot) return null;
    return prisma.visibilidadPagada.update({
      where: { id: slot.id },
      data: { vistas: { increment: 1 } },
    });
  },

  async registrarEventoProducto(productoId, tipo, { usuarioId = null, sesionId = null, userAgent = null, referer = null } = {}) {
    const ahora = new Date();
    const slot = await prisma.visibilidadPagada.findFirst({
      where: { productoId: Number(productoId), activa: true, inicio: { lte: ahora }, fin: { gt: ahora } },
      orderBy: { createdAt: "desc" },
      select: { id: true, productoId: true, comercioId: true },
    });
    if (!slot) return null;

    return prisma.$transaction(async (tx) => {
      const campo = tipo === "CARRITO" ? "carritos" : "clics";
      await tx.visibilidadPagada.update({
        where: { id: slot.id },
        data: { [campo]: { increment: 1 } },
      });
      return tx.publicidadEvento.create({
        data: {
          visibilidadId: slot.id,
          productoId: slot.productoId,
          comercioId: slot.comercioId,
          usuarioId: usuarioId ? Number(usuarioId) : null,
          sesionId: limpiarTexto(sesionId, 120),
          tipo,
          userAgent: limpiarTexto(userAgent, 500),
          referer: limpiarTexto(referer, 500),
        },
      });
    });
  },

  async registrarClicProducto(productoId, datos = {}) {
    return this.registrarEventoProducto(productoId, "CLIC", datos);
  },

  async registrarCarritoProducto(productoId, datos = {}) {
    return this.registrarEventoProducto(productoId, "CARRITO", datos);
  },

  async buscarUltimoClicAtribuible(db, { productoId, compradorId, sesionId, confirmadoAt = new Date() }) {
    const identidades = [];
    if (compradorId) identidades.push({ usuarioId: Number(compradorId) });
    if (sesionId) identidades.push({ sesionId: limpiarTexto(sesionId, 120) });
    if (identidades.length === 0) return null;

    const desde = new Date(confirmadoAt.getTime() - VENTANA_ATRIBUCION_DIAS * 24 * 3600_000);
    return db.publicidadEvento.findFirst({
      where: {
        productoId: Number(productoId),
        tipo: "CLIC",
        createdAt: { gte: desde, lte: confirmadoAt },
        OR: identidades,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, visibilidadId: true, sesionId: true, usuarioId: true },
    });
  },

  async atribuirVentaProducto(db, { pedidoId, pedidoItemId, productoId, cantidad, subtotal, compradorId, sesionId = null }) {
    const ahora = new Date();
    const evento = await this.buscarUltimoClicAtribuible(db, {
      productoId,
      compradorId,
      sesionId,
      confirmadoAt: ahora,
    });

    const slot = evento
      ? { id: evento.visibilidadId }
      : await db.visibilidadPagada.findFirst({
          where: { productoId: Number(productoId), activa: true, inicio: { lte: ahora }, fin: { gt: ahora } },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
    if (!slot) return null;

    try {
      await db.publicidadAtribucion.create({
        data: {
          pedidoId: Number(pedidoId),
          pedidoItemId: Number(pedidoItemId),
          visibilidadId: slot.id,
          publicidadEventoId: evento?.id || null,
          productoId: Number(productoId),
          usuarioId: compradorId ? Number(compradorId) : null,
          sesionId: evento?.sesionId || limpiarTexto(sesionId, 120),
          cantidad: Number(cantidad) || 0,
          subtotal: Number(subtotal) || 0,
          modelo: evento ? "ULTIMO_CLIC_7D" : "PAUTA_ACTIVA_CONFIRMACION",
        },
      });
    } catch (err) {
      if (err?.code === "P2002") return null;
      throw err;
    }

    return db.visibilidadPagada.update({
      where: { id: slot.id },
      data: {
        pedidosAtribuidos: { increment: 1 },
        unidadesAtribuidas: { increment: Number(cantidad) || 0 },
        gmvAtribuido: { increment: Number(subtotal) || 0 },
      },
    });
  },

  async atribuirPedidoConfirmado(db, pedido) {
    const operaciones = [];
    for (const sub of pedido.subPedidos || []) {
      for (const item of sub.items || []) {
        operaciones.push(this.atribuirVentaProducto(db, {
          pedidoId: pedido.id,
          pedidoItemId: item.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
          subtotal: item.subtotal,
          compradorId: pedido.compradorId,
        }));
      }
    }
    return Promise.all(operaciones);
  },

  // Devuelve los slots activos de un comercio con sus métricas de vistas.
  async metricasPorComercio(comercioId) {
    const ahora = new Date();
    return prisma.visibilidadPagada.findMany({
      where: { comercioId: Number(comercioId), activa: true, inicio: { lte: ahora }, fin: { gt: ahora } },
      select: {
        id: true, tipo: true, inicio: true, fin: true, vistas: true, clics: true, carritos: true,
        pedidosAtribuidos: true, unidadesAtribuidas: true, gmvAtribuido: true, montoCOP: true,
        producto: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};

module.exports = VisibilidadRepository;
