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
  wb.creator = "Teravia";

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
    { k: "Comisión Teravia (10%)", v: resumen.comision, fmt: FMT_COP },
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
async function generarExcelAdmin({
  res,
  filtros,
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
  subPedidosGen,
}) {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  wb.creator = "Teravia Admin";

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

  // ── Hoja "Categorías" ─────────────────────────────────────────────────────
  const wsCat = wb.addWorksheet("Categorías");
  wsCat.columns = [
    { header: "Categoría",        key: "categoria", width: 24 },
    { header: "Productos vend.",  key: "productos", width: 16 },
    { header: "Comercios",        key: "comercios", width: 12 },
    { header: "Pedidos",          key: "pedidos",   width: 10 },
    { header: "Unidades",         key: "unidades",  width: 12 },
    { header: "GMV",              key: "gmv",       width: 18 },
    { header: "Comisión est.",    key: "comision",  width: 16 },
  ];
  pintarCabecera(wsCat);
  for (const c of (categorias ?? [])) {
    const f = wsCat.addRow({
      categoria: c.categoria,
      productos: c.productos_vendidos,
      comercios: c.comercios,
      pedidos: c.pedidos,
      unidades: c.unidades,
      gmv: Number(c.gmv),
      comision: Number(c.comision_estimada),
    });
    f.getCell("gmv").numFmt = FMT_COP;
    f.getCell("comision").numFmt = FMT_COP;
    f.commit();
  }
  wsCat.commit();

  // ── Hoja "Productos top" ──────────────────────────────────────────────────
  const wsProd = wb.addWorksheet("Productos top");
  wsProd.columns = [
    { header: "Producto",       key: "producto",   width: 30 },
    { header: "Categoría",      key: "categoria",  width: 22 },
    { header: "Comercio",       key: "comercio",   width: 28 },
    { header: "Municipio",      key: "municipio",  width: 18 },
    { header: "Pedidos",        key: "pedidos",    width: 10 },
    { header: "Unidades",       key: "unidades",   width: 12 },
    { header: "GMV",            key: "gmv",        width: 18 },
    { header: "Comisión est.",  key: "comision",   width: 16 },
    { header: "Vistas",         key: "vistas",     width: 10 },
    { header: "Conversión %",   key: "conversion", width: 14 },
  ];
  pintarCabecera(wsProd);
  for (const p of (productos ?? [])) {
    const f = wsProd.addRow({
      producto: p.nombre,
      categoria: p.categoria,
      comercio: p.comercio,
      municipio: p.municipio,
      pedidos: p.pedidos,
      unidades: p.unidades,
      gmv: Number(p.gmv),
      comision: Number(p.comision_estimada),
      vistas: p.vistas,
      conversion: Number(p.conversion),
    });
    f.getCell("gmv").numFmt = FMT_COP;
    f.getCell("comision").numFmt = FMT_COP;
    f.getCell("conversion").numFmt = "0.00";
    f.commit();
  }
  wsProd.commit();

  // ── Hoja "Territorios" ────────────────────────────────────────────────────
  const wsTerr = wb.addWorksheet("Territorios");
  wsTerr.columns = [
    { header: "Departamento",     key: "departamento", width: 22 },
    { header: "Municipio",        key: "municipio",    width: 22 },
    { header: "Compradores",      key: "compradores",  width: 14 },
    { header: "Comercios",        key: "comercios",    width: 12 },
    { header: "Pedidos",          key: "pedidos",      width: 10 },
    { header: "GMV",              key: "gmv",          width: 18 },
    { header: "Comisión",         key: "comision",     width: 16 },
    { header: "Ticket prom.",     key: "ticket",       width: 16 },
  ];
  pintarCabecera(wsTerr);
  for (const t of (territorios ?? [])) {
    const f = wsTerr.addRow({
      departamento: t.departamento,
      municipio: t.municipio,
      compradores: t.compradores,
      comercios: t.comercios,
      pedidos: t.pedidos,
      gmv: Number(t.gmv),
      comision: Number(t.comision),
      ticket: Number(t.ticket_promedio),
    });
    ["gmv","comision","ticket"].forEach((k) => (f.getCell(k).numFmt = FMT_COP));
    f.commit();
  }
  wsTerr.commit();

  // ── Hoja "Pagos y dispersión" ─────────────────────────────────────────────
  const wsPagos = wb.addWorksheet("Pagos y dispersión");
  wsPagos.columns = [
    { header: "Bloque",        key: "bloque", width: 22 },
    { header: "Estado/Método", key: "clave",  width: 22 },
    { header: "Cantidad",      key: "cantidad", width: 12 },
    { header: "Monto",         key: "monto",  width: 18 },
    { header: "Comisión",      key: "comision", width: 16 },
    { header: "Neto",          key: "neto",   width: 18 },
  ];
  pintarCabecera(wsPagos);
  for (const p of (pagos?.pagosPorEstado ?? [])) {
    const f = wsPagos.addRow({ bloque: "Pagos por estado", clave: p.estado, cantidad: p.pagos, monto: Number(p.monto) });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  for (const p of (pagos?.pagosPorMetodo ?? [])) {
    const f = wsPagos.addRow({ bloque: "Pagos por método", clave: p.metodo, cantidad: p.pagos, monto: Number(p.monto) });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  for (const d of (pagos?.dispersionesPorEstado ?? [])) {
    const f = wsPagos.addRow({
      bloque: "Dispersión por estado",
      clave: d.estado,
      cantidad: d.dispersiones,
      monto: Number(d.monto_bruto),
      comision: Number(d.comision),
      neto: Number(d.monto_neto),
    });
    ["monto","comision","neto"].forEach((k) => (f.getCell(k).numFmt = FMT_COP));
    f.commit();
  }
  wsPagos.commit();

  // ── Hoja "Logística" ──────────────────────────────────────────────────────
  const wsLog = wb.addWorksheet("Logística");
  wsLog.columns = [
    { header: "Bloque",       key: "bloque", width: 20 },
    { header: "Zona/Nombre",  key: "nombre", width: 30 },
    { header: "Estado",       key: "estado", width: 16 },
    { header: "Entregas",     key: "entregas", width: 12 },
    { header: "Entregadas",   key: "entregadas", width: 12 },
    { header: "Fallidas",     key: "fallidas", width: 10 },
    { header: "Pago repart.", key: "pago", width: 16 },
  ];
  pintarCabecera(wsLog);
  for (const e of (logistica?.porEstado ?? [])) {
    const f = wsLog.addRow({ bloque: "Estado", nombre: "", estado: e.estado, entregas: e.entregas, pago: Number(e.pago_repartidores) });
    f.getCell("pago").numFmt = FMT_COP;
    f.commit();
  }
  for (const z of (logistica?.porZona ?? [])) {
    const f = wsLog.addRow({
      bloque: "Zona",
      nombre: `${z.departamento} / ${z.municipio}`,
      entregas: z.entregas,
      entregadas: z.entregadas,
      fallidas: z.fallidas,
      pago: Number(z.pago_repartidores),
    });
    f.getCell("pago").numFmt = FMT_COP;
    f.commit();
  }
  for (const r of (logistica?.porRepartidor ?? [])) {
    const f = wsLog.addRow({
      bloque: "Repartidor",
      nombre: r.nombre ?? "Sin asignar",
      entregas: r.entregas,
      entregadas: r.entregadas,
      fallidas: r.fallidas,
      pago: Number(r.pago_repartidores),
    });
    f.getCell("pago").numFmt = FMT_COP;
    f.commit();
  }
  wsLog.commit();

  // ── Hoja "Clientes" ───────────────────────────────────────────────────────
  const wsCli = wb.addWorksheet("Clientes");
  wsCli.columns = [
    { header: "Bloque",     key: "bloque", width: 18 },
    { header: "Nombre/Zona",key: "nombre", width: 30 },
    { header: "Email",      key: "email",  width: 28 },
    { header: "Teléfono",   key: "telefono", width: 16 },
    { header: "Municipio",  key: "municipio", width: 20 },
    { header: "Pedidos",    key: "pedidos", width: 10 },
    { header: "Compradores",key: "compradores", width: 14 },
    { header: "GMV",        key: "gmv", width: 18 },
    { header: "Última compra", key: "ultima", width: 18 },
  ];
  pintarCabecera(wsCli);
  const resumenClientes = clientes?.resumen ?? {};
  for (const [label, value] of Object.entries({
    "Compradores activos": resumenClientes.compradores_activos,
    "Compradores nuevos": resumenClientes.compradores_nuevos,
    "Compradores recurrentes": resumenClientes.compradores_recurrentes,
    "Pedidos": resumenClientes.pedidos,
    "GMV": resumenClientes.gmv,
    "Ticket promedio": resumenClientes.ticket_promedio,
  })) {
    const f = wsCli.addRow({ bloque: "Resumen", nombre: label, gmv: Number(value ?? 0) });
    if (["GMV", "Ticket promedio"].includes(label)) f.getCell("gmv").numFmt = FMT_COP;
    f.commit();
  }
  for (const c of (clientes?.topClientes ?? [])) {
    const f = wsCli.addRow({
      bloque: "Top cliente",
      nombre: c.nombre,
      email: c.email,
      telefono: c.telefono,
      municipio: c.municipio,
      pedidos: c.pedidos,
      gmv: Number(c.gmv),
      ultima: c.ultima_compra ? new Date(c.ultima_compra) : "",
    });
    f.getCell("gmv").numFmt = FMT_COP;
    if (c.ultima_compra) f.getCell("ultima").numFmt = FMT_FECHA;
    f.commit();
  }
  for (const z of (clientes?.porMunicipio ?? [])) {
    const f = wsCli.addRow({
      bloque: "Zona clientes",
      nombre: `${z.departamento} / ${z.municipio}`,
      pedidos: z.pedidos,
      compradores: z.compradores,
      gmv: Number(z.gmv),
    });
    f.getCell("gmv").numFmt = FMT_COP;
    f.commit();
  }
  wsCli.commit();

  // ── Hoja "Alertas" ────────────────────────────────────────────────────────
  const wsAlert = wb.addWorksheet("Alertas");
  wsAlert.columns = [
    { header: "Tipo",       key: "tipo", width: 28 },
    { header: "Entidad",    key: "entidad", width: 32 },
    { header: "Comercio/Zona", key: "contexto", width: 32 },
    { header: "Métrica A",  key: "metricaA", width: 16 },
    { header: "Métrica B",  key: "metricaB", width: 16 },
    { header: "Monto",      key: "monto", width: 18 },
    { header: "Detalle",    key: "detalle", width: 42 },
  ];
  pintarCabecera(wsAlert);

  for (const p of (alertas?.productosSinStockConDemanda ?? [])) {
    const f = wsAlert.addRow({
      tipo: "Producto agotado con demanda",
      entidad: p.nombre,
      contexto: `${p.comercio} / ${p.municipio}`,
      metricaA: `${p.vistas} vistas`,
      metricaB: `${p.unidades} unidades`,
      monto: Number(p.gmv),
      detalle: p.categoria,
    });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  for (const p of (alertas?.productosVistosSinVenta ?? [])) {
    wsAlert.addRow({
      tipo: "Visto sin venta",
      entidad: p.nombre,
      contexto: `${p.comercio} / ${p.municipio}`,
      metricaA: `${p.vistas} vistas`,
      metricaB: `Stock ${p.stock_disponible}`,
      detalle: p.categoria,
    }).commit();
  }
  for (const p of (alertas?.pagosAtencion ?? [])) {
    const f = wsAlert.addRow({
      tipo: "Pago requiere atención",
      entidad: p.estado,
      contexto: "Pagos",
      metricaA: `${p.pagos} pagos`,
      monto: Number(p.monto),
      detalle: `Desde ${p.desde ?? ""}`,
    });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  for (const d of (alertas?.dispersionesAtencion ?? [])) {
    const f = wsAlert.addRow({
      tipo: "Dispersión requiere atención",
      entidad: d.estado,
      contexto: `${d.comercio} / ${d.municipio}`,
      metricaA: `${d.dispersiones} dispersiones`,
      monto: Number(d.monto_neto),
      detalle: d.error_mensaje ?? "",
    });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  for (const c of (alertas?.comerciosCaida ?? [])) {
    const f = wsAlert.addRow({
      tipo: "Comercio con caída",
      entidad: c.nombre,
      contexto: c.municipio,
      metricaA: `${c.variacion_pct}%`,
      metricaB: `${c.pedidos_actual}/${c.pedidos_anterior} pedidos`,
      monto: Number(c.gmv_actual),
      detalle: `Anterior: ${Number(c.gmv_anterior).toLocaleString("es-CO")}`,
    });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  for (const z of (alertas?.zonasEntregaFallida ?? [])) {
    const f = wsAlert.addRow({
      tipo: "Zona con fallas de entrega",
      entidad: z.municipio,
      contexto: z.departamento,
      metricaA: `${z.tasa_falla}% falla`,
      metricaB: `${z.fallidas}/${z.entregas}`,
      monto: Number(z.pago_repartidores),
      detalle: "Revisar cobertura o asignación logística",
    });
    f.getCell("monto").numFmt = FMT_COP;
    f.commit();
  }
  wsAlert.commit();

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

// ─── Excel AfroMedia ─────────────────────────────────────────────────────────

function pctExcel(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor) : 0;
}

function formatearDineroFila(fila, keys) {
  for (const key of keys) fila.getCell(key).numFmt = FMT_COP;
}

function formatearPctFila(fila, keys) {
  for (const key of keys) fila.getCell(key).numFmt = "0.00%";
}

function agregarHojaRanking(wb, nombre, filas, extraCols = []) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = [
    { header: "Nombre", key: "nombre", width: 28 },
    ...extraCols,
    { header: "Pautas", key: "pautas", width: 10 },
    { header: "Vistas", key: "vistas", width: 12 },
    { header: "Clics", key: "clics", width: 12 },
    { header: "CTR", key: "ctr", width: 12 },
    { header: "Carritos", key: "carritos", width: 12 },
    { header: "Pedidos atrib.", key: "pedidosAtribuidos", width: 15 },
    { header: "Unidades atrib.", key: "unidadesAtribuidas", width: 16 },
    { header: "GMV atribuido", key: "gmvAtribuido", width: 16 },
    { header: "Inversion", key: "inversionRegistrada", width: 16 },
    { header: "ROAS", key: "roas", width: 10 },
  ];
  pintarCabecera(ws);
  ws.autoFilter = { from: "A1", to: String.fromCharCode(64 + ws.columns.length) + "1" };

  for (const row of filas ?? []) {
    const fila = ws.addRow({
      ...row,
      ctr: pctExcel(row.ctr),
      conversionCarrito: pctExcel(row.conversionCarrito),
      roas: pctExcel(row.roas),
      gmvAtribuido: Number(row.gmvAtribuido || 0),
      inversionRegistrada: Number(row.inversionRegistrada || 0),
    });
    formatearPctFila(fila, ["ctr"]);
    formatearDineroFila(fila, ["gmvAtribuido", "inversionRegistrada"]);
    fila.commit();
  }
  ws.commit();
}

async function generarExcelAfroMedia({ res, filtros, paquetes, solicitudes, visibilidades, campanas, analitica }) {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  wb.creator = "Teravia AfroMedia";

  const vistas = (visibilidades ?? []).reduce((acc, v) => acc + Number(v.vistas || 0), 0);
  const clics = (visibilidades ?? []).reduce((acc, v) => acc + Number(v.clics || 0), 0);
  const carritos = (visibilidades ?? []).reduce((acc, v) => acc + Number(v.carritos || 0), 0);
  const pedidos = (visibilidades ?? []).reduce((acc, v) => acc + Number(v.pedidosAtribuidos || 0), 0);
  const gmv = (visibilidades ?? []).reduce((acc, v) => acc + Number(v.gmvAtribuido || 0), 0);
  const inversion =
    (visibilidades ?? []).reduce((acc, v) => acc + Number(v.montoCOP || 0), 0) +
    (campanas ?? []).reduce((acc, c) => acc + Number(c.montoCOP || 0), 0);
  const solicitudesPagadas = (solicitudes ?? []).filter((s) => ["PAGADA", "CORTESIA"].includes(s.pagoEstado));
  const ingresosConfirmados = solicitudesPagadas.reduce((acc, s) => acc + Number(s.pagoMontoCOP || s.presupuestoCOP || 0), 0);
  const solicitudesPendientesPago = (solicitudes ?? []).filter((s) =>
    s.estado === "APROBADA" && !["PAGADA", "CORTESIA"].includes(s.pagoEstado)
  );
  const ingresosPendientes = solicitudesPendientesPago.reduce((acc, s) => acc + Number(s.pagoMontoCOP || s.presupuestoCOP || 0), 0);

  const wsR = wb.addWorksheet("Resumen");
  wsR.columns = [
    { header: "KPI", key: "k", width: 34 },
    { header: "Valor", key: "v", width: 22 },
  ];
  pintarCabecera(wsR);
  const resumen = [
    { k: "Periodo", v: `${filtros.desde ?? "inicio"} - ${filtros.hasta ?? "hoy"}` },
    { k: "Generado el", v: new Date(), fmt: FMT_FECHA },
    { k: "Solicitudes", v: solicitudes?.length ?? 0 },
    { k: "Solicitudes con pago confirmado", v: solicitudesPagadas.length },
    { k: "Ingresos publicitarios confirmados", v: ingresosConfirmados, fmt: FMT_COP },
    { k: "Solicitudes aprobadas pendientes de pago", v: solicitudesPendientesPago.length },
    { k: "Ingresos publicitarios pendientes", v: ingresosPendientes, fmt: FMT_COP },
    { k: "Paquetes configurados", v: paquetes?.length ?? 0 },
    { k: "Pautas de visibilidad", v: visibilidades?.length ?? 0 },
    { k: "Campanas hero", v: campanas?.length ?? 0 },
    { k: "Vistas", v: vistas },
    { k: "Clics", v: clics },
    { k: "CTR", v: vistas > 0 ? clics / vistas : 0, fmt: "0.00%" },
    { k: "Carritos", v: carritos },
    { k: "Pedidos atribuidos", v: pedidos },
    { k: "GMV atribuido", v: gmv, fmt: FMT_COP },
    { k: "Inversion registrada", v: inversion, fmt: FMT_COP },
    { k: "ROAS", v: inversion > 0 ? gmv / inversion : 0 },
  ];
  for (const item of resumen) {
    const fila = wsR.addRow({ k: item.k, v: item.v });
    if (item.fmt) fila.getCell("v").numFmt = item.fmt;
    fila.commit();
  }
  wsR.commit();

  const wsPaq = wb.addWorksheet("Paquetes");
  wsPaq.columns = [
    { header: "Codigo", key: "codigo", width: 24 },
    { header: "Nombre", key: "nombre", width: 24 },
    { header: "Precio base", key: "precioBaseCOP", width: 16 },
    { header: "Duracion dias", key: "duracionDias", width: 14 },
    { header: "Cupos sugeridos", key: "cuposSugeridos", width: 16 },
    { header: "Activo", key: "activo", width: 10 },
    { header: "Recomendado", key: "recomendado", width: 14 },
    { header: "Descripcion", key: "descripcion", width: 48 },
  ];
  pintarCabecera(wsPaq);
  for (const p of paquetes ?? []) {
    const fila = wsPaq.addRow({
      ...p,
      precioBaseCOP: Number(p.precioBaseCOP || 0),
      activo: p.activo ? "Si" : "No",
      recomendado: p.recomendado ? "Si" : "No",
    });
    fila.getCell("precioBaseCOP").numFmt = FMT_COP;
    fila.commit();
  }
  wsPaq.commit();

  const wsSol = wb.addWorksheet("Solicitudes");
  wsSol.columns = [
    { header: "Fecha", key: "createdAt", width: 18 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Paquete", key: "paquete", width: 24 },
    { header: "Comercio", key: "comercio", width: 28 },
    { header: "Municipio", key: "municipio", width: 18 },
    { header: "Producto", key: "producto", width: 28 },
    { header: "Presupuesto", key: "presupuestoCOP", width: 16 },
    { header: "Estado pago", key: "pagoEstado", width: 16 },
    { header: "Monto pago", key: "pagoMontoCOP", width: 16 },
    { header: "Proveedor", key: "pagoProveedor", width: 14 },
    { header: "Referencia pago", key: "pagoReferencia", width: 28 },
    { header: "Confirmado pago", key: "pagoConfirmadoAt", width: 18 },
    { header: "Politicas", key: "politicaAceptada", width: 14 },
    { header: "Version politicas", key: "politicaVersion", width: 18 },
    { header: "Objetivo", key: "objetivo", width: 50 },
  ];
  pintarCabecera(wsSol);
  for (const s of solicitudes ?? []) {
    const fila = wsSol.addRow({
      createdAt: new Date(s.createdAt),
      estado: s.estado,
      paquete: s.paquete,
      comercio: s.comercio?.nombre ?? "",
      municipio: s.comercio?.municipio ?? "",
      producto: s.producto?.nombre ?? "Tienda completa",
      presupuestoCOP: Number(s.presupuestoCOP || 0),
      pagoEstado: s.pagoEstado ?? "PENDIENTE",
      pagoMontoCOP: Number(s.pagoMontoCOP || s.presupuestoCOP || 0),
      pagoProveedor: s.pagoProveedor ?? "",
      pagoReferencia: s.pagoProviderReference || s.pagoReferencia || "",
      pagoConfirmadoAt: s.pagoConfirmadoAt ? new Date(s.pagoConfirmadoAt) : "",
      politicaAceptada: s.politicaAceptada ? "Si" : "No",
      politicaVersion: s.politicaVersion ?? "",
      objetivo: s.objetivo,
    });
    fila.getCell("createdAt").numFmt = FMT_FECHA;
    fila.getCell("presupuestoCOP").numFmt = FMT_COP;
    fila.getCell("pagoMontoCOP").numFmt = FMT_COP;
    if (s.pagoConfirmadoAt) fila.getCell("pagoConfirmadoAt").numFmt = FMT_FECHA;
    fila.commit();
  }
  wsSol.commit();

  const wsVis = wb.addWorksheet("Pautas");
  wsVis.columns = [
    { header: "Fecha", key: "createdAt", width: 18 },
    { header: "Tipo", key: "tipo", width: 18 },
    { header: "Comercio", key: "comercio", width: 28 },
    { header: "Municipio", key: "municipio", width: 18 },
    { header: "Producto", key: "producto", width: 28 },
    { header: "Categoria", key: "categoria", width: 18 },
    { header: "Inicio", key: "inicio", width: 18 },
    { header: "Fin", key: "fin", width: 18 },
    { header: "Vistas", key: "vistas", width: 12 },
    { header: "Clics", key: "clics", width: 12 },
    { header: "Carritos", key: "carritos", width: 12 },
    { header: "Pedidos", key: "pedidosAtribuidos", width: 12 },
    { header: "GMV", key: "gmvAtribuido", width: 16 },
    { header: "Inversion", key: "montoCOP", width: 16 },
  ];
  pintarCabecera(wsVis);
  for (const v of visibilidades ?? []) {
    const fila = wsVis.addRow({
      createdAt: new Date(v.createdAt),
      tipo: v.tipo,
      comercio: v.comercio?.nombre ?? "",
      municipio: v.comercio?.municipio ?? "",
      producto: v.producto?.nombre ?? "Tienda completa",
      categoria: v.producto?.categoria?.nombre ?? "Sin categoria",
      inicio: new Date(v.inicio),
      fin: new Date(v.fin),
      vistas: v.vistas,
      clics: v.clics,
      carritos: v.carritos,
      pedidosAtribuidos: v.pedidosAtribuidos,
      gmvAtribuido: Number(v.gmvAtribuido || 0),
      montoCOP: Number(v.montoCOP || 0),
    });
    fila.getCell("createdAt").numFmt = FMT_FECHA;
    fila.getCell("inicio").numFmt = FMT_FECHA;
    fila.getCell("fin").numFmt = FMT_FECHA;
    formatearDineroFila(fila, ["gmvAtribuido", "montoCOP"]);
    fila.commit();
  }
  wsVis.commit();

  agregarHojaRanking(wb, "Por region", analitica?.porRegion ?? []);
  agregarHojaRanking(wb, "Por categoria", analitica?.porCategoria ?? []);
  agregarHojaRanking(wb, "Por producto", analitica?.porProducto ?? [], [
    { header: "Comercio", key: "comercio", width: 28 },
    { header: "Municipio", key: "municipio", width: 18 },
    { header: "Categoria", key: "categoria", width: 18 },
  ]);
  agregarHojaRanking(wb, "Por comercio", analitica?.porComercio ?? [], [
    { header: "Municipio", key: "municipio", width: 18 },
  ]);

  const wsCamp = wb.addWorksheet("Campanas");
  wsCamp.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Tipo", key: "tipo", width: 18 },
    { header: "Titulo", key: "titulo", width: 34 },
    { header: "Vistas", key: "vistas", width: 12 },
    { header: "Clics", key: "clics", width: 12 },
    { header: "CTR", key: "ctr", width: 12 },
    { header: "Monto", key: "montoCOP", width: 16 },
    { header: "Inicio", key: "inicio", width: 18 },
    { header: "Fin", key: "fin", width: 18 },
    { header: "Activa", key: "activa", width: 10 },
  ];
  pintarCabecera(wsCamp);
  for (const c of analitica?.campanas ?? []) {
    const fila = wsCamp.addRow({
      ...c,
      montoCOP: Number(c.montoCOP || 0),
      inicio: new Date(c.inicio),
      fin: new Date(c.fin),
      activa: c.activa ? "Si" : "No",
    });
    fila.getCell("ctr").numFmt = "0.00%";
    fila.getCell("montoCOP").numFmt = FMT_COP;
    fila.getCell("inicio").numFmt = FMT_FECHA;
    fila.getCell("fin").numFmt = FMT_FECHA;
    fila.commit();
  }
  wsCamp.commit();

  await wb.commit();
}

module.exports = { generarExcelVentasComercio, generarExcelAdmin, generarExcelAfroMedia };
