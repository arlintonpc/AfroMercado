// Generador de archivos Excel para AfroMercado — usa ExcelJS con streaming
const ExcelJS = require("exceljs");

// ─── Constantes de estilo ────────────────────────────────────────────────────
const ARGB_VERDE       = "FF52B788"; // #52B788 (color de marca AfroMercado)
const ARGB_VERDE_OSC   = "FF2D6A4F"; // eslint-disable-line no-unused-vars // #2D6A4F
const ARGB_VERDE_SUAVE = "FFD8F3DC";
const ARGB_BLANCO      = "FFFFFFFF";
const FMT_COP          = '"$"#,##0';
const FMT_FECHA        = "dd/mm/yyyy hh:mm";

function pintarCabecera(ws) {
  const fila = ws.getRow(1);
  fila.eachCell((c) => {
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB_VERDE } };
    c.font  = { bold: true, color: { argb: ARGB_BLANCO }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    c.border = { bottom: { style: "thin", color: { argb: ARGB_VERDE_OSC } } };
  });
  fila.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function filaTotal(ws, colDinero, totalRow) {
  totalRow.font = { bold: true };
  colDinero.forEach((c) => (totalRow.getCell(c).numFmt = FMT_COP));
  totalRow.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB_VERDE_SUAVE } };
  });
  totalRow.commit();
}

// ─── Excel Comerciante ───────────────────────────────────────────────────────

/**
 * Genera el .xlsx de ventas del comerciante usando streaming.
 * Escribe directamente al `res` de Express.
 *
 * @param {object} res       — response de Express (stream)
 * @param {object} comercio  — { nombre, municipio }
 * @param {object} filtros   — { desde, hasta, ...}
 * @param {AsyncGenerator} subPedidosGen — generador de ventasTodas()
 * @param {Array} productos  — array de productosConMetricas()
 * @param {object} resumen   — KPIs del periodo
 */
