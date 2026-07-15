// ============================================================
//  Recibo de compra simple (Fase 1.3) — PDF sin valor fiscal.
//  Independiente del proveedor de facturación DIAN (Fase 1.2): siempre
//  disponible on-demand, generado en memoria, nunca persistido en disco.
// ============================================================
const PDFDocument = require("pdfkit");

const VERDE_OSCURO = "#1B4332";
const VERDE_MEDIO = "#2D6A4F";
const DORADO = "#D4A017";
const GRIS_TEXTO = "#444444";

function formatearCOP(n) {
  return "$" + Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function fechaLegible(iso) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Genera el PDF de un recibo de compra (Pedido del marketplace) y lo escribe
 * directamente en un stream de respuesta HTTP (res). No retorna un Buffer —
 * el llamador debe hacer doc.pipe(res) desde el controller.
 * @param {object} pedido - resultado de PedidoRepository.buscarPorId()
 * @returns {PDFDocument}
 */
function generarReciboPedido(pedido) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fillColor(VERDE_OSCURO).fontSize(22).font("Helvetica-Bold").text("Teravia", { align: "left" });
  doc.fillColor(GRIS_TEXTO).fontSize(10).font("Helvetica").text("Recibo de compra — comprobante interno, sin valor fiscal", { align: "left" });
  doc.moveDown(1.5);

  doc.strokeColor(DORADO).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fillColor(VERDE_OSCURO).fontSize(14).font("Helvetica-Bold").text(`Pedido ${pedido.codigo ?? `#${pedido.id}`}`);
  doc.fillColor(GRIS_TEXTO).fontSize(10).font("Helvetica").text(`Fecha: ${fechaLegible(pedido.createdAt)}`);
  if (pedido.direccionTexto) {
    doc.text(`Entrega: ${pedido.direccionTexto}`);
  }
  doc.moveDown(1);

  for (const sp of pedido.subPedidos || []) {
    doc.fillColor(VERDE_MEDIO).fontSize(12).font("Helvetica-Bold").text(sp.comercio?.nombre ?? "Comercio");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor(GRIS_TEXTO);
    for (const item of sp.items || []) {
      const nombre = item.producto?.nombre ?? "Producto";
      doc.text(`${item.cantidad} x ${nombre}`, { continued: true, width: 350 });
      doc.text(formatearCOP(item.subtotal), { align: "right" });
    }
    if (Number(sp.iva) > 0) {
      doc.font("Helvetica-Oblique").text(`IVA (${sp.comercio?.nombre ?? "comercio"})`, { continued: true, width: 350 });
      doc.text(formatearCOP(sp.iva), { align: "right" });
      doc.font("Helvetica");
    }
    doc.moveDown(0.6);
  }

  doc.strokeColor("#E0DCD5").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);

  doc.fontSize(10).fillColor(GRIS_TEXTO).text("Subtotal", { continued: true, width: 450 });
  doc.text(formatearCOP(pedido.subtotal), { align: "right" });

  if (Number(pedido.ivaTotal) > 0) {
    doc.text("IVA", { continued: true, width: 450 });
    doc.text(formatearCOP(pedido.ivaTotal), { align: "right" });
  }

  if (Number(pedido.costoEnvio) > 0) {
    doc.text("Envío", { continued: true, width: 450 });
    doc.text(formatearCOP(pedido.costoEnvio), { align: "right" });
  }

  if (pedido.cuponDescuento) {
    doc.text("Descuento", { continued: true, width: 450 });
    doc.text(`-${formatearCOP(pedido.cuponDescuento)}`, { align: "right" });
  }

  doc.moveDown(0.3);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(VERDE_OSCURO).text("Total", { continued: true, width: 450 });
  doc.text(formatearCOP(pedido.total), { align: "right" });

  doc.moveDown(2);
  doc.fontSize(8).font("Helvetica").fillColor("#999999").text(
    "Este documento es un comprobante interno de Teravia y no constituye una factura electrónica válida ante la DIAN.",
    { align: "center" }
  );

  doc.end();
  return doc;
}

module.exports = { generarReciboPedido };
