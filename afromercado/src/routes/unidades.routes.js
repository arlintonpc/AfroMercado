// Rutas públicas para unidades de venta (Kilo, Unidad, Litro...)
const router = require("express").Router();
const prisma = require("../config/prisma");

router.get("/", async (req, res, next) => {
  try {
    const unidades = await prisma.unidadDeVenta.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
    });
    res.json({ unidades });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
