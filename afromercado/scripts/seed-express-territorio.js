// Script puntual: crea productos de prueba (bebidas, platos, postres del
// territorio chocoano/pacífico) con fotos reales para el comercio Express
// "Finca Agroforestal Baudó" (comercioId=1). Uso: node scripts/seed-express-territorio.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = "http://localhost:3001";
const COMERCIO_ID = 1;

async function main() {
  const cfg = await prisma.configExpress.findUnique({ where: { comercioId: COMERCIO_ID } });
  if (!cfg) throw new Error("ConfigExpress no encontrada para comercioId=1");

  let seccionBebidas = await prisma.menuSeccion.findFirst({ where: { configExpressId: cfg.id, nombre: "Bebidas" } });
  if (!seccionBebidas) {
    seccionBebidas = await prisma.menuSeccion.create({
      data: { configExpressId: cfg.id, nombre: "Bebidas", icono: "🥤", orden: 0, vistaCompacta: true },
    });
  }

  let seccionPlatos = await prisma.menuSeccion.findFirst({ where: { configExpressId: cfg.id, nombre: "Platos fuertes" } });
  if (!seccionPlatos) {
    seccionPlatos = await prisma.menuSeccion.create({
      data: { configExpressId: cfg.id, nombre: "Platos fuertes", icono: "🍽️", orden: 1 },
    });
  }

  let seccionPostres = await prisma.menuSeccion.findFirst({ where: { configExpressId: cfg.id, nombre: "Postres" } });
  if (!seccionPostres) {
    seccionPostres = await prisma.menuSeccion.create({
      data: { configExpressId: cfg.id, nombre: "Postres", icono: "🍰", orden: 2 },
    });
  }

  const categoria = await prisma.categoria.findFirst({ where: { nombre: "Gastronomia" } });

  const productos = [
    // Bebidas
    { archivo: "test-express-jugo-borojo.jpg", nombre: "Jugo de Borojó", descripcion: "Jugo de borojó, fruta nativa del Chocó, natural y energizante.", precio: 6000, seccionId: seccionBebidas.id },
    { archivo: "test-express-jugo-chontaduro.jpg", nombre: "Jugo de Chontaduro", descripcion: "Jugo de chontaduro con miel y canela, tradición del Pacífico.", precio: 6000, seccionId: seccionBebidas.id },
    { archivo: "test-express-refresco-corozo.jpg", nombre: "Refresco de Corozo", descripcion: "Refresco de corozo, fruta de palma típica del territorio.", precio: 5000, seccionId: seccionBebidas.id },
    { archivo: "test-express-agua-panela-limon.jpg", nombre: "Agua de Panela con Limón", descripcion: "Agua de panela bien fría con limón.", precio: 4000, seccionId: seccionBebidas.id },

    // Platos fuertes
    { archivo: "test-express-encocado-pescado.jpg", nombre: "Encocado de Pescado", descripcion: "Pescado fresco cocinado en leche de coco, plato insignia del Pacífico chocoano.", precio: 32000, seccionId: seccionPlatos.id },
    { archivo: "test-express-arroz-camarones-coco.jpg", nombre: "Arroz con Camarones y Coco", descripcion: "Arroz con camarones y coco, sabor típico de la costa.", precio: 30000, seccionId: seccionPlatos.id },
    { archivo: "test-express-tapao-pescado.jpg", nombre: "Tapao de Pescado", descripcion: "Pescado tapao con plátano y yuca, cocción lenta tradicional.", precio: 28000, seccionId: seccionPlatos.id },
    { archivo: "test-express-sudado-jaiba.jpg", nombre: "Sudado de Jaiba", descripcion: "Jaiba fresca en sudado con especias del territorio.", precio: 35000, seccionId: seccionPlatos.id },
    { archivo: "test-express-pusandao.jpg", nombre: "Pusandao", descripcion: "Sancocho tradicional del Pacífico con carne salada, pescado seco y plátano.", precio: 30000, seccionId: seccionPlatos.id },

    // Postres
    { archivo: "test-express-cocadas.jpg", nombre: "Cocadas", descripcion: "Cocadas artesanales de coco, dulce tradicional afrocolombiano.", precio: 4000, seccionId: seccionPostres.id },
    { archivo: "test-express-torta-platano.jpg", nombre: "Torta de Plátano Maduro", descripcion: "Torta húmeda de plátano maduro con toque de canela.", precio: 8000, seccionId: seccionPostres.id },
    { archivo: "test-express-manjar-blanco-coco.jpg", nombre: "Manjar Blanco de Coco", descripcion: "Manjar blanco de coco, dulce casero del territorio.", precio: 6000, seccionId: seccionPostres.id },
    { archivo: "test-express-dulce-papaya-coco.jpg", nombre: "Dulce de Papaya con Coco", descripcion: "Dulce de papaya verde con coco rallado.", precio: 6000, seccionId: seccionPostres.id },
  ];

  for (const p of productos) {
    const fotoUrl = `${BASE_URL}/uploads/productos/${p.archivo}`;
    const existente = await prisma.producto.findFirst({ where: { comercioId: COMERCIO_ID, nombre: p.nombre, esExpress: true } });
    if (existente) {
      await prisma.producto.update({
        where: { id: existente.id },
        data: { fotoUrl, imagenes: [fotoUrl], menuSeccionId: p.seccionId, descripcion: p.descripcion, precio: p.precio },
      });
      console.log(`Actualizado: ${p.nombre}`);
      continue;
    }
    await prisma.producto.create({
      data: {
        comercioId: COMERCIO_ID,
        categoriaId: categoria?.id ?? null,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        unidad: "UNIDAD",
        stock: 20,
        fotoUrl,
        imagenes: [fotoUrl],
        activo: true,
        esExpress: true,
        tiempoEntregaMin: 20,
        diasAlistamientoMin: 0,
        diasAlistamientoMax: 0,
        alcance: "LOCAL",
        menuSeccionId: p.seccionId,
      },
    });
    console.log(`Creado: ${p.nombre}`);
  }

  console.log("Listo.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
