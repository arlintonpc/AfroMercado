// Rutas para categorías de productos
const router = require("express").Router();
const prisma = require("../config/prisma");

router.get("/", async (req, res, next) => {
  try {
    // Solo categorías hoja (padreId != null): los departamentos son
    // contenedores de agrupación, no se asignan directo a un producto.
    const categorias = await prisma.categoria.findMany({
      where: { activa: true, padreId: { not: null } },
      include: { padre: { select: { id: true, nombre: true, icono: true } } },
      orderBy: { nombre: "asc" },
    });
    res.json({ categorias });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
