const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const pubs = await prisma.publicacionCultural.findMany({
      include: {
        comercio: { select: { id: true, nombre: true } }
      }
    });
    console.log("Publicaciones:", pubs.map(p => ({id: p.id, titulo: p.titulo, comercioId: p.comercioId, comercioNombre: p.comercio?.nombre})));
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
