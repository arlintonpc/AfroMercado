const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  let comercio = await prisma.comercio.findFirst({
    where: { activo: true },
    include: { productos: { take: 2 } }
  });
  if (!comercio) { console.log('No comercio found'); return; }
  
  // Make commerce pass filtroComercioVisible
  comercio = await prisma.comercio.update({
    where: { id: comercio.id },
    data: {
      verificado: true,
      estadoRegistro: "APROBADO",
      fotoDocumentoReversoUrl: "https://example.com/rev.jpg",
      fotoDocumentoFrenteUrl: "https://example.com/frente.jpg",
    },
    include: { productos: { take: 2 } }
  });

  console.log('Using commerce:', comercio.nombre, '- Forced to visible.');
  
  // Activar productos
  if (comercio.productos.length) {
     await prisma.producto.updateMany({
        where: { comercioId: comercio.id },
        data: { activo: true }
     });
  }
  
  // Agregar seguidores de prueba al comercio
  await prisma.seguidorComercio.createMany({
    data: Array.from({ length: 45 }).map((_, i) => ({
       comercioId: comercio.id,
       usuarioId: 1
    })),
    skipDuplicates: true
  });
  
  for (let i = 1; i <= 3; i++) {
    const p = comercio.productos[i % comercio.productos.length];
    
    // Crear publicación
    const pub = await prisma.publicacionCultural.create({
      data: {
        autorId: comercio.usuarioId,
        titulo: 'Demostración Producto ' + (p ? p.nombre : i),
        descripcion: 'Este video muestra la calidad de nuestros productos en el territorio. Compra ya!',
        departamento: comercio.departamento || 'Chocó',
        municipio: comercio.municipio || 'Quibdó',
        comercioId: comercio.id,
        productoId: p ? p.id : null,
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        fotoUrls: [],
      }
    });
    
    // Crear vistas
    await prisma.vistaPublicacionCultural.createMany({
      data: Array.from({ length: 25 * i }).map((_, j) => ({
         publicacionCulturalId: pub.id,
         sesionId: 'test-session-' + pub.id + '-' + j,
         duracionSegundos: 5
      })),
      skipDuplicates: true
    });
    
    console.log('Created post:', pub.titulo);
  }
  console.log('Done creating tests');
}
main().catch(console.error).finally(() => prisma.$disconnect());
