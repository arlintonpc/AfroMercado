const { ErrorValidacion } = require("./errores");

function tieneDocumentoCompleto(comercio) {
  return Boolean(
    (comercio?.fotoDocumentoFrenteUrl || comercio?.fotoDocumentoUrl) &&
    comercio?.fotoDocumentoReversoUrl
  );
}

function cuentaDispersionVerificada(comercio) {
  return comercio?.cuentaDispersion?.estado === "VERIFICADA";
}

function requisitosPendientesPublicacion(comercio) {
  const pendientes = [];

  if (!comercio?.activo || !comercio?.verificado || comercio?.estadoRegistro !== "APROBADO") {
    pendientes.push("tienda aprobada por el administrador");
  }
  if (!tieneDocumentoCompleto(comercio)) {
    pendientes.push("frente y reverso del documento de identidad validos");
  }
  // Nota: cuenta de dispersion verificada NO es requisito para publicar —
  // un comercio sin cuenta verificada igual puede publicar productos, solo
  // que se venden con contacto directo por WhatsApp en vez de compra en la
  // plataforma (ver comercioComprableEnPlataforma).

  return pendientes;
}

/**
 * true si el comercio puede vender CON CHECKOUT en la plataforma (requiere
 * cuenta de dispersion verificada, ademas de los requisitos de publicacion).
 * false no bloquea la publicacion — solo determina si el producto entra al
 * carrito o si el comprador debe contactar al vendedor por WhatsApp.
 */
function comercioComprableEnPlataforma(comercio) {
  return requisitosPendientesPublicacion(comercio).length === 0 && cuentaDispersionVerificada(comercio);
}

function assertPuedePublicar(comercio) {
  const pendientes = requisitosPendientesPublicacion(comercio);
  if (pendientes.length) {
    const faltantes = pendientes.join("; ");
    const error = new ErrorValidacion(`No puedes publicar productos todavia. Falta: ${faltantes}.`);
    error.requisitosPendientes = pendientes;
    throw error;
  }
}

/** Gate de "compra en plataforma" (carrito/checkout) — exige cuenta de dispersion. */
function filtroComercioPublicable() {
  return {
    activo: true,
    verificado: true,
    estadoRegistro: "APROBADO",
    fotoDocumentoReversoUrl: { not: null },
    OR: [
      { fotoDocumentoFrenteUrl: { not: null } },
      { fotoDocumentoUrl: { not: null } },
    ],
    cuentaDispersion: {
      is: {
        estado: "VERIFICADA",
      },
    },
  };
}

/** Gate de "visible en catalogo" — sin exigir cuenta de dispersion. */
function filtroComercioVisible() {
  return {
    activo: true,
    verificado: true,
    estadoRegistro: "APROBADO",
    fotoDocumentoReversoUrl: { not: null },
    OR: [
      { fotoDocumentoFrenteUrl: { not: null } },
      { fotoDocumentoUrl: { not: null } },
    ],
  };
}

module.exports = {
  assertPuedePublicar,
  filtroComercioPublicable,
  filtroComercioVisible,
  comercioComprableEnPlataforma,
  requisitosPendientesPublicacion,
  tieneDocumentoCompleto,
};
