const ConfigRepository = require("../repositories/config.repository");
const { ErrorValidacion } = require("../utils/errores");
const {
  normalizarProveedor,
  obtenerProveedor,
} = require("./payments/provider-factory");

const CLAVE_PROVIDER = "pagos.provider";
const CLAVE_MANUALES = "pagos.manuales_habilitados";

const PROVEEDORES = ["SANDBOX", "WOMPI"];

const VARIABLES_WOMPI = [
  { nombre: "WOMPI_PUBLIC_KEY", grupo: "checkout", requerida: true },
  { nombre: "WOMPI_INTEGRITY_SECRET", alternativa: "WOMPI_SIGNATURE_SECRET", grupo: "checkout", requerida: true },
  { nombre: "WOMPI_EVENTS_SECRET", grupo: "webhook", requerida: true },
  { nombre: "WOMPI_PAYOUTS_API_URL", grupo: "dispersion", requerida: false, defaultValue: "https://api.payouts.wompi.co/v1" },
  { nombre: "WOMPI_PAYOUTS_API_KEY", grupo: "dispersion", requerida: true },
  { nombre: "WOMPI_PAYOUTS_USER_PRINCIPAL_ID", grupo: "dispersion", requerida: true },
  { nombre: "WOMPI_PAYOUTS_ACCOUNT_ID", grupo: "dispersion", requerida: true },
  { nombre: "WOMPI_PAYOUTS_PAYMENT_TYPE", grupo: "dispersion", requerida: false, defaultValue: "PROVIDERS" },
];

const CAMPOS_WOMPI_EDITABLES = new Set([
  "WOMPI_PUBLIC_KEY",
  "WOMPI_INTEGRITY_SECRET",
  "WOMPI_EVENTS_SECRET",
  "WOMPI_PAYOUTS_API_URL",
  "WOMPI_PAYOUTS_API_KEY",
  "WOMPI_PAYOUTS_USER_PRINCIPAL_ID",
  "WOMPI_PAYOUTS_ACCOUNT_ID",
  "WOMPI_PAYOUTS_PAYMENT_TYPE",
  "WOMPI_PAYOUT_BANK_MAP",
]);

const VARIABLES_GENERALES = [
  { nombre: "FRONTEND_URL", requerida: true },
  { nombre: "CUENTAS_DISPERSION_SECRET", requerida: true, minLength: 32 },
];

function boolDesdeString(valor, fallback) {
  if (valor === "true") return true;
  if (valor === "false") return false;
  return fallback;
}

