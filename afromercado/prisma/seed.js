// ============================================================
//  Seed de datos reales — AfroMercado
//  Idempotente: se puede correr varias veces sin duplicar.
//  Uso: npm run seed
// ============================================================
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const RONDAS_BCRYPT = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

/**
 * Crea o actualiza un usuario por email. Solo hashea la contraseña si el
 * usuario aún no existe (evita re-hashear en cada corrida).
 */
async function upsertUsuario({ nombre, email, telefono, password, rol }) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return prisma.usuario.update({
      where: { email },
      data: { nombre, telefono, rol },
    });
  }
  const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
  return prisma.usuario.create({
    data: { nombre, email, telefono, passwordHash, rol },
  });
}

/**
 * Crea o actualiza el comercio del usuario dado (Comercio.usuarioId es único).
 */
async function upsertComercio(usuarioId, datos) {
  return prisma.comercio.upsert({
    where: { usuarioId },
    update: { ...datos },
    create: { usuarioId, ...datos },
  });
}

/**
 * Crea un producto si no existe ya uno con el mismo nombre en ese comercio.
 */
async function upsertProducto(comercioId, categoriaId, datos) {
  const existente = await prisma.producto.findFirst({
    where: { comercioId, nombre: datos.nombre },
  });
  if (existente) {
    return prisma.producto.update({
      where: { id: existente.id },
      data: { ...datos, comercioId, categoriaId },
    });
  }
  return prisma.producto.create({
    data: { ...datos, comercioId, categoriaId },
  });
}

