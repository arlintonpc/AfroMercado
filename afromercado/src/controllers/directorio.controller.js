// ============================================================
//  Directorio de proveedores certificados (Módulo C institucional)
//  Público, sin autenticación. Solo vitrina de descubrimiento para compra
//  pública local (B2G) — nunca dinero, factura ni checkout en la plataforma.
// ============================================================
const prisma = require("../config/prisma");

const DirectorioController = {
  // GET /directorio-compras-publicas?departamento&municipio&categoria
  async listar(req, res, next) {
    try {
      const { departamento, municipio, categoria } = req.query;

      const where = {
        disponibleComprasPublicas: true,
        verificado: true,
        activo: true,
        ...(departamento && { departamento: String(departamento) }),
        ...(municipio && { municipio: String(municipio) }),
        ...(categoria && {
          productos: { some: { activo: true, categoria: { slug: String(categoria) } } },
        }),
      };

      const comercios = await prisma.comercio.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          departamento: true,
          municipio: true,
          whatsapp: true,
          whatsappVisible: true,
          logoUrl: true,
          verificadoEtnico: true,
          organizacionTerritorialTipo: true,
          productos: {
            where: { activo: true },
            take: 5,
            select: { categoria: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: { nombre: "asc" },
        take: 200,
      });

      res.json({ ok: true, data: comercios });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = DirectorioController;
