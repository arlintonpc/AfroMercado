const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const p18 = await prisma.producto.findUnique({
      where: { id: 18 },
      include: { comercio: { select: { nombre: true } } }
    });
    console.log("Producto 18:", p18);
    
    // also check if any producto is named "Muchel" or "Bocachico"
    const prods = await prisma.producto.findMany({
      where: {
        OR: [
          { nombre: { contains: 'Muchel' } },
          { nombre: { contains: 'Bocachico' } },
        ]
      },
      include: { comercio: { select: { nombre: true } } }
    });
    console.log("Found products:", prods.map(p => ({id: p.id, nombre: p.nombre, activo: p.activo, comercio: p.comercio?.nombre})));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
