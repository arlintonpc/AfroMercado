// Proveedor no-op — default mientras no se contrate un proveedor tecnológico
// real de facturación electrónica DIAN (Factus/Alegra/Siigo/similar). Todos los
// métodos resuelven de inmediato sin llamar a ningún servicio externo, dejando
// la factura en estado OMITIDA (ver facturacion.service.js).
const NingunProveedorFacturacion = {
  nombre: "NINGUNO",

  async emitirFactura(_datos) {
    return { omitido: true, estado: "OMITIDA" };
  },

  async consultarEstado(_facturaId) {
    return { omitido: true, estado: "OMITIDA" };
  },

  async anularFactura(_facturaId, _motivo) {
    return { omitido: true, estado: "OMITIDA" };
  },
};

module.exports = NingunProveedorFacturacion;
