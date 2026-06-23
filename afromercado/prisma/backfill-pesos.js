// ============================================================
//  Backfill de pesos de producto.
//  Asigna un peso por defecto (kg) a los productos que NO tienen
//  peso configurado, según su unidad de venta, para que el cálculo
//  de envío sea realista. Es idempotente: solo toca los que están
//  en null. Los vendedores luego pueden ajustar el peso real desde
//  "Editar producto".
//
//  Uso (una vez, en la shell de Render):  npm run backfill:pesos
// ============================================================
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Peso aproximado por unidad de venta (kg).
const PESO_POR_UNIDAD = {
  KG: 1,
  LITRO: 1,
  MANOJO: 3,
  PAQUETE: 0.5,
  DOCENA: 1,
  UNIDAD: 1,
};
const PESO_DEFECTO = 1;

async function main() {
  const sinPeso = await prisma.producto.findMany({
    where: { pesoKg: null },
    select: { id: true, nombre: true, unidad: true },
  });

  console.log(`Productos sin peso: ${sinPeso.length}`);
  let n = 0;
  for (const p of sinPeso) {
    const peso = PESO_POR_UNIDAD[p.unidad] ?? PESO_DEFECTO;
    await prisma.producto.update({ where: { id: p.id }, data: { pesoKg: peso } });
    console.log(`  ✓ ${p.nombre} (${p.unidad}) → ${peso} kg`);
    n++;
  }
  console.log(`\nListo. ${n} producto(s) actualizado(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
