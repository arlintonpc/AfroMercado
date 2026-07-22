const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const comercio18 = await prisma.comercio.findUnique({
      where: { id: 18 }
    });
    console.log("Comercio 18:", comercio18);
    
    const cfg18 = await prisma.configExpress.findUnique({
      where: { comercioId: 18 }
    });
    console.log("Config 18:", cfg18);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
