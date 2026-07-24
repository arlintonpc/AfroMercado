const { aplicarMigracionesSeguras } = require("../src/utils/migrador");
const prisma = require("../src/config/prisma");

async function main() {
  console.log("🚀 Iniciando migración DDL dedicada para Neon DB...");
  try {
    await aplicarMigracionesSeguras();
    console.log("✅ Migración DDL completada exitosamente.");
  } catch (err) {
    console.error("❌ Error en migración DDL:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
