const prisma = require("../config/prisma");

const VENTANA_ATRIBUCION_DIAS = 7;

function limpiarTexto(valor, max = 500) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto ? texto.slice(0, max) : null;
}

const VisibilidadRepository = {
  async crear({ comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta, adminId }) {
    const campana = await prisma.campanaPublicitaria.create({
      data: {
        comercioId: Number(comercioId),
        nombre: `Visibilidad ${tipo}`,
        presupuestoTotal: montoCOP ? Number(montoCOP) : 0,
        inicio: new Date(inicio),
        fin: new Date(fin),
        notas: notas || null,
        creadoPor: Number(adminId),
        estado: "ACTIVA",
        anuncios: {
          create: {
            modulo: "PRODUCTOS",
            formato: "NATIVO",
            productoId: productoId ? Number(productoId) : null,
            etiqueta: etiqueta?.trim() || tipo,
          }
        }
      },
      include: { comercio: { select: { nombre: true } }, anuncios: true }
    });
    return campana.anuncios[0];
  },

  async listarActivas(tipo, departamento = null) {
    const ahora = new Date();
    const filtroAlcance = departamento
      ? {
          OR: [
            { alcance: "NACIONAL" },
            { alcance: "DEPARTAMENTO", departamento },
            { alcance: "MUNICIPIO", departamento },
          ],
        }
      : {};
    const anuncios = await prisma.anuncioUbicacion.findMany({
      where: {
        activa: true,
        modulo: "PRODUCTOS",
        ...(tipo ? { etiqueta: tipo } : {}),
        campana: {
          estado: "ACTIVA",
          inicio: { lte: ahora },
          fin: { gt: ahora },
        },
        ...filtroAlcance,
      },
      include: {
        campana: { include: { comercio: { select: { id: true, nombre: true } } } },
        producto: {
          select: {
            id: true, nombre: true, precio: true, fotoUrl: true, unidad: true,
            comercio: { select: { id: true, nombre: true, municipio: true, verificado: true, calificacion: true, totalVentas: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return anuncios.map(a => ({
      ...a,
      tipo: a.etiqueta,
      comercio: a.campana?.comercio
    }));
  },

  async listarTodas({ pagina = 1, porPagina = 20 } = {}) {
    const skip = (pagina - 1) * porPagina;
    const [total, items] = await Promise.all([
      prisma.anuncioUbicacion.count({ where: { modulo: "PRODUCTOS" } }),
      prisma.anuncioUbicacion.findMany({
        where: { modulo: "PRODUCTOS" },
        include: {
          campana: { include: { comercio: { select: { nombre: true } }, admin: { select: { nombre: true } } } },
          producto: { select: { nombre: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: porPagina,
      }),
    ]);
    const mapped = items.map(a => ({
      ...a,
      comercio: a.campana?.comercio,
      admin: a.campana?.admin,
      tipo: a.etiqueta
    }));
    return { items: mapped, total, paginas: Math.ceil(total / porPagina), pagina };
  },

  async desactivar(id) {
    return prisma.anuncioUbicacion.update({
      where: { id: Number(id) },
      data: { activa: false },
    });
  },

  async buscarPorId(id) {
    return prisma.anuncioUbicacion.findUnique({ where: { id: Number(id) } });
  },

  async registrarVistaProducto(productoId) {
    const ahora = new Date();
    const slot = await prisma.anuncioUbicacion.findFirst({
      where: { 
        productoId: Number(productoId), 
        activa: true, 
        modulo: "PRODUCTOS",
        campana: { estado: "ACTIVA", inicio: { lte: ahora }, fin: { gt: ahora } } 
      },
      orderBy: { createdAt: "desc" },
    });
    if (!slot) return null;
    return prisma.metricaPublicitaria.create({
      data: { anuncioId: slot.id, tipoEvento: "IMPRESION" }
    });
  },

  async registrarEventoProducto(productoId, tipo, { usuarioId = null, sesionId = null, userAgent = null, referer = null } = {}) {
    const ahora = new Date();
    const slot = await prisma.anuncioUbicacion.findFirst({
      where: { 
        productoId: Number(productoId), 
        activa: true, 
        modulo: "PRODUCTOS",
        campana: { estado: "ACTIVA", inicio: { lte: ahora }, fin: { gt: ahora } } 
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, productoId: true, campana: { select: { comercioId: true } } },
    });
    if (!slot) return null;

    const tipoEvento = tipo === "CARRITO" ? "CARRITO" : "CLIC";
    return prisma.metricaPublicitaria.create({
      data: {
        anuncioId: slot.id,
        tipoEvento,
        usuarioId: usuarioId ? Number(usuarioId) : null,
        sesionId: limpiarTexto(sesionId, 120),
      }
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
    return db.metricaPublicitaria.findFirst({
      where: {
        anuncio: { productoId: Number(productoId) },
        tipoEvento: "CLIC",
        createdAt: { gte: desde, lte: confirmadoAt },
        OR: identidades,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, anuncioId: true, sesionId: true, usuarioId: true },
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
      ? { id: evento.anuncioId }
      : await db.anuncioUbicacion.findFirst({
          where: { 
            productoId: Number(productoId), 
            activa: true, 
            modulo: "PRODUCTOS",
            campana: { estado: "ACTIVA", inicio: { lte: ahora }, fin: { gt: ahora } } 
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
    if (!slot) return null;

    // Idempotente: si el flujo de confirmación de pedido se reprocesa (webhook
    // duplicado, reintento manual), no debe duplicar la atribución de la misma
    // línea de pedido — @@unique([anuncioId, tipoEvento, referenciaExterna]).
    try {
      return await db.metricaPublicitaria.create({
        data: {
          anuncioId: slot.id,
          tipoEvento: "CONVERSION_COMPRA",
          usuarioId: compradorId ? Number(compradorId) : null,
          sesionId: evento?.sesionId || limpiarTexto(sesionId, 120),
          valorAtribuido: Number(subtotal) || 0,
          referenciaExterna: pedidoItemId ? `pedidoItem:${pedidoItemId}` : null,
        },
      });
    } catch (e) {
      if (e.code === "P2002") return null; // ya estaba atribuido, no duplicar
      throw e;
    }
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

  async metricasPorComercio(comercioId) {
    const anuncios = await prisma.anuncioUbicacion.findMany({
      where: {
        modulo: "PRODUCTOS",
        activa: true,
        campana: { comercioId: Number(comercioId), estado: "ACTIVA" },
      },
      include: {
        producto: { select: { id: true, nombre: true } },
        campana: { select: { fin: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (anuncios.length === 0) return [];

    const anuncioIds = anuncios.map((a) => a.id);
    const grupos = await prisma.metricaPublicitaria.groupBy({
      by: ["anuncioId", "tipoEvento"],
      where: { anuncioId: { in: anuncioIds } },
      _count: { _all: true },
      _sum: { valorAtribuido: true },
    });
    const metricasPorAnuncio = new Map(anuncioIds.map((id) => [id, { vistas: 0, clics: 0, carritos: 0, gmvAtribuido: 0 }]));
    for (const g of grupos) {
      const fila = metricasPorAnuncio.get(g.anuncioId);
      if (!fila) continue;
      if (g.tipoEvento === "IMPRESION") fila.vistas = g._count._all;
      else if (g.tipoEvento === "CLIC") fila.clics = g._count._all;
      else if (g.tipoEvento === "CARRITO") fila.carritos = g._count._all;
      else if (g.tipoEvento === "CONVERSION_COMPRA") fila.gmvAtribuido = Number(g._sum.valorAtribuido || 0);
    }

    return anuncios.map((a) => {
      const m = metricasPorAnuncio.get(a.id);
      return {
        id: a.id,
        tipo: a.etiqueta,
        producto: a.producto,
        fin: a.campana?.fin ?? null,
        vistas: m.vistas,
        clics: m.clics,
        carritos: m.carritos,
        gmvAtribuido: m.gmvAtribuido,
      };
    });
  },
};

module.exports = VisibilidadRepository;
