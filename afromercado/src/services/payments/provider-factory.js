const SandboxPaymentProvider = require("./providers/sandbox.provider");
const WompiPaymentProvider = require("./providers/wompi.provider");
const { ErrorValidacion } = require("../../utils/errores");
const ConfigRepository = require("../../repositories/config.repository");

const PROVEEDORES = {
  SANDBOX: SandboxPaymentProvider,
  WOMPI: WompiPaymentProvider,
};

const CONFIG_PROVIDER_KEY = "pagos.provider";

function normalizarProveedor(nombre) {
  const predeterminado = process.env.NODE_ENV === "production" ? "WOMPI" : "SANDBOX";
  return String(nombre || process.env.PAYMENT_PROVIDER || predeterminado).trim().toUpperCase();
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
    throw new ErrorValidacion(`Proveedor de pago no soportado: ${key}`);
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
