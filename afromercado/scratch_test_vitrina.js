const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CulturaService = require('./src/services/cultura.service');

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE MÉTRICAS DE VITRINA ===");
  
  try {
    // 1. Encontrar o crear un usuario y comercio de prueba
    let usuario = await prisma.usuario.findFirst({ where: { rol: 'COMERCIANTE' } });
    if (!usuario) {
      console.log("No se encontró comerciante. Cancelando prueba.");
      return;
    }
    const comercio = await prisma.comercio.findUnique({ where: { usuarioId: usuario.id } });
    if (!comercio) {
      console.log("El usuario no tiene comercio asociado.");
      return;
    }

    // 2. Crear publicación de prueba
    console.log(`\n1. Creando publicación de prueba para el comercio ${comercio.nombre}...`);
    const publicacion = await prisma.publicacionCultural.create({
      data: {
        autorId: usuario.id,
        comercioId: comercio.id,
        titulo: 'Video de Prueba Automatizada',
        descripcion: 'Prueba de métricas',
        departamento: 'Chocó',
        videoUrl: 'https://example.com/video.mp4',
        moduloOrigen: 'EXPRESS',
      }
    });
    console.log(`✅ Publicación creada con ID: ${publicacion.id}`);

    // 3. Simular interacciones (Vistas, Likes, Compartidos)
    console.log("\n2. Simulando interacciones...");
    
    // Compartidos
    await CulturaService.registrarCompartido(publicacion.id);
    await CulturaService.registrarCompartido(publicacion.id);
    await CulturaService.registrarCompartido(publicacion.id);
    console.log("✅ 3 compartidos registrados.");

    // Vistas
    await CulturaService.registrarVista(null, publicacion.id, { deviceId: 'test-device-1' });
    await CulturaService.registrarVista(null, publicacion.id, { deviceId: 'test-device-2' });
    console.log("✅ 2 vistas registradas.");

    // Likes
    await CulturaService.toggleLikePublicacion(usuario.id, publicacion.id);
    console.log("✅ 1 like registrado.");

    // Comentarios
    await CulturaService.crearComentario(usuario.id, publicacion.id, { texto: "¡Excelente video de prueba!" });
    console.log("✅ 1 comentario registrado.");

    // 4. Obtener las métricas a través del servicio
    console.log("\n3. Obteniendo las métricas del dashboard del comerciante...");
    const dashboard = await CulturaService.misPublicacionesVitrina(usuario.id, { page: 1 });
    const miPub = dashboard.items.find(p => p.id === publicacion.id);

    console.log("\n=== RESULTADOS DE LAS MÉTRICAS ===");
    console.log(`Total Vistas esperadas: 2 | Obtenidas: ${miPub.totalVistas}`);
    console.log(`Total Likes esperados: 1 | Obtenidos: ${miPub.totalLikes}`);
    console.log(`Total Comentarios esperados: 1 | Obtenidos: ${miPub.totalComentarios}`);
    console.log(`Total Compartidos esperados: 3 | Obtenidos: ${miPub.totalCompartidos}`);

    if (
      miPub.totalVistas === 2 &&
      miPub.totalLikes === 1 &&
      miPub.totalComentarios === 1 &&
      miPub.totalCompartidos === 3
    ) {
      console.log("\n✅ ¡TODAS LAS MÉTRICAS FUNCIONAN CORRECTAMENTE!");
    } else {
      console.log("\n❌ ERROR: Alguna métrica no coincide.");
    }

    // Limpieza
    console.log("\n4. Limpiando datos de prueba...");
    await prisma.publicacionCultural.delete({ where: { id: publicacion.id } });
    console.log("✅ Datos limpiados.");

  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
