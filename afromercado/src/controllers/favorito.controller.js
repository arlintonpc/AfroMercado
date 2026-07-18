// ============================================================
//  Favoritos de Marketplace (Producto) — consume el modelo Favorito
//  unificado (Anexo B, Fase 1). El contrato de la API no cambia: sigue
//  devolviendo productoId e id de favorito como antes.
// ============================================================
const prisma = require("../config/prisma");

const SELECT_PRODUCTO = {
  id: true, nombre: true, precio: true, fotoUrl: true,
  imagenes: true, unidad: true, activo: true,
  comercio: { select: { id: true, nombre: true, municipio: true } },
  ofertas: {
    where: { activa: true, fin: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
};

const FavoritoController = {
  // GET /api/favoritos  — lista favoritos del usuario
  async listar(req, res, next) {
    try {
      const favs = await prisma.favorito.findMany({
        where: { usuarioId: req.usuario.id, tipoEntidad: "PRODUCTO" },
        orderBy: { createdAt: "desc" },
      });
      const productos = favs.length
        ? await prisma.producto.findMany({ where: { id: { in: favs.map((f) => f.entidadId) } }, select: SELECT_PRODUCTO })
        : [];
      const porId = new Map(productos.map((p) => [p.id, p]));
      const favoritos = favs
        .map((f) => ({ id: f.id, productoId: f.entidadId, createdAt: f.createdAt, producto: porId.get(f.entidadId) }))
        .filter((f) => f.producto);
      res.json({ ok: true, data: favoritos });
    } catch (e) { next(e); }
  },

  // POST /api/favoritos/:productoId  — toggle (agrega o quita)
  async toggle(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const productoId = Number(req.params.productoId);

      const existente = await prisma.favorito.findUnique({
        where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "PRODUCTO", entidadId: productoId } },
      });

      if (existente) {
        await prisma.favorito.delete({ where: { id: existente.id } });
        return res.json({ ok: true, esFavorito: false });
      }

      await prisma.favorito.create({ data: { usuarioId, tipoEntidad: "PRODUCTO", entidadId: productoId } });
      return res.json({ ok: true, esFavorito: true });
    } catch (e) { next(e); }
  },

  // GET /api/favoritos/ids  — solo los IDs para saber cuáles están marcados
  async listarIds(req, res, next) {
    try {
      const favs = await prisma.favorito.findMany({
        where: { usuarioId: req.usuario.id, tipoEntidad: "PRODUCTO" },
        select: { entidadId: true },
      });
      res.json({ ok: true, data: favs.map((f) => f.entidadId) });
    } catch (e) { next(e); }
  },
};

module.exports = FavoritoController;
