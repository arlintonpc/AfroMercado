const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
    const comercio = await prisma.comercio.findFirst();
    
    // Create Campaña
    const campana = await prisma.campanaPublicitaria.create({
      data: {
        nombre: 'Campaña Global de Prueba',
        presupuestoTotal: 5000000,
        inicio: new Date(),
        fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        creadoPor: admin.id,
        comercioId: comercio ? comercio.id : null,
      }
    });

    // Empleos
    const empleos = await prisma.ofertaEmpleo.findMany({ where: { estado: 'PUBLICADA', deletedAt: null } });
    for (const empleo of empleos) {
      await prisma.anuncioUbicacion.create({
        data: {
          campanaId: campana.id,
          modulo: 'EMPLEOS',
          formato: 'NATIVO',
          ofertaEmpleoId: empleo.id,
        }
      });
    }
    console.log(`✅ Inyectados ${empleos.length} anuncios de EMPLEOS`);

    // Productos
    const productos = await prisma.producto.findMany({ where: { activo: true, deletedAt: null } });
    for (const prod of productos) {
      await prisma.anuncioUbicacion.create({
        data: {
          campanaId: campana.id,
          modulo: 'PRODUCTOS',
          formato: 'NATIVO',
          productoId: prod.id,
        }
      });
    }
    console.log(`✅ Inyectados ${productos.length} anuncios de PRODUCTOS`);

    console.log('🎉 Pruebas globales inyectadas correctamente.');

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
