const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const InventarioController = require("../controllers/inventario.controller");

const router = express.Router();
router.use(autenticar, autorizar("COMERCIANTE", "ADMIN"));

router.get("/resumen", InventarioController.resumen);
router.get("/proveedores", InventarioController.listarProveedores);
router.post("/proveedores", InventarioController.crearProveedor);
router.get("/movimientos", InventarioController.listarMovimientos);
router.post("/compras", InventarioController.recibirCompra);
router.post("/movimientos", InventarioController.registrarAjuste);
router.get("/finanzas/resumen", InventarioController.resumenFinanciero);
router.get("/finanzas/exportar", InventarioController.exportarFinanzas);
router.get("/kardex", InventarioController.kardexValorizado);
router.get("/alertas", InventarioController.alertasOperativas);
router.get("/gastos", InventarioController.listarGastos);
router.post("/gastos", InventarioController.crearGasto);
router.get("/caja/resumen", InventarioController.resumenCaja);
router.get("/cuentas", InventarioController.listarCuentasOperativas);
router.post("/cuentas", InventarioController.crearCuentaOperativa);
router.post("/cuentas/:id/abonos", InventarioController.registrarAbono);

module.exports = router;
