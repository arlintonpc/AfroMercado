const prisma = require("../config/prisma");

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
      where: { activa: true, fin: { gt: ahora }, ...(tipo ? { tipo } : {}) },
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
      where: { productoId: Number(productoId), activa: true, fin: { gt: ahora } },
      orderBy: { createdAt: "desc" },
    });
    if (!slot) return null;
    return prisma.visibilidadPagada.update({
      where: { id: slot.id },
      data: { vistas: { increment: 1 } },
    });
  },

  // Devuelve los slots activos de un comercio con sus métricas de vistas.
  async metricasPorComercio(comercioId) {
    const ahora = new Date();
    return prisma.visibilidadPagada.findMany({
      where: { comercioId: Number(comercioId), activa: true, fin: { gt: ahora } },
      select: {
        id: true, tipo: true, inicio: true, fin: true, vistas: true,
        producto: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};

module.exports = VisibilidadRepository;
