// ============================================================
//  Centro de Reglas del marketplace — fuente ÚNICA de verdad.
//
//  Todas las reglas de negocio configurables viven aquí con su valor
//  por defecto, tipo y metadatos. El código de negocio NUNCA debe
//  "quemar" estos valores: siempre los lee con Reglas.obtener / numero / bool.
//
//  El admin puede cambiar cualquiera desde el panel (se guarda en la tabla
//  Config). Si una regla no está en Config, se usa el valor por defecto de aquí.
//  Cambiar una regla = editar un valor en el panel, sin tocar código ni desplegar.
// ============================================================
const ConfigRepository = require("../repositories/config.repository");

// tipo: bool | numero | porcentaje_decimal | select | texto
const DEFAULTS = {
  // ── Comisiones ────────────────────────────────────────────
  comision_global: {
    valor: "0.10",
    tipo: "porcentaje_decimal",
    grupo: "Comisiones",
    etiqueta: "Comisión global de la plataforma",
    desc: "Porcentaje que AfroMercado cobra sobre cada venta. Se puede sobreescribir por comercio.",
  },
  comision_base: {
    valor: "post_descuento",
    tipo: "select",
    opciones: ["post_descuento", "pre_descuento"],
    grupo: "Comisiones",
    etiqueta: "Base de cálculo de la comisión",
    desc: "Si la comisión se calcula sobre el precio después (recomendado) o antes del descuento del cupón/oferta del vendedor.",
  },

  // ── Cupones ───────────────────────────────────────────────
  cupon_vendedor_permitido: {
    valor: "true",
    tipo: "bool",
    grupo: "Cupones",
    etiqueta: "Permitir cupones del vendedor",
    desc: "Si los comercios pueden crear sus propios cupones para su tienda.",
  },
  cupon_descuento_max_pct: {
    valor: "50",
    tipo: "numero",
    grupo: "Cupones",
    etiqueta: "Tope de descuento del vendedor (%)",
    desc: "Máximo porcentaje de descuento que un cupón de vendedor puede otorgar.",
  },
  cupon_combinable_con_oferta: {
    valor: "false",
    tipo: "bool",
    grupo: "Cupones",
    etiqueta: "Cupón combinable con oferta",
    desc: "Si un producto en oferta también puede recibir el descuento de un cupón.",
  },

  // ── Envíos ────────────────────────────────────────────────
  envio_gratis_vendedor_permitido: {
    valor: "true",
    tipo: "bool",
    grupo: "Envíos",
    etiqueta: "Permitir envío gratis del vendedor",
    desc: "Si los comercios pueden ofrecer envío gratis por monto mínimo de su tienda (lo asume el vendedor).",
  },
  envio_gratis_umbral_plataforma: {
    valor: "0",
    tipo: "numero",
    grupo: "Envíos",
    etiqueta: "Envío gratis de plataforma sobre $ (0 = desactivado)",
    desc: "Monto a partir del cual AfroMercado regala el envío (campaña de plataforma). 0 lo desactiva.",
  },
  envio_politica_multicomercio: {
    valor: "por_comercio",
    tipo: "select",
    opciones: ["por_comercio", "consolidado"],
    grupo: "Envíos",
    etiqueta: "Política de envío con varias tiendas",
    desc: "Cobrar un envío por cada comercio (cada productor despacha) o un solo envío consolidado.",
  },
  envio_sin_tarifa_accion: {
    valor: "nacional",
    tipo: "select",
    opciones: ["nacional", "bloquear"],
    grupo: "Envíos",
    etiqueta: "Si no hay tarifa para el destino",
    desc: "Usar la tarifa 'Nacional' como respaldo, o bloquear la compra a ese destino.",
  },

  // ── Pagos ─────────────────────────────────────────────────
  pago_minutos_expiracion: {
    valor: "30",
    tipo: "numero",
    grupo: "Pagos",
    etiqueta: "Minutos para completar el pago",
    desc: "Tiempo que tiene el comprador para pagar antes de que el pedido expire y libere el stock.",
  },

  // ── Repartidor ────────────────────────────────────────────
  repartidor_pago_modo: {
    valor: "fijo",
    tipo: "select",
    opciones: ["fijo", "porcentaje_envio"],
    grupo: "Repartidor",
    etiqueta: "Cómo se le paga al repartidor",
    desc: "Monto fijo por entrega, o un porcentaje del costo de envío del pedido.",
  },
  repartidor_pago_valor: {
    valor: "5000",
    tipo: "numero",
    grupo: "Repartidor",
    etiqueta: "Valor del pago al repartidor",
    desc: "Si es 'fijo': monto en $ por cada entrega. Si es 'porcentaje del envío': el % a pagar (ej. 70).",
  },

  // ── Empleo ────────────────────────────────────────────────
  empleo_auto_aprobar_comercio_verificado: {
    valor: "true",
    tipo: "bool",
    grupo: "Empleo",
    etiqueta: "Auto-aprobar ofertas de comercios verificados",
    desc: "Si está activo, las ofertas de empleo publicadas por un comercio ya verificado se publican de inmediato, sin pasar por moderación. Las publicadas por usuarios sin comercio o con comercio no verificado siempre requieren aprobación del admin.",
  },

  // ── General ───────────────────────────────────────────────
  whatsapp_boton_activo: {
    valor: "false",
    tipo: "bool",
    grupo: "General",
    etiqueta: "Botón de WhatsApp visible",
    desc: "Muestra el botón de contacto por WhatsApp en la tienda.",
  },

  // ── Marca ─────────────────────────────────────────────────
  logo_url: {
    valor: "",
    tipo: "texto",
    grupo: "Marca",
    etiqueta: "Logo de la plataforma",
    desc: "Se muestra en la cabecera. Súbelo desde el botón de arriba (o pega una URL de imagen). Vacío = se usa el texto 'AfroMercado'.",
  },

  // ── Datos legales (aparecen en Términos y Habeas Data) ─────
  legal_razon_social: {
    valor: "",
    tipo: "texto",
    grupo: "Datos legales",
    etiqueta: "Razón social",
    desc: "Nombre legal de quien opera AfroMercado.",
  },
  legal_nit: {
    valor: "",
    tipo: "texto",
    grupo: "Datos legales",
    etiqueta: "NIT o cédula",
    desc: "Identificación tributaria. Si no hay NIT, usa la cédula o 'en trámite'.",
  },
  legal_direccion: {
    valor: "",
    tipo: "texto",
    grupo: "Datos legales",
    etiqueta: "Dirección y ciudad",
    desc: "Domicilio que aparece en los documentos legales.",
  },
  legal_email: {
    valor: "",
    tipo: "texto",
    grupo: "Datos legales",
    etiqueta: "Correo de contacto / soporte",
    desc: "Correo para soporte y protección de datos personales.",
  },
  legal_telefono: {
    valor: "",
    tipo: "texto",
    grupo: "Datos legales",
    etiqueta: "Teléfono / WhatsApp",
    desc: "Teléfono de contacto de los documentos legales.",
  },
};

