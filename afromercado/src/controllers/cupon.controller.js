const CuponRepository = require("../repositories/cupon.repository");
const prisma = require("../config/prisma");
const Reglas = require("../config/reglas");
const { ErrorValidacion, ErrorNoAutorizado, ErrorNoEncontrado } = require("../utils/errores");

const CuponController = {
  // POST /cupones/validar
  async validar(req, res, next) {
    try {
      const { codigo, subtotal, comercioIds = [], subtotalesPorComercio = null, subtotalesElegibles = null } = req.body;
      if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
        throw new ErrorValidacion("El código de cupón es obligatorio");
      }
      if (subtotal === undefined || isNaN(Number(subtotal)) || Number(subtotal) <= 0) {
        throw new ErrorValidacion("El subtotal debe ser un número positivo");
      }
      const resultado = await CuponRepository.validarParaUsuario(
        codigo.trim().toUpperCase(),
        req.usuario.id,
        Number(subtotal),
        Array.isArray(comercioIds) ? comercioIds.map(Number) : [],
        subtotalesPorComercio,
        subtotalesElegibles
      );
      if (resultado.error) throw new ErrorValidacion(resultado.error);
      res.json({ ok: true, data: resultado });
    } catch (err) {
      next(err);
    }
  },

  // POST /cupones
  async crear(req, res, next) {
    try {
      const {
        codigo, tipo, valor,
        minimoCompra, usosMaximos, usosMaximosPorUsuario,
        inicio, fin, soloNuevos,
        distribucion = "PUBLICO",
        comercioIds = [],
        usuarioIds = [],
        programaNombre,
      } = req.body;

      if (!codigo || !tipo || valor === undefined || !inicio || !fin) {
        throw new ErrorValidacion("Faltan campos obligatorios: codigo, tipo, valor, inicio, fin");
      }
      if (!["PORCENTAJE", "VALOR_FIJO"].includes(tipo)) {
        throw new ErrorValidacion("El tipo debe ser PORCENTAJE o VALOR_FIJO");
      }
      if (!["PUBLICO", "ASIGNADO"].includes(distribucion)) {
        throw new ErrorValidacion("La distribución debe ser PUBLICO o ASIGNADO");
      }
      if (distribucion === "ASIGNADO" && usuarioIds.length === 0) {
        throw new ErrorValidacion("Un cupón ASIGNADO debe tener al menos un usuario");
      }

      const cupon = await CuponRepository.crearAdmin({
        codigo: codigo.trim().toUpperCase(),
        tipo,
        valor: Number(valor),
        minimoCompra: minimoCompra !== undefined ? Number(minimoCompra) : null,
        usosMaximos: usosMaximos !== undefined ? Number(usosMaximos) : null,
        usosMaximosPorUsuario: usosMaximosPorUsuario !== undefined ? Number(usosMaximosPorUsuario) : null,
        inicio: new Date(inicio),
        fin: new Date(fin),
        soloNuevos: soloNuevos ?? false,
        distribucion,
        comercioIds: comercioIds.map(Number),
        usuarioIds: usuarioIds.map(Number),
        programaNombre: programaNombre?.trim() ? programaNombre.trim() : null,
      });
      res.status(201).json({ ok: true, data: cupon });
    } catch (err) {
      next(err);
    }
  },

  // GET /cupones?pagina&porPagina&programaNombre
  async listar(req, res, next) {
    try {
      const pagina = req.query.pagina ? parseInt(req.query.pagina) : 1;
      const porPagina = req.query.porPagina ? parseInt(req.query.porPagina) : 20;
      const resultado = await CuponRepository.listarAdmin({
        pagina, porPagina,
        programaNombre: req.query.programaNombre || undefined,
      });
      res.json({ ok: true, data: resultado });
    } catch (err) {
      next(err);
    }
  },

  // GET /cupones/programas → nombres de programa distintos, para poblar filtros
  async programas(req, res, next) {
    try {
      const data = await CuponRepository.listarProgramas();
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /cupones/:id
  async desactivar(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID de cupón inválido");
      const cupon = await CuponRepository.desactivar(id);
      res.json({ ok: true, data: cupon });
    } catch (err) {
      next(err);
    }
  },

  // ── AUDITORÍA ────────────────────────────────────────────────────

  // GET /cupones/reporte/resumen?desde&hasta
  async resumenGlobal(req, res, next) {
    try {
      const data = await CuponRepository.resumenGlobal({ desde: req.query.desde, hasta: req.query.hasta });
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/reporte/lista
  async listaComparativa(req, res, next) {
    try {
      const items = await CuponRepository.listaComparativa();
      res.json({ ok: true, data: { items } });
    } catch (err) { next(err); }
  },

  // GET /cupones/usos?cuponId&estado&desde&hasta&q&programaNombre&pagina&porPagina
  async logUsos(req, res, next) {
    try {
      const { cuponId, desde, hasta, q, programaNombre, pagina, porPagina } = req.query;
      const estado = req.query.estado ? req.query.estado.split(",") : undefined;
      const data = await CuponRepository.logUsos({
        cuponId: cuponId ? parseInt(cuponId) : undefined,
        estado, desde, hasta, q, programaNombre,
        pagina: pagina ? parseInt(pagina) : 1,
        porPagina: porPagina ? Math.min(parseInt(porPagina), 100) : 50,
      });
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/alertas?cuponId
  async alertasGlobal(req, res, next) {
    try {
      const cuponId = req.query.cuponId ? parseInt(req.query.cuponId) : null;
      const data = await CuponRepository.alertas(cuponId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/auditoria/integridad
  async integridadDatos(req, res, next) {
    try {
      const data = await CuponRepository.integridadDatos();
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/:id/metricas
  async metricas(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID inválido");
      const data = await CuponRepository.metricas(id);
      if (!data) return res.status(404).json({ ok: false, error: "Cupón no encontrado" });
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/:id/usos?estado&desde&hasta&q&programaNombre&pagina&porPagina
  async usosPorCupon(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID inválido");
      const { desde, hasta, q, programaNombre, pagina, porPagina } = req.query;
      const estado = req.query.estado ? req.query.estado.split(",") : undefined;
      const data = await CuponRepository.logUsos({
        cuponId: id, estado, desde, hasta, q, programaNombre,
        pagina: pagina ? parseInt(pagina) : 1,
        porPagina: porPagina ? Math.min(parseInt(porPagina), 100) : 50,
      });
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/:id/serie?intervalo=dia|semana
  async serie(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID inválido");
      const data = await CuponRepository.serie(id, req.query.intervalo ?? "dia");
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/:id/por-comercio
  async porComercio(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID inválido");
      const data = await CuponRepository.porComercio(id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/:id/por-usuario
  async porUsuario(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID inválido");
      const data = await CuponRepository.porUsuario(id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // GET /cupones/comercios  → lista para el selector del admin
  async listarComerciosSelector(req, res, next) {
    try {
      const comercios = await prisma.comercio.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, municipio: true },
        orderBy: { nombre: "asc" },
      });
      res.json({ ok: true, data: comercios });
    } catch (err) {
      next(err);
    }
  },

  // ── CUPONES DEL VENDEDOR (comerciante) ───────────────────────────
  // El comerciante crea cupones SOLO para su propia tienda. Las condiciones
  // (si está permitido y el tope de descuento) las define el Centro de Reglas,
  // así el admin puede ajustarlas sin tocar código.

  // GET /cupones/mis-cupones
  async misCupones(req, res, next) {
    try {
      const [permitido, maxPct] = await Promise.all([
        Reglas.bool("cupon_vendedor_permitido"),
        Reglas.numero("cupon_descuento_max_pct"),
      ]);

      const comercio = await prisma.comercio.findUnique({
        where: { usuarioId: req.usuario.id },
        select: { id: true },
      });
      if (!comercio) {
        return res.json({ ok: true, data: { items: [], reglas: { permitido, maxPct } } });
      }

      const items = await prisma.cupon.findMany({
        where: { comercios: { some: { comercioId: comercio.id } } },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { usos: true } } },
      });

      res.json({ ok: true, data: { items, reglas: { permitido, maxPct } } });
    } catch (err) {
      next(err);
    }
  },

  // POST /cupones/mis-cupones
  async crearComerciante(req, res, next) {
    try {
      const permitido = await Reglas.bool("cupon_vendedor_permitido");
      if (!permitido) {
        throw new ErrorNoAutorizado(
          "Los cupones de vendedor están desactivados por la plataforma en este momento."
        );
      }

      const comercio = await prisma.comercio.findUnique({
        where: { usuarioId: req.usuario.id },
        select: { id: true },
      });
      if (!comercio) throw new ErrorNoAutorizado("No tienes un comercio registrado.");

      const {
        codigo, tipo, valor,
        minimoCompra, usosMaximos, usosMaximosPorUsuario,
        inicio, fin, soloNuevos,
      } = req.body;

      if (!codigo || !tipo || valor === undefined || !inicio || !fin) {
        throw new ErrorValidacion("Faltan campos: código, tipo, valor, inicio y fin.");
      }
      if (!["PORCENTAJE", "VALOR_FIJO"].includes(tipo)) {
        throw new ErrorValidacion("El tipo debe ser PORCENTAJE o VALOR_FIJO.");
      }

      const v = Number(valor);
      if (isNaN(v) || v <= 0) throw new ErrorValidacion("El valor del descuento debe ser mayor a cero.");

      // Tope de descuento del vendedor (configurable)
      const maxPct = await Reglas.numero("cupon_descuento_max_pct");
      if (tipo === "PORCENTAJE" && v > maxPct) {
        throw new ErrorValidacion(`El descuento máximo permitido para tu tienda es ${maxPct}%.`);
      }

      const ini = new Date(inicio);
      const finDate = new Date(fin);
      if (isNaN(ini) || isNaN(finDate)) throw new ErrorValidacion("Fechas inválidas.");
      if (finDate <= ini) throw new ErrorValidacion("La fecha de fin debe ser posterior al inicio.");

      const codigoNorm = codigo.trim().toUpperCase();
      const existente = await prisma.cupon.findUnique({ where: { codigo: codigoNorm }, select: { id: true } });
      if (existente) throw new ErrorValidacion("Ese código ya está en uso. Elige otro.");

      // Forzado: cupón público, restringido SOLO a la tienda del vendedor.
      const cupon = await CuponRepository.crearAdmin({
        codigo: codigoNorm,
        tipo,
        valor: v,
        minimoCompra: minimoCompra !== undefined && minimoCompra !== "" ? Number(minimoCompra) : null,
        usosMaximos: usosMaximos !== undefined && usosMaximos !== "" ? Number(usosMaximos) : null,
        usosMaximosPorUsuario:
          usosMaximosPorUsuario !== undefined && usosMaximosPorUsuario !== "" ? Number(usosMaximosPorUsuario) : null,
        inicio: ini,
        fin: finDate,
        soloNuevos: soloNuevos ?? false,
        distribucion: "PUBLICO",
        comercioIds: [comercio.id],
        usuarioIds: [],
      });
      res.status(201).json({ ok: true, data: cupon });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /cupones/mis-cupones/:id/desactivar
  async desactivarComerciante(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID de cupón inválido.");

      const comercio = await prisma.comercio.findUnique({
        where: { usuarioId: req.usuario.id },
        select: { id: true },
      });
      if (!comercio) throw new ErrorNoAutorizado("No tienes un comercio registrado.");

      // Solo puede desactivar cupones que pertenecen a su tienda.
      const cupon = await prisma.cupon.findFirst({
        where: { id, comercios: { some: { comercioId: comercio.id } } },
        select: { id: true },
      });
      if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado o no pertenece a tu tienda.");

      const actualizado = await CuponRepository.desactivar(id);
      res.json({ ok: true, data: actualizado });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = CuponController;
