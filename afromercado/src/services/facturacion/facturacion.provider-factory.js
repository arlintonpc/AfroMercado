const NingunProveedorFacturacion = require("./providers/ninguno.provider");
const { ErrorValidacion } = require("../../utils/errores");
const ConfigRepository = require("../../repositories/config.repository");

// Solo "NINGUNO" existe hoy (Fase 1: abstracción lista, sin proveedor real
// contratado todavía). Cuando el dueño elija un proveedor (Factus/Alegra/Siigo/
// similar), se agrega su adaptador aquí siguiendo la misma interfaz que
// ninguno.provider.js: emitirFactura / consultarEstado / anularFactura.
const PROVEEDORES = {
  NINGUNO: NingunProveedorFacturacion,
};

const CONFIG_PROVIDER_KEY = "facturacion.provider";

function normalizarProveedor(nombre) {
  return String(nombre || "NINGUNO").trim().toUpperCase();
}

async function normalizarProveedorConfigurado(nombre) {
  if (nombre) return normalizarProveedor(nombre);
  const configurado = await ConfigRepository.obtener(CONFIG_PROVIDER_KEY);
  return normalizarProveedor(configurado);
}

function obtenerProveedor(nombre) {
  const key = normalizarProveedor(nombre);
  const provider = PROVEEDORES[key];
  if (!provider) {
    throw new ErrorValidacion(`Proveedor de facturación no soportado: ${key}`);
  }
  return provider;
}

async function obtenerProveedorConfigurado(nombre) {
  const key = await normalizarProveedorConfigurado(nombre);
  return {
    nombre: key,
    provider: obtenerProveedor(key),
  };
}

module.exports = {
  normalizarProveedor,
  normalizarProveedorConfigurado,
  obtenerProveedor,
  obtenerProveedorConfigurado,
};
