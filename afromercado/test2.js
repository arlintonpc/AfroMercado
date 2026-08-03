const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function upsert(clave, valor) {
  return prisma.config.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  });
}

async function main() {
  try {
    const ops = [];
    ops.push(upsert("hero.modo", "FIJAS"));
    ops.push(upsert("hero.fuente", "ORGANICO"));
    ops.push(upsert("hero.badge", "TEST"));
    ops.push(upsert("hero.titulo", "TEST"));
    ops.push(upsert("hero.subtitulo", "TEST"));
    ops.push(upsert("hero.intervaloSegundos", "10"));
    
    await Promise.all(ops);
    console.log("SUCCESS");
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
