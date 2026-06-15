// Cliente Prisma único compartido en toda la app (patrón singleton)
// Evita abrir múltiples conexiones a la base de datos.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

module.exports = prisma;