async function main() {
  console.log("🌱 Sembrando datos de AfroMercado...\n");

  // ── 0. Categorías ───────────────────────────────────────────
  const CATEGORIAS_SEED = [
    { nombre: "Del campo",            slug: "del-campo",           icono: "🌿" },
    { nombre: "Frutas tropicales",    slug: "frutas-tropicales",   icono: "🍊" },
    { nombre: "Cacao y chocolate",    slug: "cacao-chocolate",     icono: "🍫" },
    { nombre: "Artesanías",           slug: "artesanias",          icono: "🎨" },
    { nombre: "Plantas medicinales",  slug: "plantas-medicinales", icono: "🌱" },
    { nombre: "Madera y muebles",     slug: "madera-muebles",      icono: "🪵" },
    { nombre: "Tejidos y textiles",   slug: "tejidos-textiles",    icono: "🧶" },
    { nombre: "Productos del mar",    slug: "productos-del-mar",   icono: "🐟" },
  ];
  for (const cat of CATEGORIAS_SEED) {
    await prisma.categoria.upsert({
      where:  { slug: cat.slug },
      update: { nombre: cat.nombre, icono: cat.icono },
      create: { ...cat, activa: true },
    });
  }
  console.log(`✔ Categorías: ${CATEGORIAS_SEED.length} registradas`);

  // ── 1. Admin ────────────────────────────────────────────────
  const admin = await upsertUsuario({
    nombre: "Admin AfroMercado",
    email: "admin@afromercado.co",
    telefono: "3009990000",
    password: "Admin123",
    rol: "ADMIN",
  });
  console.log(`✔ Admin: ${admin.email} (id ${admin.id})`);

  // ── 2. Comprador ────────────────────────────────────────────
  const comprador = await upsertUsuario({
    nombre: "María Comatá",
    email: "comprador@test.co",
    telefono: "3101112233",
    password: "Comprador123",
    rol: "COMPRADOR",
  });
  console.log(`✔ Comprador: ${comprador.email} (id ${comprador.id})`);

  // ── 3. Comerciantes + Comercios ─────────────────────────────
  const comerciantesSpec = [
    {
      usuario: {
        nombre: "Don Eladio Mosquera",
        email: "baudo@afromercado.co",
        telefono: "3201112233",
        password: "Comercio123",
      },
      comercio: {
        nombre: "Finca Agroforestal Baudó",
        municipio: "Quibdó",
        whatsapp: "3201112233",
        descripcion: "Cultivos agroforestales del Baudó.",
        historia:
          "Tres generaciones cultivando borojó de forma ancestral en las riberas " +
          "del río Baudó, respetando los ciclos de la selva chocoana y las prácticas " +
          "heredadas de nuestros abuelos.",
        verificado: true,
        totalVentas: 47,
        calificacion: 4.8,
        totalReviews: 12,
      },
    },
    {
      usuario: {
        nombre: "Asociación Campesina Atrato",
        email: "atrato@afromercado.co",
        telefono: "3202223344",
        password: "Comercio123",
      },
      comercio: {
        nombre: "Asociación Campesina Atrato",
        municipio: "Istmina",
        whatsapp: "3202223344",
        descripcion: "Cooperativa de familias campesinas del Atrato medio.",
        historia:
          "Familias campesinas unidas para llevar al país los frutos del Atrato " +
          "con prácticas limpias y comercio justo.",
        verificado: true,
        totalVentas: 23,
        calificacion: 4.6,
        totalReviews: 8,
      },
    },
    {
      usuario: {
        nombre: "Cooperativa Cacao Chocó",
        email: "cacao@afromercado.co",
        telefono: "3203334455",
        password: "Comercio123",
      },
      comercio: {
        nombre: "Cooperativa Cacao Chocó",
        municipio: "Tadó",
        whatsapp: "3203334455",
        descripcion: "Cacao fino de aroma cultivado en Tadó.",
        historia:
          "Productores de cacao fino de aroma reconocido internacionalmente, " +
          "cultivado bajo sombra en el corazón del Chocó.",
        verificado: true,
        totalVentas: 61,
        calificacion: 4.9,
        totalReviews: 19,
      },
    },
    {
      usuario: {
        nombre: "Mujeres Emprendedoras del Pacífico",
        email: "mujeres@afromercado.co",
        telefono: "3204445566",
        password: "Comercio123",
      },
      comercio: {
        nombre: "Mujeres Emprendedoras del Pacífico",
        municipio: "Condoto",
        whatsapp: "3204445566",
        descripcion: "Colectivo de mujeres emprendedoras del Pacífico chocoano.",
        historia:
          "Mujeres del Pacífico transformando productos ancestrales en " +
          "oportunidades para sus familias y comunidades.",
        verificado: true,
        totalVentas: 0,
        calificacion: 0,
        totalReviews: 0,
      },
    },
  ];

  const comerciosPorNombre = {};
  for (const spec of comerciantesSpec) {
    const u = await upsertUsuario({ ...spec.usuario, rol: "COMERCIANTE" });
    const c = await upsertComercio(u.id, spec.comercio);
    comerciosPorNombre[c.nombre] = c;
    console.log(`✔ Comercio: ${c.nombre} — ${c.municipio} (id ${c.id})`);
  }

  // ── 4. Productos ────────────────────────────────────────────
  const categoriasTodas = await prisma.categoria.findMany();
  const catPorSlug = Object.fromEntries(categoriasTodas.map((c) => [c.slug, c]));
  const categoriaDefault = catPorSlug["del-campo"];
  if (!categoriaDefault) {
    throw new Error('No se encontró la categoría con slug "del-campo".');
  }

  const productosSpec = [
    {
      comercio: "Finca Agroforestal Baudó",
      nombre: "Borojó Fresco del Baudó",
      descripcion: "Borojó fresco recién cosechado, ideal para jugos energizantes.",
      precio: 18000,
      unidad: "KG",
      pesoKg: 1,
      diasAlistamientoMin: 2,
      diasAlistamientoMax: 4,
      alcance: "NACIONAL",
      // Mercado de fruta tropical exótica (no existe foto de borojó en Unsplash).
      fotoUrl:
        "https://images.unsplash.com/photo-1683476656066-c48bfc06621e?w=800&q=80&auto=format&fit=crop",
    },
    {
      comercio: "Asociación Campesina Atrato",
      nombre: "Plátano Hartón Orgánico",
      descripcion: "Plátano hartón orgánico cultivado en el Atrato medio.",
      precio: 4500,
      unidad: "MANOJO",
      pesoKg: 3,
      diasAlistamientoMin: 1,
      diasAlistamientoMax: 3,
      alcance: "NACIONAL",
      fotoUrl:
        "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=800&q=80&auto=format&fit=crop",
    },
    {
      comercio: "Cooperativa Cacao Chocó",
      nombre: "Cacao Fino de Aroma Nativo",
      descripcion: "Cacao fino de aroma nativo, fermentado y secado al sol.",
      precio: 32000,
      unidad: "KG",
      pesoKg: 1,
      diasAlistamientoMin: 3,
      diasAlistamientoMax: 7,
      alcance: "NACIONAL",
      fotoUrl:
        "https://images.unsplash.com/photo-1743252878695-367d69dc87a8?w=800&q=80&auto=format&fit=crop",
    },
    {
      comercio: "Mujeres Emprendedoras del Pacífico",
      nombre: "Aceite de Chocolatillo",
      descripcion: "Aceite artesanal de chocolatillo, extraído de forma tradicional.",
      precio: 25000,
      unidad: "LITRO",
      pesoKg: 1,
      diasAlistamientoMin: 4,
      diasAlistamientoMax: 8,
      alcance: "NACIONAL",
      fotoUrl:
        "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80&auto=format&fit=crop",
    },
    {
      comercio: "Cooperativa Cacao Chocó",
      nombre: "Panela Negra Artesanal",
      descripcion: "Panela negra artesanal de trapiche tradicional.",
      precio: 8000,
      unidad: "PAQUETE",
      pesoKg: 0.5,
      diasAlistamientoMin: 2,
      diasAlistamientoMax: 5,
      alcance: "AMBOS",
      fotoUrl:
        "https://images.unsplash.com/photo-1775817590687-f1da5d70d9ad?w=800&q=80&auto=format&fit=crop",
    },
    {
      comercio: "Asociación Campesina Atrato",
      nombre: "Piña Perolera Dulce",
      descripcion: "Piña perolera dulce, cosechada en su punto óptimo de madurez.",
      precio: 6000,
      unidad: "UNIDAD",
      pesoKg: 1.5,
      diasAlistamientoMin: 1,
      diasAlistamientoMax: 2,
      alcance: "LOCAL",
      fotoUrl:
        "https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?w=800&q=80&auto=format&fit=crop",
    },
    // ── Artesanías ──
    {
      comercio: "Mujeres Emprendedoras del Pacífico",
      categoriaSlug: "artesanias",
      nombre: "Canasto de Werregue tejido a mano",
      descripcion: "Canasto tradicional tejido en fibra de werregue por mujeres del Litoral Pacífico. Pieza única, hecha a mano.",
      precio: 120000,
      unidad: "UNIDAD",
      pesoKg: 0.8,
      diasAlistamientoMin: 5,
      diasAlistamientoMax: 12,
      alcance: "NACIONAL",
    },
    {
      comercio: "Mujeres Emprendedoras del Pacífico",
      categoriaSlug: "artesanias",
      nombre: "Bolso artesanal en fibra natural",
      descripcion: "Bolso tejido a mano con fibras naturales del Pacífico chocoano. Resistente y con identidad.",
      precio: 85000,
      unidad: "UNIDAD",
      pesoKg: 0.5,
      diasAlistamientoMin: 4,
      diasAlistamientoMax: 9,
      alcance: "NACIONAL",
    },
    {
      comercio: "Mujeres Emprendedoras del Pacífico",
      categoriaSlug: "artesanias",
      nombre: "Individuales tejidos (juego x4)",
      descripcion: "Juego de 4 individuales de mesa tejidos a mano en fibra natural. Decoración con raíces del Chocó.",
      precio: 55000,
      unidad: "PAQUETE",
      pesoKg: 0.6,
      diasAlistamientoMin: 3,
      diasAlistamientoMax: 8,
      alcance: "NACIONAL",
    },
  ];

  for (const p of productosSpec) {
    const comercio = comerciosPorNombre[p.comercio];
    if (!comercio) throw new Error(`Comercio no encontrado: ${p.comercio}`);
    const { comercio: _omit, categoriaSlug: _cat, ...datos } = p;
    const cat = (p.categoriaSlug && catPorSlug[p.categoriaSlug]) || categoriaDefault;
    const prod = await upsertProducto(comercio.id, cat.id, {
      ...datos,
      stock: 50,
      stockReservado: 0,
      fotoUrl: p.fotoUrl,
      activo: true,
    });
    console.log(`✔ Producto: ${prod.nombre} ($${prod.precio}) — ${p.comercio}`);
  }

  console.log("\n✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
