const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.producto.findFirst({where:{nombre: {contains:'Manojo de plantas'}}})
  .then(console.log)
  .finally(() => prisma.$disconnect());
