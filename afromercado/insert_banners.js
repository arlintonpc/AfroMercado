const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campana = await prisma.campanaPublicitaria.findFirst({where: {estado: 'ACTIVA'}});
  if (!campana) {
    console.log("No campana");
    return;
  }
  
  await prisma.anuncioUbicacion.create({
    data: {
      campanaId: campana.id,
      modulo: 'EMPLEOS',
      formato: 'BANNER',
      titulo: 'Sabores del Pacífico 🍲',
      subtitulo: 'Pide los mejores mariscos y comida tradicional chocoana a domicilio.',
      mediaUrl: '/demo-restaurante.png',
      urlDestino: '/express',
      ctaTexto: 'Pedir comida',
      etiqueta: 'Patrocinado - Restaurante',
      activa: true,
      alcance: 'NACIONAL'
    }
  });

  await prisma.anuncioUbicacion.create({
    data: {
      campanaId: campana.id,
      modulo: 'EMPLEOS',
      formato: 'BANNER',
      titulo: 'Artesanías Wounaan 🧺',
      subtitulo: 'Canastos y artesanías tejidas a mano por comunidades indígenas del Chocó.',
      mediaUrl: '/demo-productor.png',
      urlDestino: '/vitrina',
      ctaTexto: 'Comprar ahora',
      etiqueta: 'Patrocinado - Productor',
      activa: true,
      alcance: 'NACIONAL'
    }
  });
  console.log("Hecho");
}
main();
