const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
    
    // Create Campaña
    const campana = await prisma.campanaPublicitaria.create({
      data: {
        nombre: 'Campaña Display Cruzada',
        presupuestoTotal: 1000000,
        inicio: new Date(),
        fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        creadoPor: admin.id,
      }
    });

    // Crear banner para Empleos
    await prisma.anuncioUbicacion.create({
      data: {
        campanaId: campana.id,
        modulo: 'EMPLEOS', // Va a salir en la sección de Empleos
        formato: 'BANNER', // Formato de Display
        titulo: 'Hotel Selva Dorada 🌴',
        subtitulo: 'Descansa en el corazón del Chocó. Habitaciones desde $80.000.',
        mediaUrl: 'https://res.cloudinary.com/dkuiqobnp/image/upload/f_auto,q_auto,w_800/v1738733221/afromercado/hoteles/1738733215286-905151590-hoteles_choco1.jpg.jpg',
        urlDestino: '/hoteles',
        ctaTexto: 'Reservar ahora',
        etiqueta: 'Patrocinado - Turismo',
      }
    });

    console.log(`✅ Banner de Hotel inyectado en Empleos.`);
    console.log('🎉 Pruebas de banner inyectadas correctamente.');

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
