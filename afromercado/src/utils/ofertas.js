function aNumero(valor, fallback = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function calcularPrecioOferta(precioBase, oferta) {
  const precio = aNumero(precioBase);
  const valor = aNumero(oferta?.valor);
  if (!oferta || valor <= 0) return Math.round(precio);
  if (oferta.tipo === "PORCENTAJE") {
    return Math.max(0, Math.round(precio * (1 - valor / 100)));
  }
  return Math.max(0, Math.round(precio - valor));
}

function ofertaTieneCupo(oferta, cantidad = 1) {
  if (!oferta) return false;
  if (oferta.stockLimite === null || oferta.stockLimite === undefined) return true;
  return aNumero(oferta.stockUsado) + cantidad <= aNumero(oferta.stockLimite);
}

function ofertaEstaVigente(oferta, ahora = new Date(), cantidad = 1) {
  if (!oferta || !oferta.activa) return false;
  const inicio = new Date(oferta.inicio).getTime();
  const fin = new Date(oferta.fin).getTime();
  const t = ahora.getTime();
  return inicio <= t && fin >= t && ofertaTieneCupo(oferta, cantidad);
}

function ofertaVigente(producto, ahora = new Date(), cantidad = 1) {
  const ofertas = Array.isArray(producto?.ofertas) ? producto.ofertas : [];
  return ofertas.find((oferta) => ofertaEstaVigente(oferta, ahora, cantidad)) || null;
}

function precioVigente(producto, ahora = new Date(), cantidad = 1) {
  const precioBase = aNumero(producto?.precio);
  const oferta = ofertaVigente(producto, ahora, cantidad);
  if (!oferta) {
    return { precioBase, precioFinal: Math.round(precioBase), oferta: null };
  }
  return {
    precioBase,
    precioFinal: calcularPrecioOferta(precioBase, oferta),
    oferta,
  };
}

module.exports = {
  calcularPrecioOferta,
  ofertaEstaVigente,
  ofertaTieneCupo,
  ofertaVigente,
  precioVigente,
};
