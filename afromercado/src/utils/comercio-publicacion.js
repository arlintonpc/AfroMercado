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
  if (!cuentaDispersionVerificada(comercio)) {
    pendientes.push("cuenta bancaria o billetera de dispersion verificada");
  }

  return pendientes;
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

module.exports = {
  assertPuedePublicar,
  filtroComercioPublicable,
  requisitosPendientesPublicacion,
  tieneDocumentoCompleto,
};
