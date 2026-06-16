const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado } = require("../utils/errores");
const { calcularPrecioOferta, ofertaTieneCupo } = require("../utils/ofertas");

const TIPOS = ["PORCENTAJE", "VALOR_FIJO"];

const OfertaController = {
  /* GET /api/ofertas/activas — catálogo público con ofertas */
  async listarActivas(req, res, next) {
    try {
      const ahora = new Date();
      const { porPagina = 12 } = req.query;
      const items = await prisma.oferta.findMany({
        where: { activa: true, inicio: { lte: ahora }, fin: { gte: ahora } },
        orderBy: { createdAt: "desc" },
        take: Number(porPagina),
        include: {
          producto: {
            include: {
              comercio: {
                select: { id: true, nombre: true, municipio: true, verificado: true, totalVentas: true, calificacion: true },
              },
            },
          },
        },
      });
      // Solo productos activos con stock
      const visibles = items.filter(o =>
        o.producto.activo &&
        o.producto.stock > o.producto.stockReservado &&
        ofertaTieneCupo(o)
      );
      res.json({ ok: true, items: visibles });
    } catch (err) { next(err); }
  },

  /* POST /api/comerciante/ofertas — comerciante crea oferta */
  async crear(req, res, next) {
    try {
      const { productoId, tipo, valor, etiqueta, inicio, fin, stockLimite } = req.body;

      if (!productoId || !tipo || !valor || !inicio || !fin)
        throw new ErrorValidacion("productoId, tipo, valor, inicio y fin son requeridos.");
      if (!TIPOS.includes(tipo))
        throw new ErrorValidacion("Tipo inválido. Use PORCENTAJE o VALOR_FIJO.");

      const v = Number(valor);
      if (isNaN(v) || v <= 0) throw new ErrorValidacion("El valor del descuento debe ser mayor a cero.");
      if (tipo === "PORCENTAJE" && v > 80) throw new ErrorValidacion("El descuento máximo es 80%.");

      const ini = new Date(inicio);
      const finDate = new Date(fin);
      if (finDate <= ini) throw new ErrorValidacion("La fecha de fin debe ser posterior al inicio.");
      const duracionH = (finDate - ini) / 3600_000;
      if (duracionH < 1) throw new ErrorValidacion("La oferta debe durar al menos 1 hora.");
      if (duracionH > 30 * 24) throw new ErrorValidacion("La oferta no puede durar más de 30 días.");

      // Verificar propiedad del producto
      const comercio = await prisma.comercio.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      if (!comercio) throw new ErrorNoAutorizado("No tienes un comercio registrado.");

      const producto = await prisma.producto.findUnique({ where: { id: Number(productoId) }, select: { id: true, comercioId: true, precio: true } });
      if (!producto) throw new ErrorNoEncontrado("Producto no encontrado.");
      if (producto.comercioId !== comercio.id) throw new ErrorNoAutorizado("Ese producto no te pertenece.");

      // Solo 1 oferta activa por producto
      const activa = await prisma.oferta.findFirst({
        where: { productoId: Number(productoId), activa: true, fin: { gte: new Date() } },
      });
      if (activa) throw new ErrorValidacion("Este producto ya tiene una oferta activa. Desactívala primero.");

      // Validar que el precio final sea >= 500 (mínimo razonable en COP)
      const pf = calcularPrecioOferta(producto.precio, { tipo, valor: v });
      if (pf < 500) throw new ErrorValidacion("El precio con descuento quedaría demasiado bajo.");

      const oferta = await prisma.oferta.create({
        data: {
          productoId: Number(productoId),
          tipo,
          valor: v,
          etiqueta: etiqueta?.trim() || null,
          inicio: ini,
          fin: finDate,
          stockLimite: stockLimite ? Number(stockLimite) : null,
        },
      });
      res.status(201).json({ ok: true, oferta });
    } catch (err) { next(err); }
  },

  /* GET /api/comerciante/ofertas — mis ofertas */
  async misOfertas(req, res, next) {
    try {
      const comercio = await prisma.comercio.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      if (!comercio) return res.json({ ok: true, items: [] });

      const items = await prisma.oferta.findMany({
        where: { producto: { comercioId: comercio.id } },
        orderBy: { createdAt: "desc" },
        include: { producto: { select: { id: true, nombre: true, precio: true, fotoUrl: true } } },
      });
      res.json({ ok: true, items });
    } catch (err) { next(err); }
  },

  /* PATCH /api/comerciante/ofertas/:id/desactivar */
  async desactivar(req, res, next) {
    try {
      const comercio = await prisma.comercio.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      if (!comercio) throw new ErrorNoAutorizado("Sin comercio.");

      const oferta = await prisma.oferta.findUnique({
        where: { id: Number(req.params.id) },
        include: { producto: { select: { comercioId: true } } },
      });
      if (!oferta) throw new ErrorNoEncontrado("Oferta no encontrada.");
      if (oferta.producto.comercioId !== comercio.id) throw new ErrorNoAutorizado("No puedes desactivar esta oferta.");

      await prisma.oferta.update({ where: { id: oferta.id }, data: { activa: false } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = OfertaController;
