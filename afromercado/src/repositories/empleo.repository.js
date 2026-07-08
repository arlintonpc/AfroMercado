const prisma = require("../config/prisma");

const EmpleoRepository = {
  // ── Ofertas ──────────────────────────────────────────────────
  async crearOferta(data) {
    return prisma.ofertaEmpleo.create({ data });
  },

  async buscarOfertaPorId(id) {
    return prisma.ofertaEmpleo.findUnique({
      where: { id },
      include: {
        publicadoPor: { select: { id: true, nombre: true } },
        comercio: { select: { id: true, nombre: true, verificado: true, logoUrl: true } },
      },
    });
  },

  async actualizarOferta(id, data) {
    return prisma.ofertaEmpleo.update({ where: { id }, data });
  },

  async listarPublicas({ municipio, departamento, categoria, tipoContrato, search, salarioMin, salarioMax, page = 1, take = 20 }) {
    const min = salarioMin != null && salarioMin !== "" ? Number(salarioMin) : null;
    const max = salarioMax != null && salarioMax !== "" ? Number(salarioMax) : null;
    // Rango solapado: la oferta califica si [oferta.salarioMin, oferta.salarioMax]
    // se cruza con [min, max] pedido. Si el usuario pidió un rango de salario y la
    // oferta no tiene salario definido, se excluye (no hay forma de comparar).
    const filtroSalario = [];
    if (min != null || max != null) {
      filtroSalario.push({ salarioMin: { not: null } }, { salarioMax: { not: null } });
      if (min != null) filtroSalario.push({ salarioMax: { gte: min } });
      if (max != null) filtroSalario.push({ salarioMin: { lte: max } });
    }
    const where = {
      estado: "PUBLICADA",
      estadoModeracion: "APROBADA",
      deletedAt: null,
      OR: [{ fechaCierre: null }, { fechaCierre: { gte: new Date() } }],
      ...(municipio ? { municipio: { contains: municipio, mode: "insensitive" } } : {}),
      ...(departamento ? { departamento: { equals: departamento, mode: "insensitive" } } : {}),
      ...(categoria ? { categoria: { contains: categoria, mode: "insensitive" } } : {}),
      ...(tipoContrato ? { tipoContrato } : {}),
      ...(search ? { titulo: { contains: search, mode: "insensitive" } } : {}),
      ...(filtroSalario.length ? { AND: filtroSalario } : {}),
    };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.ofertaEmpleo.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          publicadoPor: { select: { id: true, nombre: true } },
          comercio: { select: { id: true, nombre: true, verificado: true, logoUrl: true } },
        },
      }),
      prisma.ofertaEmpleo.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },

  async listarPorPublicador(usuarioId) {
    return prisma.ofertaEmpleo.findMany({
      where: { publicadoPorId: usuarioId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { postulaciones: true } } },
    });
  },

  async listarPendientesModeracion() {
    return prisma.ofertaEmpleo.findMany({
      where: { estadoModeracion: "PENDIENTE", deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { publicadoPor: { select: { id: true, nombre: true, email: true } } },
    });
  },

  async listarOtrasDelPublicador(publicadoPorId, excluirOfertaId, take = 5) {
    return prisma.ofertaEmpleo.findMany({
      where: {
        publicadoPorId,
        id: { not: excluirOfertaId },
        estado: "PUBLICADA",
        estadoModeracion: "APROBADA",
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  // ── Favoritos ────────────────────────────────────────────────
  async buscarFavorito(usuarioId, ofertaEmpleoId) {
    return prisma.favoritoOfertaEmpleo.findUnique({
      where: { usuarioId_ofertaEmpleoId: { usuarioId, ofertaEmpleoId } },
    });
  },

  async crearFavorito(usuarioId, ofertaEmpleoId) {
    return prisma.favoritoOfertaEmpleo.create({ data: { usuarioId, ofertaEmpleoId } });
  },

  async eliminarFavorito(id) {
    return prisma.favoritoOfertaEmpleo.delete({ where: { id } });
  },

  async listarFavoritos(usuarioId) {
    const favs = await prisma.favoritoOfertaEmpleo.findMany({
      where: { usuarioId },
      orderBy: { createdAt: "desc" },
      include: {
        oferta: {
          include: {
            publicadoPor: { select: { id: true, nombre: true } },
            comercio: { select: { id: true, nombre: true, verificado: true, logoUrl: true } },
          },
        },
      },
    });
    return favs.map((f) => f.oferta);
  },

  // ── Hoja de vida ─────────────────────────────────────────────
  async buscarHojaDeVida(usuarioId) {
    return prisma.hojaDeVida.findUnique({ where: { usuarioId } });
  },

  async upsertHojaDeVida(usuarioId, data) {
    return prisma.hojaDeVida.upsert({
      where: { usuarioId },
      update: data,
      create: { usuarioId, ...data },
    });
  },

  async actualizarCv(usuarioId, cvUrl) {
    return prisma.hojaDeVida.update({ where: { usuarioId }, data: { cvUrl } });
  },

  // ── Postulaciones ────────────────────────────────────────────
  async crearPostulacion(data) {
    return prisma.postulacionEmpleo.create({ data });
  },

  async buscarPostulacion(ofertaEmpleoId, postulanteId) {
    return prisma.postulacionEmpleo.findUnique({
      where: { ofertaEmpleoId_postulanteId: { ofertaEmpleoId, postulanteId } },
    });
  },

  async listarPostulacionesDeOferta(ofertaEmpleoId) {
    return prisma.postulacionEmpleo.findMany({
      where: { ofertaEmpleoId },
      orderBy: { createdAt: "desc" },
      include: { postulante: { select: { id: true, nombre: true, email: true, telefono: true } } },
    });
  },

  async listarPostulacionesDeUsuario(postulanteId) {
    return prisma.postulacionEmpleo.findMany({
      where: { postulanteId },
      orderBy: { createdAt: "desc" },
      include: { oferta: { select: { id: true, titulo: true, municipio: true, estado: true } } },
    });
  },

  async buscarPostulacionPorId(id) {
    return prisma.postulacionEmpleo.findUnique({
      where: { id },
      include: { oferta: true },
    });
  },

  async actualizarPostulacion(id, data) {
    return prisma.postulacionEmpleo.update({ where: { id }, data });
  },

  async contarPostulacionesPorEstado(ofertaEmpleoId, estado) {
    return prisma.postulacionEmpleo.count({ where: { ofertaEmpleoId, estado } });
  },

  // ── Denuncias ────────────────────────────────────────────────
  async crearDenuncia(data) {
    return prisma.denunciaOfertaEmpleo.create({ data });
  },

  async buscarDenuncia(ofertaEmpleoId, denuncianteId) {
    return prisma.denunciaOfertaEmpleo.findUnique({
      where: { ofertaEmpleoId_denuncianteId: { ofertaEmpleoId, denuncianteId } },
    });
  },

  async buscarDenunciaPorId(id) {
    return prisma.denunciaOfertaEmpleo.findUnique({
      where: { id },
      include: { oferta: true },
    });
  },

  async listarDenunciasPendientes() {
    return prisma.denunciaOfertaEmpleo.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        oferta: { include: { publicadoPor: { select: { id: true, nombre: true, email: true } } } },
        denunciante: { select: { id: true, nombre: true, email: true } },
      },
    });
  },

  async actualizarDenuncia(id, data) {
    return prisma.denunciaOfertaEmpleo.update({ where: { id }, data });
  },

  async cerrarTodasLasOfertasDelUsuario(publicadoPorId, adminId, motivo) {
    return prisma.ofertaEmpleo.updateMany({
      where: { publicadoPorId, estado: { not: "CERRADA" }, deletedAt: null },
      data: {
        estado: "CERRADA",
        estadoModeracion: "RECHAZADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        motivoRechazoModeracion: motivo,
      },
    });
  },

  async resolverDenunciasPendientesDelUsuario(publicadoPorId, nuevoEstado, adminId, motivo) {
    return prisma.denunciaOfertaEmpleo.updateMany({
      where: { estado: "PENDIENTE", oferta: { publicadoPorId } },
      data: {
        estado: nuevoEstado,
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo,
      },
    });
  },
};

module.exports = EmpleoRepository;
