const crypto = require("crypto");

const BANCOS_SOPORTADOS = [
  { codigo: "BANCOLOMBIA", nombre: "Bancolombia" },
  { codigo: "DAVIVIENDA", nombre: "Davivienda" },
  { codigo: "BANCO_BOGOTA", nombre: "Banco de Bogota" },
  { codigo: "BBVA", nombre: "BBVA Colombia" },
  { codigo: "BANCO_OCCIDENTE", nombre: "Banco de Occidente" },
  { codigo: "BANCO_POPULAR", nombre: "Banco Popular" },
  { codigo: "BANCO_AV_VILLAS", nombre: "Banco AV Villas" },
  { codigo: "BANCO_CAJA_SOCIAL", nombre: "Banco Caja Social" },
  { codigo: "BANCO_AGRARIO", nombre: "Banco Agrario" },
  { codigo: "SCOTIABANK_COLPATRIA", nombre: "Scotiabank Colpatria" },
  { codigo: "BANCO_FALABELLA", nombre: "Banco Falabella" },
  { codigo: "BANCO_PICHINCHA", nombre: "Banco Pichincha" },
  { codigo: "BANCO_W", nombre: "Banco W" },
  { codigo: "LULO_BANK", nombre: "Lulo Bank" },
  { codigo: "NU", nombre: "Nu Colombia" },
  { codigo: "NEQUI", nombre: "Nequi" },
  { codigo: "DAVIPLATA", nombre: "DaviPlata" },
];

function normalizarBanco(codigo) {
  if (!codigo) return null;
  const limpio = String(codigo).trim().toUpperCase();
  return BANCOS_SOPORTADOS.find((banco) => banco.codigo === limpio) || null;
}

function limpiarNumeroCuenta(numeroCuenta) {
  return String(numeroCuenta || "").replace(/\D/g, "");
}

function enmascararCuenta(numeroCuenta) {
  const limpia = limpiarNumeroCuenta(numeroCuenta);
  if (limpia.length <= 4) return limpia;
  return limpia.slice(-4);
}

function hashCuenta({ numeroCuenta, documento, comercioId }) {
  const secreto = process.env.CUENTAS_DISPERSION_SECRET || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!secreto || secreto.length < 32)) {
    throw new Error(
      "CUENTAS_DISPERSION_SECRET debe estar configurado con al menos 32 caracteres en produccion"
    );
  }
  const base = [
    limpiarNumeroCuenta(numeroCuenta),
    String(documento || "").trim(),
    String(comercioId || ""),
  ].join(":");

  return crypto.createHmac("sha256", secreto || "afromercado-dev").update(base).digest("hex");
}

function obtenerClaveCifrado() {
  const secreto = process.env.CUENTAS_DISPERSION_SECRET || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!secreto || secreto.length < 32)) {
    throw new Error(
      "CUENTAS_DISPERSION_SECRET debe estar configurado con al menos 32 caracteres en produccion"
    );
  }
  return crypto
    .createHash("sha256")
    .update(secreto || "afromercado-dev")
    .digest();
}

function cifrarNumeroCuenta(numeroCuenta) {
  const limpia = limpiarNumeroCuenta(numeroCuenta);
  if (!limpia) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", obtenerClaveCifrado(), iv);
  const cifrado = Buffer.concat([cipher.update(limpia, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    cifrado.toString("base64url"),
  ].join(":");
}

function descifrarNumeroCuenta(valorCifrado) {
  if (!valorCifrado) return null;
  const [version, ivB64, tagB64, cifradoB64] = String(valorCifrado).split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !cifradoB64) {
    throw new Error("Formato de cuenta cifrada invalido");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    obtenerClaveCifrado(),
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plano = Buffer.concat([
    decipher.update(Buffer.from(cifradoB64, "base64url")),
    decipher.final(),
  ]);
  return plano.toString("utf8");
}

function cuentaSegura(cuenta) {
  if (!cuenta) return null;
  const { numeroCuentaHash, numeroCuentaCifrado, providerPayload, ...resto } = cuenta;
  void numeroCuentaHash;
  void numeroCuentaCifrado;
  void providerPayload;
  return resto;
}

module.exports = {
  BANCOS_SOPORTADOS,
  cifrarNumeroCuenta,
  cuentaSegura,
  descifrarNumeroCuenta,
  enmascararCuenta,
  hashCuenta,
  limpiarNumeroCuenta,
  normalizarBanco,
};
