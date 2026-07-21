const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Agregando videos de prueba a la vitrina...");

  const comercio1 = await prisma.comercio.findFirst({
    where: { nombre: { contains: "Finca Agroforestal Baudó" } },
    include: { usuario: true }
  });

  const comercio2 = await prisma.comercio.findFirst({
    where: { nombre: { contains: "Mujeres Emprendedoras del Pacífico" } },
    include: { usuario: true }
  });

  if (!comercio1 || !comercio2) {
    console.log("❌ No se encontraron comercios de prueba.");
    return;
  }

  const videos = [
    {
      autorId: comercio1.usuarioId,
      comercioId: comercio1.id,
      titulo: "Cosechando en el río Baudó",
      descripcion: "Descubre nuestra recolección matutina de frutos de la región chocoana. Frescura y tradición en cada entrega.",
      departamento: "Chocó",
      municipio: "Quibdó",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      videoDuracionSegundos: 10,
      moduloOrigen: "PRODUCTO",
      activa: true,
    },
    {
      autorId: comercio2.usuarioId,
      comercioId: comercio2.id,
      titulo: "Nuestras artesanías en Werregue",
      descripcion: "Tejiendo la cultura ancestral. Descubre el proceso de nuestro tejido en palma de werregue.",
      departamento: "Chocó",
      municipio: "Condoto",
      videoUrl: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      videoDuracionSegundos: 15,
      moduloOrigen: "PRODUCTO",
      activa: true,
    },
    {
      autorId: comercio1.usuarioId,
      comercioId: comercio1.id,
      titulo: "Tour lancha río Baudó",
      descripcion: "Ven y disfruta de los increíbles paisajes de la selva y el río, guiados por expertos locales.",
      departamento: "Chocó",
      municipio: "Quibdó",
      videoUrl: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      videoDuracionSegundos: 15,
      moduloOrigen: "TOUR",
      activa: true,
    }
  ];

  for (const video of videos) {
    await prisma.publicacionCultural.create({
      data: video
    });
    console.log(`✔ Video agregado: ${video.titulo}`);
  }

  console.log("\n✅ Test videos seeded.");
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed de videos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