function manualesDesdeEntorno() {
  if (process.env.PAGOS_MANUALES_HABILITADOS === "true") return true;
  if (process.env.PAGOS_MANUALES_HABILITADOS === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function enmascarar(valor) {
  const texto = String(valor || "");
  if (!texto) return null;
  if (texto.length <= 8) return "****";
  return `${texto.slice(0, 4)}****${texto.slice(-4)}`;
}

function claveWompi(nombre) {
  return `pagos.wompi.${nombre}`;
}

function estadoVariable(def, guardadas = {}) {
  const principal = process.env[def.nombre];
  const alternativa = def.alternativa ? process.env[def.alternativa] : undefined;
  const configPrincipal = guardadas[claveWompi(def.nombre)];
  const configAlternativa = def.alternativa ? guardadas[claveWompi(def.alternativa)] : undefined;
  const valor = principal || alternativa || configPrincipal || configAlternativa || def.defaultValue || "";
  const fuente = principal || alternativa
    ? "ENV"
    : (configPrincipal || configAlternativa ? "CONFIG" : (def.defaultValue ? "DEFAULT" : "NONE"));
  const configurada = Boolean(principal || alternativa || configPrincipal || configAlternativa || def.defaultValue);
  const longitudValida = !def.minLength || String(valor).length >= def.minLength;

  return {
    nombre: def.nombre,
    alternativa: def.alternativa || null,
    grupo: def.grupo || "general",
    requerida: Boolean(def.requerida),
    configurada: configurada && longitudValida,
    vieneDeDefault: Boolean(!principal && !alternativa && def.defaultValue),
    fuente,
    preview: enmascarar(valor),
    problema: configurada && !longitudValida
      ? `Debe tener al menos ${def.minLength} caracteres`
      : null,
  };
}

async function variablesEstado() {
  const claves = VARIABLES_WOMPI.flatMap((def) => [
    claveWompi(def.nombre),
    def.alternativa ? claveWompi(def.alternativa) : null,
  ]).filter(Boolean);
  claves.push(claveWompi("WOMPI_PAYOUT_BANK_MAP"));

  const guardadas = await ConfigRepository.obtenerVarios(claves);
  return [
    ...VARIABLES_GENERALES.map((def) => estadoVariable(def, guardadas)),
    ...VARIABLES_WOMPI.map((def) => estadoVariable(def, guardadas)),
  ];
}

async function proveedorActivo() {
  const guardado = await ConfigRepository.obtener(CLAVE_PROVIDER);
  return {
    proveedor: normalizarProveedor(guardado),
    fuente: guardado ? "CONFIG" : (process.env.PAYMENT_PROVIDER ? "ENV" : "DEFAULT"),
  };
}

async function pagosManualesHabilitados() {
  const guardado = await ConfigRepository.obtener(CLAVE_MANUALES);
  return boolDesdeString(guardado, manualesDesdeEntorno());
}

async function obtenerConfiguracion() {
  const [{ proveedor, fuente }, manuales] = await Promise.all([
    proveedorActivo(),
    pagosManualesHabilitados(),
  ]);
  const variables = await variablesEstado();

  const faltantesWompi = variables.filter((item) =>
    item.requerida &&
    !item.configurada &&
    ["checkout", "webhook", "dispersion"].includes(item.grupo)
  );
  const faltantesGenerales = variables.filter((item) =>
    item.requerida &&
    !item.configurada &&
    item.grupo === "general"
  );

  return {
    proveedor,
    proveedorFuente: fuente,
    proveedoresDisponibles: PROVEEDORES,
    pagosManualesHabilitados: manuales,
    pagosManualesFuente: await ConfigRepository.obtener(CLAVE_MANUALES) == null ? "ENV" : "CONFIG",
    entorno: process.env.NODE_ENV || "development",
    webhookWompiPath: "/api/pagos/webhooks/wompi",
    variables,
    listoParaCobroReal: proveedor === "WOMPI" && faltantesWompi.length === 0 && faltantesGenerales.length === 0,
    advertencias: [
      ...faltantesGenerales.map((v) => `Falta ${v.nombre}`),
      ...(proveedor === "WOMPI" ? faltantesWompi.map((v) => `Falta ${v.nombre}`) : []),
      ...(proveedor === "SANDBOX" ? ["SANDBOX no mueve dinero real"] : []),
    ],
  };
}

function normalizarEntradaWompi(wompi = {}) {
  const entradas = Object.entries(wompi || {})
    .map(([clave, valor]) => [String(clave).trim().toUpperCase(), String(valor || "").trim()])
    .filter(([, valor]) => valor && !/^•+$/.test(valor) && valor !== "********");

  for (const [clave, valor] of entradas) {
    if (!CAMPOS_WOMPI_EDITABLES.has(clave)) {
      throw new ErrorValidacion(`Campo Wompi no permitido: ${clave}`);
    }
    if (clave === "WOMPI_PAYOUTS_PAYMENT_TYPE" && !["PAYROLL", "PROVIDERS", "OTHER"].includes(valor)) {
      throw new ErrorValidacion("WOMPI_PAYOUTS_PAYMENT_TYPE debe ser PAYROLL, PROVIDERS u OTHER");
    }
    if (clave === "WOMPI_PAYOUT_BANK_MAP") {
      try {
        JSON.parse(valor);
      } catch {
        throw new ErrorValidacion("WOMPI_PAYOUT_BANK_MAP debe ser un JSON valido");
      }
    }
  }

  return entradas;
}

async function actualizarConfiguracion({ proveedor, pagosManualesHabilitados: manuales, wompi }) {
  const ops = [];
  if (proveedor != null) {
    const normalizado = normalizarProveedor(proveedor);
    if (!PROVEEDORES.includes(normalizado)) {
      throw new ErrorValidacion(`Proveedor invalido. Opciones: ${PROVEEDORES.join(", ")}`);
    }
    obtenerProveedor(normalizado);
    ops.push(ConfigRepository.guardar(CLAVE_PROVIDER, normalizado));
  }

  if (manuales != null) {
    if (typeof manuales !== "boolean") {
      throw new ErrorValidacion("pagosManualesHabilitados debe ser booleano");
    }
    ops.push(ConfigRepository.guardar(CLAVE_MANUALES, manuales ? "true" : "false"));
  }

  for (const [clave, valor] of normalizarEntradaWompi(wompi)) {
    ops.push(ConfigRepository.guardar(claveWompi(clave), valor));
  }

  if (ops.length === 0) {
    throw new ErrorValidacion("No se recibieron cambios de configuracion");
  }

  await Promise.all(ops);
  return obtenerConfiguracion();
}

async function probarConfiguracion() {
  const config = await obtenerConfiguracion();
  if (config.proveedor === "SANDBOX") {
    return {
      ok: true,
      proveedor: "SANDBOX",
      mensaje: "SANDBOX disponible. Sirve para pruebas internas, no mueve dinero real.",
      detalles: [],
    };
  }

  const errores = config.advertencias.filter((item) => item.startsWith("Falta "));
  if (errores.length > 0) {
    return {
      ok: false,
      proveedor: config.proveedor,
      mensaje: "La configuracion de Wompi esta incompleta.",
      detalles: errores,
    };
  }

  return {
    ok: true,
    proveedor: "WOMPI",
    mensaje: "Wompi tiene las variables requeridas. Haz una prueba real de bajo monto antes de abrir ventas.",
    detalles: [
      "Checkout: variables presentes",
      "Webhook: secreto de eventos presente",
      "Dispersion: credenciales de Pagos a Terceros presentes",
    ],
  };
}

module.exports = {
  actualizarConfiguracion,
  obtenerConfiguracion,
  pagosManualesHabilitados,
  probarConfiguracion,
};
