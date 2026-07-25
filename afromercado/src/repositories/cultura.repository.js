const prisma = require("../config/prisma");
const { filtroComercioVisible } = require("../utils/comercio-publicacion");

const CulturaRepository = {
  // ── Publicaciones comunitarias ("Comparte tu Chocó") ──────────
  async crearPublicacion(data) {
    return prisma.publicacionCultural.create({ data });
  },

  async listarPublicaciones({ departamento, municipio, autorId, page = 1, take = 20, usuarioId } = {}) {
    const where = {
      activa: true,
      comercioId: null, // feed personal "Comparte tu Chocó" — nunca mezcla contenido comercial de la vitrina
      ...(departamento ? { departamento: { equals: departamento, mode: "insensitive" } } : {}),
      ...(municipio ? { municipio: { equals: municipio, mode: "insensitive" } } : {}),
      ...(autorId ? { autorId: Number(autorId) } : {}),
    };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.publicacionCultural.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          autor: { select: { id: true, nombre: true, avatarUrl: true, _count: { select: { seguidoresUsuarios: true } } } },
          _count: { select: { likes: true } },
          ...(usuarioId ? { likes: { where: { usuarioId }, select: { id: true } } } : {}),
        },
      }),
      prisma.publicacionCultural.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },

  // ── Vitrina de video (v0) — publicaciones de comercio ("moduloOrigen") ──
  // v0.2: ya no pagina directo en SQL — trae una ventana acotada de las
  // publicaciones más recientes (candidatos a rankear) y deja que
  // CulturaService.listarVitrina aplique el puntaje heurístico y la
  // paginación en memoria sobre esa ventana. `total` sigue siendo el count()
  // real, sin el límite de la ventana.
  async listarVitrina({ departamento, municipio, modulo, search, page = 1, usuarioId } = {}) {
    const where = {
      activa: true,
      comercioId: { not: null },
      comercio: filtroComercioVisible(),
      ...(departamento ? { departamento: { equals: departamento, mode: "insensitive" } } : {}),
      ...(municipio ? { municipio: { equals: municipio, mode: "insensitive" } } : {}),
      ...(modulo ? { moduloOrigen: modulo } : {}),
      ...(search ? { titulo: { contains: search, mode: "insensitive" } } : {}),
    };
    const [itemsVentana, total] = await Promise.all([
      prisma.publicacionCultural.findMany({
        where,
        take: 200,
        orderBy: { createdAt: "desc" },
        include: {
          autor: { select: { id: true, nombre: true, avatarUrl: true, _count: { select: { seguidoresUsuarios: true } } } },
          comercio: {
            select: {
              id: true,
              nombre: true,
              logoUrl: true,
              whatsapp: true,
              whatsappVisible: true,
              municipio: true,
              departamento: true,
              activo: true,
              verificado: true,
              estadoRegistro: true,
              fotoDocumentoUrl: true,
              fotoDocumentoFrenteUrl: true,
              fotoDocumentoReversoUrl: true,
              cuentaDispersion: { select: { estado: true } },
              _count: { select: { seguidores: true } },
            },
          },
          producto: { select: { id: true, nombre: true, precio: true, fotoUrl: true, esExpress: true, comercioId: true } },
          _count: { select: { likes: true, comentarios: true, vistas: true } },
          ...(usuarioId ? { likes: { where: { usuarioId }, select: { id: true } } } : {}),
        },
      }),
      prisma.publicacionCultural.count({ where }),
    ]);
    return { itemsVentana, total, pagina: Math.max(1, Number(page)) };
  },

  async buscarPublicacionPorId(id) {
    return prisma.publicacionCultural.findUnique({
      where: { id },
      include: {
        comercio: { select: { id: true, nombre: true, departamento: true, municipio: true, logoUrl: true } },
        autor: { select: { id: true, nombre: true, avatarUrl: true } },
        producto: { select: { id: true, nombre: true, precio: true, fotoUrl: true } },
      },
    });
  },

  async ocultarPublicacion(id) {
    return prisma.publicacionCultural.update({ where: { id }, data: { activa: false } });
  },

  async listarMisPublicaciones(comercioId, page = 1, take = 20) {
    const where = { comercioId };
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.publicacionCultural.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { vistas: true, likes: true, comentarios: true } },
          producto: { select: { id: true, nombre: true, comercioId: true, esExpress: true } },
        },
      }),
      prisma.publicacionCultural.count({ where }),
    ]);
    return { items, total, pagina: Math.max(1, Number(page)) };
  },

  async actualizarMiPublicacion(id, comercioId, data) {
    return prisma.publicacionCultural.update({
      where: { id, comercioId },
      data,
    });
  },

  async eliminarPublicacion(id, comercioId) {
    return prisma.publicacionCultural.delete({
      where: { id, comercioId },
    });
  },

  // ── Denuncias de publicaciones ─────────────────────────────────
  async crearDenunciaPublicacion(data) {
    return prisma.denunciaPublicacionCultural.create({ data });
  },

  async buscarDenunciaPublicacion(publicacionCulturalId, denuncianteId) {
    return prisma.denunciaPublicacionCultural.findUnique({
      where: { publicacionCulturalId_denuncianteId: { publicacionCulturalId, denuncianteId } },
    });
  },

  async buscarDenunciaPublicacionPorId(id) {
    return prisma.denunciaPublicacionCultural.findUnique({
      where: { id },
      include: { publicacion: true },
    });
  },

  async listarDenunciasPublicacionPendientes() {
    return prisma.denunciaPublicacionCultural.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        publicacion: { include: { autor: { select: { id: true, nombre: true } } } },
        denunciante: { select: { id: true, nombre: true } },
      },
    });
  },

  async actualizarDenunciaPublicacion(id, data) {
    return prisma.denunciaPublicacionCultural.update({ where: { id }, data });
  },

  // ── Historias Efímeras 24h ───────────────────────────────────
  async crearHistoria(data) {
    return prisma.historiaEfimera.create({
      data,
      include: {
        autor: { select: { id: true, nombre: true, avatarUrl: true } },
        comercio: { select: { id: true, nombre: true, logoUrl: true, departamento: true, municipio: true } },
      },
    });
  },

  async buscarHistoriaPorId(id) {
    return prisma.historiaEfimera.findUnique({
      where: { id },
      include: {
        autor: { select: { id: true, nombre: true, avatarUrl: true } },
        comercio: { select: { id: true, nombre: true, logoUrl: true, usuarioId: true } },
      },
    });
  },

  async listarHistoriasActivas({ usuarioId, departamento, municipio }) {
    const ahora = new Date();
    const where = {
      expiraAt: { gt: ahora },
      ...(departamento ? { comercio: { departamento: { equals: departamento, mode: "insensitive" } } } : {}),
      ...(municipio ? { comercio: { municipio: { equals: municipio, mode: "insensitive" } } } : {}),
    };

    const historias = await prisma.historiaEfimera.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        autor: { select: { id: true, nombre: true, avatarUrl: true } },
        comercio: { select: { id: true, nombre: true, logoUrl: true, departamento: true, municipio: true } },
        ...(usuarioId ? { vistas: { where: { usuarioId }, select: { id: true } } } : {}),
      },
    });

    // Agrupar por Comercio (si comercioId existe) o Autor (si personal)
    const gruposMap = new Map();
    for (const h of historias) {
      const clave = h.comercioId ? `C_${h.comercioId}` : `U_${h.autorId}`;
      if (!gruposMap.has(clave)) {
        gruposMap.set(clave, {
          id: clave,
          comercioId: h.comercioId ?? null,
          autorId: h.autorId,
          nombre: h.comercio ? h.comercio.nombre : h.autor.nombre,
          avatarUrl: h.comercio ? h.comercio.logoUrl : h.autor.avatarUrl,
          esComercio: !!h.comercioId,
          historias: [],
          vistasTodas: true,
        });
      }
      const grupo = gruposMap.get(clave);
      const yaVisto = usuarioId ? (h.vistas && h.vistas.length > 0) : false;
      grupo.historias.push({
        ...h,
        visto: yaVisto,
      });
      if (!yaVisto) {
        grupo.vistasTodas = false;
      }
    }

    return Array.from(gruposMap.values());
  },

  async registrarVistaHistoria({ historiaId, usuarioId, sesionId }) {
    if (usuarioId) {
      const existe = await prisma.vistaHistoriaEfimera.findUnique({
        where: { historiaId_usuarioId: { historiaId, usuarioId } },
      });
      if (!existe) {
        await prisma.$transaction([
          prisma.vistaHistoriaEfimera.create({
            data: { historiaId, usuarioId, sesionId },
          }),
          prisma.historiaEfimera.update({
            where: { id: historiaId },
            data: { vistasCount: { increment: 1 } },
          }),
        ]);
      }
    } else {
      await prisma.$transaction([
        prisma.vistaHistoriaEfimera.create({
          data: { historiaId, usuarioId: null, sesionId },
        }),
        prisma.historiaEfimera.update({
          where: { id: historiaId },
          data: { vistasCount: { increment: 1 } },
        }),
      ]);
    }
  },

  async eliminarHistoria(id) {
    return prisma.historiaEfimera.delete({ where: { id } });
  },
};

module.exports = CulturaRepository;
