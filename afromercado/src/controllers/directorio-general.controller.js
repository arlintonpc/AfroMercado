// ============================================================
//  Directorio empresarial general — cualquier ciudadano puede buscar
//  cualquier comercio verificado del territorio. Público, sin autenticación.
//  Distinto del directorio B2G (/directorio-compras-publicas): no exige
//  disponibleComprasPublicas, incluye paginación real y ficha de detalle.
// ============================================================
const prisma = require("../config/prisma");

const TAKE_MAXIMO = 24;

const SELECT_TARJETA = {
  id: true,
  nombre: true,
  descripcion: true,
  departamento: true,
  municipio: true,
  whatsapp: true,
  whatsappVisible: true,
  logoUrl: true,
  calificacion: true,
  totalReviews: true,
  verificadoEtnico: true,
  organizacionTerritorialTipo: true,
  productos: {
    where: { activo: true },
    take: 5,
    select: { categoria: { select: { id: true, nombre: true } } },
  },
};

const DirectorioGeneralController = {
  // GET /directorio?departamento&municipio&categoria&buscar&page
  async listar(req, res, next) {
    try {
      const { departamento, municipio, categoria, buscar } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1);

      const where = {
        verificado: true,
        activo: true,
        ...(departamento && { departamento: String(departamento) }),
        ...(municipio && { municipio: String(municipio) }),
        ...(categoria && {
          productos: { some: { activo: true, categoria: { slug: String(categoria) } } },
        }),
        ...(buscar && {
          nombre: { contains: String(buscar), mode: "insensitive" },
        }),
      };

      const [comercios, total] = await Promise.all([
        prisma.comercio.findMany({
          where,
          select: SELECT_TARJETA,
          orderBy: [{ calificacion: "desc" }, { nombre: "asc" }],
          skip: (page - 1) * TAKE_MAXIMO,
          take: TAKE_MAXIMO,
        }),
        prisma.comercio.count({ where }),
      ]);

      res.json({
        ok: true,
        data: comercios,
        paginacion: { page, pageSize: TAKE_MAXIMO, total, totalPaginas: Math.ceil(total / TAKE_MAXIMO) },
      });
    } catch (e) {
      next(e);
    }
  },

  // GET /directorio/:id
  async detalle(req, res, next) {
    try {
      const id = Number(req.params.id);
      const comercio = await prisma.comercio.findFirst({
        where: { id, verificado: true, activo: true },
        select: {
          ...SELECT_TARJETA,
          historia: true,
          videoUrl: true,
          videoPosterUrl: true,
          vereda: true,
          latitud: true,
          longitud: true,
          createdAt: true,
          productos: {
            where: { activo: true },
            take: 12,
            select: {
              id: true,
              nombre: true,
              precio: true,
              fotoUrl: true,
              categoria: { select: { id: true, nombre: true } },
            },
          },
        },
      });

      if (!comercio) {
        return res.status(404).json({ ok: false, mensaje: "Comercio no encontrado" });
      }

      res.json({ ok: true, data: comercio });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = DirectorioGeneralController;
