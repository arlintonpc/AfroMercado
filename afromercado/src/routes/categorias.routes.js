// Rutas para categorías de productos
const router = require("express").Router();
const prisma = require("../config/prisma");

router.get("/", async (req, res, next) => {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ categorias });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
