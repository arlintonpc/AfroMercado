const CuponRepository = require("../repositories/cupon.repository");
const prisma = require("../config/prisma");
const { ErrorValidacion } = require("../utils/errores");

const CuponController = {
  // POST /cupones/validar
  async validar(req, res, next) {
    try {
      const { codigo, subtotal, comercioIds = [] } = req.body;
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
        Array.isArray(comercioIds) ? comercioIds.map(Number) : []
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
      });
      res.status(201).json({ ok: true, data: cupon });
    } catch (err) {
      next(err);
    }
  },

  // GET /cupones
  async listar(req, res, next) {
    try {
      const pagina = req.query.pagina ? parseInt(req.query.pagina) : 1;
      const porPagina = req.query.porPagina ? parseInt(req.query.porPagina) : 20;
      const resultado = await CuponRepository.listarAdmin({ pagina, porPagina });
      res.json({ ok: true, data: resultado });
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

  // GET /cupones/usos?cuponId&estado&desde&hasta&q&pagina&porPagina
  async logUsos(req, res, next) {
    try {
      const { cuponId, desde, hasta, q, pagina, porPagina } = req.query;
      const estado = req.query.estado ? req.query.estado.split(",") : undefined;
      const data = await CuponRepository.logUsos({
        cuponId: cuponId ? parseInt(cuponId) : undefined,
        estado, desde, hasta, q,
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

  // GET /cupones/:id/usos?estado&desde&hasta&q&pagina&porPagina
  async usosPorCupon(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID inválido");
      const { desde, hasta, q, pagina, porPagina } = req.query;
      const estado = req.query.estado ? req.query.estado.split(",") : undefined;
      const data = await CuponRepository.logUsos({
        cuponId: id, estado, desde, hasta, q,
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
};

module.exports = CuponController;
