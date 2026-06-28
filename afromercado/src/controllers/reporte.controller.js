// Controlador de reportería — AfroMercado
// Todos los endpoints resuelven comercioId desde el token, nunca del cliente.
const ComercioService = require("../services/comercio.service");
const ReporteRepository = require("../repositories/reporte.repository");
const { generarExcelVentasComercio, generarExcelAdmin } = require("../services/reporteExcel.service");
const { ErrorValidacion } = require("../utils/errores");

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILAS = 50000;

function validarFechas(desde, hasta) {
  if (desde && !RE_FECHA.test(desde)) throw new ErrorValidacion("'desde' debe ser YYYY-MM-DD");
  if (hasta && !RE_FECHA.test(hasta)) throw new ErrorValidacion("'hasta' debe ser YYYY-MM-DD");
  if (desde && hasta && desde > hasta) throw new ErrorValidacion("'desde' no puede ser posterior a 'hasta'");
}

// ─── Comerciante ─────────────────────────────────────────────────────────────
const ReporteController = {

  // GET /reportes/comercio/resumen?desde&hasta&estados&cupon
  async resumenComercio(req, res, next) {
    try {
      const { desde, hasta, estados, cupon: conCupon } = req.query;
      validarFechas(desde, hasta);
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const data = await ReporteRepository.resumenComercio({
        comercioId: comercio.id, desde, hasta, estados, conCupon,
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/comercio/ventas?desde&hasta&estados&cupon&productoId&pagina&porPagina&q
  async ventasComercio(req, res, next) {
    try {
      const { desde, hasta, estados, cupon: conCupon, productoId, pagina = 1, porPagina = 20 } = req.query;
      validarFechas(desde, hasta);
      const pag = Math.max(1, Number(pagina));
      const pp  = Math.min(100, Math.max(1, Number(porPagina)));
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const data = await ReporteRepository.ventasPagina(
        { comercioId: comercio.id, desde, hasta, estados, conCupon, productoId },
        pag, pp,
      );
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/comercio/productos?desde&hasta
  async productosComercio(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const data = await ReporteRepository.productosConMetricas({ comercioId: comercio.id, desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/comercio/resenas?pagina&estrellas
  async resenasComercio(req, res, next) {
    try {
      const { pagina = 1, estrellas } = req.query;
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const data = await ReporteRepository.resenasComercio({
        comercioId: comercio.id, pagina: Number(pagina), estrellas,
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/comercio/serie?desde&hasta
  async serieComercio(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const data = await ReporteRepository.serieComercio({ comercioId: comercio.id, desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/comercio/exportar?desde&hasta&estados&cupon&productoId
  async exportarVentasComercio(req, res, next) {
    try {
      const { desde, hasta, estados, cupon: conCupon, productoId } = req.query;
      validarFechas(desde, hasta);

      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const filtros  = { comercioId: comercio.id, desde, hasta, estados, conCupon, productoId };

      const [resumen, productos] = await Promise.all([
        ReporteRepository.resumenComercio(filtros),
        ReporteRepository.productosConMetricas(filtros),
      ]);

      const nombre = `AfroMercado_Ventas_${(comercio.nombre ?? "comercio").replace(/\s+/g, "_")}_${desde ?? "inicio"}_a_${hasta ?? "hoy"}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
      res.setHeader("Cache-Control", "no-store");

      await generarExcelVentasComercio({
        res,
        comercio,
        filtros,
        subPedidosGen: ReporteRepository.ventasTodas(filtros),
        productos,
        resumen,
      });
    } catch (e) {
      if (res.headersSent) return res.destroy(e);
      next(e);
    }
  },

  // ─── Admin ────────────────────────────────────────────────────────────────

  // GET /reportes/admin/dashboard?desde&hasta
  async dashboardAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.dashboardAdmin({ desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/serie?desde&hasta
  async serieAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.serieAdmin({ desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/municipios?desde&hasta
  async municipiosAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.ingresosPorMunicipio({ desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/comercios?desde&hasta&limite
  async rankingAdmin(req, res, next) {
    try {
      const { desde, hasta, limite = 20 } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.rankingComercios({ desde, hasta, limite: Number(limite) });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/riesgo
  async riesgoAdmin(req, res, next) {
    try {
      const data = await ReporteRepository.comerciosEnRiesgo();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/cohortes
  async cohortesAdmin(req, res, next) {
    try {
      const data = await ReporteRepository.cohortesRetencion();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/cupones-roi?desde&hasta
  async cuponesROIAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.cuponesROI({ desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/categorias?desde&hasta&limite
  async categoriasAdmin(req, res, next) {
    try {
      const { desde, hasta, limite = 50 } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.categoriasAdmin({ desde, hasta, limite: Number(limite) });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/productos?desde&hasta&limite
  async productosAdmin(req, res, next) {
    try {
      const { desde, hasta, limite = 50 } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.productosAdmin({ desde, hasta, limite: Number(limite) });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/territorios?desde&hasta&limite
  async territoriosAdmin(req, res, next) {
    try {
      const { desde, hasta, limite = 80 } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.territoriosAdmin({ desde, hasta, limite: Number(limite) });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/pagos?desde&hasta
  async pagosAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.pagosAdmin({ desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/logistica?desde&hasta&limite
  async logisticaAdmin(req, res, next) {
    try {
      const { desde, hasta, limite = 40 } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.logisticaAdmin({ desde, hasta, limite: Number(limite) });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/clientes?desde&hasta&limite
  async clientesAdmin(req, res, next) {
    try {
      const { desde, hasta, limite = 50 } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.clientesAdmin({ desde, hasta, limite: Number(limite) });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/alertas?desde&hasta
  async alertasAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);
      const data = await ReporteRepository.alertasAdmin({ desde, hasta });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /reportes/admin/exportar?desde&hasta
  async exportarAdmin(req, res, next) {
    try {
      const { desde, hasta } = req.query;
      validarFechas(desde, hasta);

      const [
        kpis,
        serieData,
        municipios,
        ranking,
        cuponesROI,
        categorias,
        productos,
        territorios,
        pagos,
        logistica,
        clientes,
        alertas,
      ] = await Promise.all([
        ReporteRepository.dashboardAdmin({ desde, hasta }),
        ReporteRepository.serieAdmin({ desde, hasta }),
        ReporteRepository.ingresosPorMunicipio({ desde, hasta }),
        ReporteRepository.rankingComercios({ desde, hasta }),
        ReporteRepository.cuponesROI({ desde, hasta }),
        ReporteRepository.categoriasAdmin({ desde, hasta }),
        ReporteRepository.productosAdmin({ desde, hasta }),
        ReporteRepository.territoriosAdmin({ desde, hasta }),
        ReporteRepository.pagosAdmin({ desde, hasta }),
        ReporteRepository.logisticaAdmin({ desde, hasta }),
        ReporteRepository.clientesAdmin({ desde, hasta }),
        ReporteRepository.alertasAdmin({ desde, hasta }),
      ]);

      const nombre = `AfroMercado_Admin_${desde ?? "inicio"}_a_${hasta ?? "hoy"}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
      res.setHeader("Cache-Control", "no-store");

      await generarExcelAdmin({
        res,
        filtros: { desde, hasta },
        kpis,
        serieData,
        municipios,
        ranking,
        cuponesROI,
        categorias,
        productos,
        territorios,
        pagos,
        logistica,
        clientes,
        alertas,
        subPedidosGen: ReporteRepository.adminExcelStream({ desde, hasta }),
      });
    } catch (e) {
      if (res.headersSent) return res.destroy(e);
      next(e);
    }
  },
};

module.exports = ReporteController;
