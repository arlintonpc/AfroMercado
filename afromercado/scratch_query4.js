const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const configs = await prisma.configExpress.findMany({
      where: { activo: true },
      include: {
        comercio: { select: { id: true, nombre: true } }
      }
    });
    console.log("Comercios Express Activos:");
    configs.forEach(c => {
      console.log(`- ConfigID: ${c.id}, ComercioID: ${c.comercioId}, Nombre: ${c.comercio?.nombre}`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
