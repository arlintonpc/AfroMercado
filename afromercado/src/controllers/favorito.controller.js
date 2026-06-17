const prisma = require("../config/prisma");

const FavoritoController = {
  // GET /api/favoritos  — lista favoritos del usuario
  async listar(req, res, next) {
    try {
      const favoritos = await prisma.favorito.findMany({
        where: { usuarioId: req.usuario.id },
        orderBy: { createdAt: "desc" },
        include: {
          producto: {
            select: {
              id: true, nombre: true, precio: true, fotoUrl: true,
              imagenes: true, unidad: true, activo: true,
              comercio: { select: { id: true, nombre: true, municipio: true } },
              ofertas: {
                where: { activa: true, fin: { gte: new Date() } },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      });
      res.json({ ok: true, data: favoritos });
    } catch (e) { next(e); }
  },

  // POST /api/favoritos/:productoId  — toggle (agrega o quita)
  async toggle(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const productoId = Number(req.params.productoId);

      const existente = await prisma.favorito.findUnique({
        where: { usuarioId_productoId: { usuarioId, productoId } },
      });

      if (existente) {
        await prisma.favorito.delete({ where: { id: existente.id } });
        return res.json({ ok: true, esFavorito: false });
      }

      await prisma.favorito.create({ data: { usuarioId, productoId } });
      return res.json({ ok: true, esFavorito: true });
    } catch (e) { next(e); }
  },

  // GET /api/favoritos/ids  — solo los IDs para saber cuáles están marcados
  async listarIds(req, res, next) {
    try {
      const favs = await prisma.favorito.findMany({
        where: { usuarioId: req.usuario.id },
        select: { productoId: true },
      });
      res.json({ ok: true, data: favs.map((f) => f.productoId) });
    } catch (e) { next(e); }
  },
};

module.exports = FavoritoController;
