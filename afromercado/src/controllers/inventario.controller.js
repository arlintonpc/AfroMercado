const InventarioService = require("../services/inventario.service");

const InventarioController = {
  async resumen(req, res, next) {
    try { res.json({ ok: true, data: await InventarioService.resumen(req.usuario.id) }); }
    catch (error) { next(error); }
  },
  async listarProveedores(req, res, next) {
    try { res.json({ ok: true, proveedores: await InventarioService.listarProveedores(req.usuario.id) }); }
    catch (error) { next(error); }
  },
  async crearProveedor(req, res, next) {
    try { res.status(201).json({ ok: true, proveedor: await InventarioService.crearProveedor(req.usuario.id, req.body) }); }
    catch (error) { next(error); }
  },
  async recibirCompra(req, res, next) {
    try { res.status(201).json({ ok: true, compra: await InventarioService.crearCompraRecibida(req.usuario.id, req.body) }); }
    catch (error) { next(error); }
  },
  async registrarAjuste(req, res, next) {
    try { res.status(201).json({ ok: true, movimiento: await InventarioService.registrarAjuste(req.usuario.id, req.body) }); }
    catch (error) { next(error); }
  },
  async listarMovimientos(req, res, next) {
    try {
      const movimientos = await InventarioService.listarMovimientos(req.usuario.id, req.query);
      res.json({ ok: true, movimientos });
    } catch (error) { next(error); }
  },
  async crearGasto(req, res, next) {
    try { res.status(201).json({ ok: true, gasto: await InventarioService.crearGasto(req.usuario.id, req.body) }); }
    catch (error) { next(error); }
  },
  async listarGastos(req, res, next) {
    try { res.json({ ok: true, gastos: await InventarioService.listarGastos(req.usuario.id, req.query) }); }
    catch (error) { next(error); }
  },
  async resumenFinanciero(req, res, next) {
    try { res.json({ ok: true, data: await InventarioService.resumenFinanciero(req.usuario.id, req.query) }); }
    catch (error) { next(error); }
  },
  async crearCuentaOperativa(req, res, next) {
    try { res.status(201).json({ ok: true, cuenta: await InventarioService.crearCuentaOperativa(req.usuario.id, req.body) }); }
    catch (error) { next(error); }
  },
  async listarCuentasOperativas(req, res, next) {
    try { res.json({ ok: true, cuentas: await InventarioService.listarCuentasOperativas(req.usuario.id, req.query) }); }
    catch (error) { next(error); }
  },
  async registrarAbono(req, res, next) {
    try { res.status(201).json({ ok: true, movimiento: await InventarioService.registrarAbono(req.usuario.id, req.params.id, req.body) }); }
    catch (error) { next(error); }
  },
  async resumenCaja(req, res, next) {
    try { res.json({ ok: true, data: await InventarioService.resumenCaja(req.usuario.id, req.query) }); }
    catch (error) { next(error); }
  },
  async exportarFinanzas(req, res, next) {
    try {
      const data = await InventarioService.resumenFinanciero(req.usuario.id, req.query);
      const filas = [
        ["Indicador", "Valor"],
        ["Base contable", data.politicaContable.base],
        ["Resultado oficial", "NO - reporte operativo provisional"],
        ["Cupones", "Excluidos hasta definir financiaciÃ³n"],
        ["Ventas confirmadas", data.ventas], ["Ingresos brutos", data.ingresosBrutos],
        ["Costo de ventas", data.costoVentas], ["Utilidad bruta", data.utilidadBruta],
        ["Gastos operativos", data.gastosOperativos], ["Utilidad operativa", data.utilidadOperativa],
        [], ["Gasto", "Categoría", "Monto", "Fecha"],
        ...data.gastos.map((gasto) => [gasto.concepto, gasto.categoria, Number(gasto.monto), gasto.fecha.toISOString()]),
      ];
      const escapar = (valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="Teravia_Contabilidad.csv"');
      res.send(`\uFEFF${filas.map((fila) => fila.map(escapar).join(",")).join("\n")}`);
    } catch (error) { next(error); }
  },
  async kardexValorizado(req, res, next) {
    try { res.json({ ok: true, data: await InventarioService.kardexValorizado(req.usuario.id, req.query) }); }
    catch (error) { next(error); }
  },
  async alertasOperativas(req, res, next) {
    try { res.json({ ok: true, data: await InventarioService.alertasOperativas(req.usuario.id) }); }
    catch (error) { next(error); }
  },
};

module.exports = InventarioController;