/** Valor crudo (string) de una regla: el de Config si existe, si no el default. */
async function obtener(clave) {
  const v = await ConfigRepository.obtener(clave);
  if (v !== null && v !== undefined) return v;
  return DEFAULTS[clave]?.valor ?? null;
}

/** Regla como número. */
async function numero(clave) {
  const n = Number(await obtener(clave));
  return Number.isFinite(n) ? n : Number(DEFAULTS[clave]?.valor) || 0;
}

/** Regla como booleano ('true' → true). */
async function bool(clave) {
  return (await obtener(clave)) === "true";
}

/**
 * Devuelve todas las reglas con sus metadatos y el valor actual (Config o default),
 * agrupadas por 'grupo'. Para la pantalla de administración.
 */
async function todasConMeta() {
  const claves = Object.keys(DEFAULTS);
  const guardadas = await ConfigRepository.obtenerVarios(claves);
  const grupos = {};
  for (const clave of claves) {
    const def = DEFAULTS[clave];
    const item = {
      clave,
      valor: guardadas[clave] ?? def.valor,
      tipo: def.tipo,
      grupo: def.grupo,
      etiqueta: def.etiqueta,
      desc: def.desc,
      ...(def.opciones ? { opciones: def.opciones } : {}),
    };
    (grupos[def.grupo] ??= []).push(item);
  }
  return grupos;
}

module.exports = { DEFAULTS, obtener, numero, bool, todasConMeta };
