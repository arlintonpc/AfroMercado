const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const banners = await prisma.anuncioUbicacion.findMany({
      where: { 
        modulo: 'EXPRESS', 
        formato: 'BANNER', 
      }
    });
    console.log("Banners:", banners.map(b => ({id: b.id, titulo: b.titulo, url: b.urlDestino})));
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
