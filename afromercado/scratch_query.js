const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const comercioId = 18; // or whatever id it is
    
    // First let's find the ID of "Pescado y Patacón"
    const comercios = await prisma.comercio.findMany({
      where: { nombre: { contains: 'Pescado' } }
    });
    console.log("Comercios found:", comercios.map(c => ({id: c.id, nombre: c.nombre})));
    
    if (comercios.length > 0) {
      const cid = comercios[0].id;
      const cfg = await prisma.configExpress.findUnique({
        where: { comercioId: cid }
      });
      console.log("Config:", cfg);
      
      const ExpressService = require('./src/services/express.service');
      const menu = await ExpressService.obtenerMenuComercio(cid);
      console.log("Menu has products:", menu ? menu.productos.length : null);
    }
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
