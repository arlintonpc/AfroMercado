const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const config = await prisma.config.findMany();
    console.log("SUCCESS. Config records:", config);
  } catch (err) {
    console.error("ERROR querying Config:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