async function generarExcelVentasComercio({ res, comercio, filtros, subPedidosGen, productos, resumen }) {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  wb.creator = "AfroMercado";

  // ── Hoja "Resumen" ─────────────────────────────────────────────────────────
  const wsR = wb.addWorksheet("Resumen");
  wsR.columns = [
    { header: "Indicador", key: "k", width: 34 },
    { header: "Valor",     key: "v", width: 22 },
  ];
  pintarCabecera(wsR);

  const kpis = [
    { k: "Comercio",             v: comercio.nombre },
    { k: "Municipio",            v: comercio.municipio },
    { k: "Periodo",              v: `${filtros.desde ?? "inicio"} — ${filtros.hasta ?? "hoy"}` },
    { k: "Generado el",          v: new Date(), fmt: "dd/mm/yyyy hh:mm" },
    { k: "──────────────────────────────────", v: "" },
    { k: "Ventas (subpedidos)",  v: resumen.ventas,      fmt: "0" },
    { k: "Subtotal bruto",       v: resumen.subtotal,    fmt: FMT_COP },
    { k: "Comisión AfroMercado (10%)", v: resumen.comision, fmt: FMT_COP },
    { k: "Tus ingresos netos",   v: resumen.neto,        fmt: FMT_COP, bold: true },
    { k: "Ventas con cupón",     v: resumen.conCupon,    fmt: "0" },
    { k: "Ticket promedio neto", v: resumen.ticketPromedio, fmt: FMT_COP },
  ];
  for (const f of kpis) {
    const r = wsR.addRow({ k: f.k, v: f.v });
    if (f.fmt)  r.getCell("v").numFmt = f.fmt;
    if (f.bold) r.font = { bold: true };
    r.commit();
  }
  wsR.commit();

  // ── Hoja "Ventas" ──────────────────────────────────────────────────────────
  const wsV = wb.addWorksheet("Ventas");
  wsV.columns = [
    { header: "Fecha",          key: "fecha",    width: 18 },
    { header: "Pedido",         key: "codigo",   width: 12 },
    { header: "Estado",         key: "estado",   width: 16 },
    { header: "Cliente",        key: "cliente",  width: 26 },
    { header: "Teléfono",       key: "telefono", width: 16 },
    { header: "Producto",       key: "producto", width: 32 },
    { header: "Cant.",          key: "cantidad", width: 8  },
    { header: "Precio unit.",   key: "precioU",  width: 15 },
    { header: "Subtotal ítem",  key: "subtotal", width: 15 },
    { header: "¿Cupón?",        key: "cupon",    width: 9  },
    { header: "Municipio",      key: "municipio",width: 18 },
  ];
  pintarCabecera(wsV);
  wsV.autoFilter = { from: "A1", to: "K1" };

  let totCantidad = 0, totSubtotal = 0;

  for await (const sp of subPedidosGen) {
    for (const it of sp.items) {
      const fila = wsV.addRow({
        fecha:    new Date(sp.pedido.createdAt),
        codigo:   sp.pedido.codigo ?? `PED-${sp.pedidoId}`,
        estado:   sp.pedido.estado,
        cliente:  sp.pedido.comprador?.nombre ?? "",
        telefono: sp.pedido.comprador?.telefono ?? "",
        producto: it.producto?.nombre ?? `#${it.productoId}`,
        cantidad: it.cantidad,
        precioU:  Number(it.precioUnitario),
        subtotal: Number(it.subtotal),
        cupon:    sp.pedido.cuponId ? "Sí" : "No",
        municipio:sp.pedido.direccionTexto ?? "",
      });
      fila.getCell("fecha").numFmt    = FMT_FECHA;
      fila.getCell("precioU").numFmt  = FMT_COP;
      fila.getCell("subtotal").numFmt = FMT_COP;
      totCantidad += it.cantidad;
      totSubtotal += Number(it.subtotal);
      fila.commit();
    }
  }

  if (totCantidad === 0) {
    wsV.addRow({ producto: "Sin registros en el rango seleccionado" }).commit();
  } else {
    filaTotal(wsV, ["precioU", "subtotal"], wsV.addRow({
      cliente: "TOTAL", cantidad: totCantidad, subtotal: totSubtotal,
    }));
  }
  wsV.commit();

  // ── Hoja "Productos" ───────────────────────────────────────────────────────
  const wsP = wb.addWorksheet("Productos");
  wsP.columns = [
    { header: "Producto",       key: "nombre",    width: 30 },
    { header: "Precio",         key: "precio",    width: 14 },
    { header: "Unidades vend.", key: "unidades",  width: 15 },
    { header: "Ingresos brutos",key: "ingresos",  width: 16 },
    { header: "Neto est. (90%)",key: "neto",      width: 16 },
    { header: "Vistas",         key: "vistas",    width: 10 },
    { header: "Conversión %",   key: "conv",      width: 13 },
    { header: "Stock disp.",    key: "stock",     width: 12 },
    { header: "Calificación",   key: "calif",     width: 13 },
  ];
  pintarCabecera(wsP);
  wsP.autoFilter = { from: "A1", to: "I1" };

  for (const p of productos) {
    const fila = wsP.addRow({
      nombre: p.nombre, precio: p.precio, unidades: p.unidades,
      ingresos: p.ingresos, neto: p.neto,
      vistas: p.vistas, conv: p.conversion,
      stock: p.stockDisponible, calif: p.calificacion,
    });
    fila.getCell("precio").numFmt   = FMT_COP;
    fila.getCell("ingresos").numFmt = FMT_COP;
    fila.getCell("neto").numFmt     = FMT_COP;
    fila.getCell("conv").numFmt     = "0.00";
    fila.commit();
  }
  wsP.commit();

  await wb.commit();
}

// ─── Excel Admin ─────────────────────────────────────────────────────────────

/**
 * Genera el .xlsx maestro del admin (multi-hoja) usando streaming.
 */
