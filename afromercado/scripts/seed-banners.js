const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creando Banners Publicitarios de Prueba para Teravia Display Network...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "ModuloAnuncio" ADD VALUE IF NOT EXISTS 'EXPRESS'`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TYPE "ModuloAnuncio" ADD VALUE IF NOT EXISTS 'TRANSPORTE'`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TYPE "ModuloAnuncio" ADD VALUE IF NOT EXISTS 'CULTURA'`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TYPE "ModuloAnuncio" ADD VALUE IF NOT EXISTS 'BIENES_RAICES'`).catch(() => {});

  // 1. Crear una campaña publicitaria activa para el Admin o Comercio
  // Primero buscaremos un comercio al azar para asociarle la campaña
  const comercio = await prisma.comercio.findFirst();
  if (!comercio) {
    console.error('❌ No se encontró ningún comercio en la base de datos para crear la campaña.');
    process.exit(1);
  }

  const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
  if (!admin) {
    console.error('❌ No se encontró ningún admin en la base de datos para crear la campaña.');
    process.exit(1);
  }

  const campana = await prisma.campanaPublicitaria.create({
    data: {
      comercio: { connect: { id: comercio.id } },
      admin: { connect: { id: admin.id } },
      nombre: 'Campaña Global de Lanzamiento 2026',
      presupuestoTotal: 5000000,
      presupuestoGastado: 0,
      inicio: new Date(),
      fin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      estado: 'ACTIVA',
      notas: 'Campaña de prueba para todos los módulos generada por script',
    }
  });

  console.log(`✅ Campaña creada: ${campana.nombre} (ID: ${campana.id})`);

  // 2. Definir los banners para cada módulo
  const anuncios = [
    {
      modulo: 'HOTELES',
      formato: 'BANNER',
      titulo: '🌴 Descubre el Chocó Profundo',
      subtitulo: 'Reserva 3 noches en el Pacífico y la 4ta es gratis. Despierta con el sonido de la selva y el mar.',
      mediaUrl: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/hoteles',
      ctaTexto: 'Reservar Oferta',
      etiqueta: 'Patrocinado'
    },
    {
      modulo: 'TOURS',
      formato: 'BANNER',
      titulo: '🐋 Avistamiento de Ballenas 2026',
      subtitulo: 'La temporada ha comenzado. Vive la majestuosidad de las ballenas jorobadas en Nuquí.',
      mediaUrl: 'https://images.unsplash.com/photo-1682687982501-1e5898cb8f03?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/tours',
      ctaTexto: 'Agendar Tour',
      etiqueta: 'Recomendado'
    },
    {
      modulo: 'EXPRESS',
      formato: 'BANNER',
      titulo: '🌶️ ¡Antojo de Sancocho de Pescado?',
      subtitulo: 'Pídelo ahora por Teravia Express y llévate una lulada gratis con tu pedido mayor a $30.000.',
      mediaUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/express',
      ctaTexto: 'Pedir Ahora',
      etiqueta: 'Promoción Express'
    },
    {
      modulo: 'TRANSPORTE',
      formato: 'BANNER',
      titulo: '🚤 Transporte VIP Quibdó - Istmina',
      subtitulo: 'Viaja cómodo y seguro en nuestras lanchas rápidas de lujo. Salidas cada hora.',
      mediaUrl: 'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/transportes',
      ctaTexto: 'Comprar Pasaje',
      etiqueta: 'Destacado'
    },
    {
      modulo: 'CULTURA',
      formato: 'BANNER',
      titulo: '🥁 Festival de Chirimía Virtual',
      subtitulo: 'Revive los mejores momentos del último festival de chirimía chocoana. Cultura en alta definición.',
      mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/cultura',
      ctaTexto: 'Ver Videos',
      etiqueta: 'Evento'
    },
    {
      modulo: 'BIENES_RAICES',
      formato: 'BANNER',
      titulo: '🏡 Tu Nuevo Hogar en Nuquí',
      subtitulo: 'Proyectos de vivienda sostenible con vista al mar. Invierte en el paraíso del Pacífico.',
      mediaUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/bienes-raices',
      ctaTexto: 'Ver Proyectos',
      etiqueta: 'Inversión'
    },
    {
      modulo: 'VITRINA',
      formato: 'BANNER',
      titulo: '🛍️ Emprendedores de Quibdó',
      subtitulo: 'Apoya el talento local comprando en la Vitrina Comercial de Teravia. Calidad y tradición.',
      mediaUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/vitrina',
      ctaTexto: 'Ir a Tienda',
      etiqueta: 'Anuncio Local'
    },
    {
      modulo: 'VITRINA', // También aplicará a Agro y Catálogo porque usan 'VITRINA'
      formato: 'BANNER',
      titulo: '🌾 Cacao Orgánico Certificado',
      subtitulo: 'Del campo a tu mesa. Disfruta del mejor cacao producido por familias de la región.',
      mediaUrl: 'https://images.unsplash.com/photo-1626244795325-10255c26b97b?auto=format&fit=crop&q=80&w=1200',
      urlDestino: '/agro',
      ctaTexto: 'Comprar Cacao',
      etiqueta: 'Agro Destacado'
    }
  ];

  for (const anuncio of anuncios) {
    const act = await prisma.anuncioUbicacion.create({
      data: {
        campanaId: campana.id,
        modulo: anuncio.modulo,
        formato: anuncio.formato,
        titulo: anuncio.titulo,
        subtitulo: anuncio.subtitulo,
        mediaUrl: anuncio.mediaUrl,
        urlDestino: anuncio.urlDestino,
        ctaTexto: anuncio.ctaTexto,
        etiqueta: anuncio.etiqueta,
        activa: true,
      }
    });
    console.log(`✅ Anuncio creado para ${anuncio.modulo}: ${anuncio.titulo} (ID: ${act.id})`);
  }

  console.log('🎉 ¡Todos los banners de prueba han sido creados exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error al ejecutar el script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
