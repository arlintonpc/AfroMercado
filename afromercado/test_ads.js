const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
    if (!admin) throw new Error('No admin found');

    const comercio = await prisma.comercio.findFirst();
    
    // Create Campaña
    const campana = await prisma.campanaPublicitaria.create({
      data: {
        nombre: 'Campaña de Prueba ' + new Date().getTime(),
        presupuestoTotal: 500000,
        inicio: new Date(),
        fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        creadoPor: admin.id,
        comercioId: comercio ? comercio.id : null,
      }
    });

    console.log(`✅ Campaña creada: ${campana.id}`);

    // 1. Vitrina (Video para inyectar en feed de Cultura/Vitrina)
    await prisma.anuncioUbicacion.create({
      data: {
        campanaId: campana.id,
        modulo: 'VITRINA',
        formato: 'VIDEO',
        titulo: '🌟 Conoce el Chocó Profundo',
        subtitulo: 'Reserva ahora tu experiencia.',
        mediaUrl: 'https://res.cloudinary.com/dkuiqobnp/video/upload/f_mp4,q_auto,w_960/v1783393910/afromercado/publicaciones-cultura/gjey1z4kqlhnupwpze98.mp4',
        urlDestino: '/tours',
        ctaTexto: 'Reservar',
      }
    });
    console.log(`✅ Anuncio VITRINA (Video) creado`);

    // 2. Empleo
    const empleo = await prisma.ofertaEmpleo.findFirst({ where: { estado: 'PUBLICADA', deletedAt: null } });
    if (empleo) {
      await prisma.anuncioUbicacion.create({
        data: {
          campanaId: campana.id,
          modulo: 'EMPLEOS',
          formato: 'NATIVO',
          ofertaEmpleoId: empleo.id,
        }
      });
      console.log(`✅ Anuncio EMPLEOS creado (Oferta: ${empleo.id})`);
    } else {
      console.log(`⚠️ No hay ofertas de empleo publicadas para patrocinar.`);
    }

    // 3. Producto (Marketplace General)
    const producto = await prisma.producto.findFirst({ where: { deletedAt: null, publico: true } });
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
      console.log(`⚠️ No hay productos públicos para patrocinar.`);
    }

    console.log('🎉 Pruebas inyectadas correctamente.');

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