async function generarExcelAdmin({ res, filtros, kpis, serieData, municipios, ranking, cuponesROI, subPedidosGen }) {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  wb.creator = "AfroMercado Admin";

  // ── Hoja "Resumen" ─────────────────────────────────────────────────────────
  const wsR = wb.addWorksheet("Resumen");
  wsR.columns = [
    { header: "KPI", key: "k", width: 30 },
    { header: "Valor", key: "v", width: 22 },
    { header: "Delta MoM %", key: "d", width: 14 },
  ];
  pintarCabecera(wsR);
  const kpiLabels = {
    comision:          "Comisión (ingreso plataforma)",
    gmv:               "GMV (volumen transaccional)",
    pedidos:           "Pedidos confirmados",
    comercios_activos: "Comercios activos con venta",
    compradores_nuevos:"Compradores nuevos",
    neto_comercios:    "Neto a pagar a comercios",
    pagos_cola:        "Pagos por verificar (cola)",
  };
  for (const [key, label] of Object.entries(kpiLabels)) {
    const kpi = kpis[key];
    const fila = wsR.addRow({ k: label, v: kpi?.valor ?? 0, d: kpi?.delta ?? "" });
    if (["comision","gmv","neto_comercios"].includes(key)) fila.getCell("v").numFmt = FMT_COP;
    fila.commit();
  }
  wsR.commit();

  // ── Hoja "Serie temporal" ──────────────────────────────────────────────────
  const wsSerie = wb.addWorksheet("Ingresos por período");
  wsSerie.columns = [
    { header: "Período",   key: "etiqueta", width: 14 },
    { header: "Comisión",  key: "comision", width: 16 },
    { header: "GMV",       key: "gmv",      width: 18 },
    { header: "Pedidos",   key: "pedidos",  width: 10 },
  ];
  pintarCabecera(wsSerie);
  for (const p of (serieData ?? [])) {
    const f = wsSerie.addRow({ etiqueta: p.etiqueta, comision: Number(p.comision), gmv: Number(p.gmv), pedidos: p.pedidos });
    f.getCell("comision").numFmt = FMT_COP;
    f.getCell("gmv").numFmt     = FMT_COP;
    f.commit();
  }
  wsSerie.commit();

  // ── Hoja "Por municipio" ───────────────────────────────────────────────────
  const wsMun = wb.addWorksheet("Por municipio");
  wsMun.columns = [
    { header: "Municipio",  key: "municipio", width: 20 },
    { header: "Comercios",  key: "comercios", width: 12 },
    { header: "Pedidos",    key: "pedidos",   width: 10 },
    { header: "GMV",        key: "gmv",       width: 18 },
    { header: "Comisión",   key: "comision",  width: 16 },
  ];
  pintarCabecera(wsMun);
  for (const m of (municipios ?? [])) {
    const f = wsMun.addRow({ municipio: m.municipio, comercios: m.comercios, pedidos: m.pedidos, gmv: Number(m.gmv), comision: Number(m.comision) });
    f.getCell("gmv").numFmt     = FMT_COP;
    f.getCell("comision").numFmt= FMT_COP;
    f.commit();
  }
  wsMun.commit();

  // ── Hoja "Ranking comercios" ───────────────────────────────────────────────
  const wsRanking = wb.addWorksheet("Comercios");
  wsRanking.columns = [
    { header: "ID",         key: "id",        width: 8  },
    { header: "Comercio",   key: "nombre",    width: 28 },
    { header: "Municipio",  key: "municipio", width: 20 },
    { header: "Pedidos",    key: "pedidos",   width: 10 },
    { header: "GMV",        key: "gmv",       width: 18 },
    { header: "Comisión",   key: "comision",  width: 16 },
    { header: "Neto",       key: "neto",      width: 16 },
    { header: "Calif.",     key: "calificacion", width: 10 },
  ];
  pintarCabecera(wsRanking);
  for (const c of (ranking ?? [])) {
    const f = wsRanking.addRow({ id: c.id, nombre: c.nombre, municipio: c.municipio, pedidos: c.pedidos, gmv: Number(c.gmv), comision: Number(c.comision), neto: Number(c.neto), calificacion: Number(c.calificacion) });
    f.getCell("gmv").numFmt     = FMT_COP;
    f.getCell("comision").numFmt= FMT_COP;
    f.getCell("neto").numFmt    = FMT_COP;
    f.commit();
  }
  wsRanking.commit();

  // ── Hoja "Cupones ROI" ─────────────────────────────────────────────────────
  const wsCup = wb.addWorksheet("Cupones ROI");
  wsCup.columns = [
    { header: "Código",         key: "codigo",     width: 16 },
    { header: "Tipo",           key: "tipo",       width: 14 },
    { header: "Valor",          key: "valor",      width: 12 },
    { header: "Pedidos",        key: "pedidos",    width: 10 },
    { header: "GMV influido",   key: "gmv",        width: 18 },
    { header: "Costo descuento",key: "costo",      width: 18 },
    { header: "Comisión gen.",  key: "comision",   width: 16 },
    { header: "Resultado neto", key: "resultado",  width: 16 },
  ];
  pintarCabecera(wsCup);
  for (const c of (cuponesROI ?? [])) {
    const f = wsCup.addRow({ codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), pedidos: c.pedidos, gmv: Number(c.gmv_influido), costo: Number(c.costo_descuento), comision: Number(c.comision_generada), resultado: Number(c.resultado_neto) });
    ["gmv","costo","comision","resultado"].forEach((k) => (f.getCell(k).numFmt = FMT_COP));
    f.commit();
  }
  wsCup.commit();

  // ── Hoja "Liquidación" (a quién pagar y cuánto) ───────────────────────────
  const wsLiq = wb.addWorksheet("Liquidación");
  wsLiq.columns = [
    { header: "Subpedido ID",  key: "id",       width: 14 },
    { header: "Comercio",      key: "comercio", width: 28 },
    { header: "Municipio",     key: "municipio",width: 18 },
    { header: "Pedido",        key: "pedido",   width: 12 },
    { header: "Fecha",         key: "fecha",    width: 18 },
    { header: "Estado",        key: "estado",   width: 14 },
    { header: "Subtotal",      key: "subtotal", width: 16 },
    { header: "Comisión",      key: "comision", width: 14 },
    { header: "Neto a pagar",  key: "neto",     width: 16 },
    { header: "Comprador",     key: "comprador",width: 24 },
  ];
  pintarCabecera(wsLiq);
  wsLiq.autoFilter = { from: "A1", to: "J1" };

  let totSubtotalLiq = 0, totComisionLiq = 0, totNetoLiq = 0;

  for await (const sp of subPedidosGen) {
    const fila = wsLiq.addRow({
      id:        sp.id,
      comercio:  sp.comercio?.nombre ?? sp.comercioId,
      municipio: sp.comercio?.municipio ?? "",
      pedido:    sp.pedido?.codigo ?? sp.pedidoId,
      fecha:     new Date(sp.pedido?.createdAt),
      estado:    sp.pedido?.estado ?? "",
      subtotal:  Number(sp.subtotal),
      comision:  Number(sp.comision),
      neto:      Number(sp.neto),
      comprador: sp.pedido?.comprador?.nombre ?? "",
    });
    fila.getCell("fecha").numFmt    = FMT_FECHA;
    fila.getCell("subtotal").numFmt = FMT_COP;
    fila.getCell("comision").numFmt = FMT_COP;
    fila.getCell("neto").numFmt     = FMT_COP;
    totSubtotalLiq += Number(sp.subtotal);
    totComisionLiq += Number(sp.comision);
    totNetoLiq     += Number(sp.neto);
    fila.commit();
  }

  if (totNetoLiq === 0) {
    wsLiq.addRow({ comercio: "Sin registros en el rango seleccionado" }).commit();
  } else {
    filaTotal(wsLiq, ["subtotal","comision","neto"], wsLiq.addRow({
      comercio: "TOTAL", subtotal: totSubtotalLiq, comision: totComisionLiq, neto: totNetoLiq,
    }));
  }
  wsLiq.commit();

  await wb.commit();
}

module.exports = { generarExcelVentasComercio, generarExcelAdmin };
