const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const campana = await prisma.campanaPublicitaria.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    if (!campana) throw new Error('Campaña no encontrada');

    // 3. Producto (Marketplace General)
    const producto = await prisma.producto.findFirst({ where: { activo: true } });
    if (producto) {
      await prisma.anuncioUbicacion.create({
        data: {
          campanaId: campana.id,
          modulo: 'PRODUCTOS',
          formato: 'NATIVO',
          productoId: producto.id,
        }
      });
      console.log(`✅ Anuncio PRODUCTOS creado (Producto: ${producto.id})`);
    } else {
      console.log(`⚠️ No hay productos activos para patrocinar.`);
    }

    console.log('🎉 Fix inyectado correctamente.');

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
