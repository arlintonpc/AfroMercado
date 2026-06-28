const prisma = require("../config/prisma");
const { ErrorNoEncontrado, ErrorValidacion } = require("../utils/errores");
const {
  cifrarNumeroCuenta,
  cuentaSegura,
  enmascararCuenta,
  hashCuenta,
  limpiarNumeroCuenta,
  normalizarBanco,
} = require("../utils/cuentas-dispersion");
const { obtenerProveedorConfigurado } = require("./payments/provider-factory");
const {
  notificarRevisionCritica,
  prepararRevisionPorCambioCritico,
  registrarRevisionCriticaTx,
} = require("./comercio-revision.service");

const TIPOS_CUENTA = ["AHORROS", "CORRIENTE", "BILLETERA_DIGITAL"];
const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PEP", "PASAPORTE", "NIT"];

function validarCuenta(datos, usuario) {
  const banco = normalizarBanco(datos.bancoCodigo);
  if (!banco) {
    throw new ErrorValidacion("Banco o billetera no soportado por la pasarela");
  }

  const tipoCuenta = String(datos.tipoCuenta || "").trim().toUpperCase();
  if (!TIPOS_CUENTA.includes(tipoCuenta)) {
    throw new ErrorValidacion("tipoCuenta debe ser AHORROS, CORRIENTE o BILLETERA_DIGITAL");
  }

  const numeroCuenta = limpiarNumeroCuenta(datos.numeroCuenta);
  if (numeroCuenta.length < 6 || numeroCuenta.length > 24) {
    throw new ErrorValidacion("El numero de cuenta debe tener entre 6 y 24 digitos");
  }

  const tipoDocumento = String(datos.tipoDocumento || usuario?.tipoDocumento || "").trim().toUpperCase();
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) {
    throw new ErrorValidacion("Tipo de documento invalido para la cuenta");
  }

  const numeroDocumento = String(datos.numeroDocumento || usuario?.numeroDocumento || "").trim();
  if (!numeroDocumento) {
    throw new ErrorValidacion("El numero de documento del titular es obligatorio");
  }

  const titularNombre = String(datos.titularNombre || usuario?.nombre || "").trim();
  if (titularNombre.length < 3) {
    throw new ErrorValidacion("El nombre del titular de la cuenta es obligatorio");
  }

  return {
    banco,
    tipoCuenta,
    numeroCuenta,
    tipoDocumento,
    numeroDocumento,
    titularNombre,
  };
}

function cambioCriticoCuenta(cuentaActual, data) {
  if (!cuentaActual) return true;

  return [
    "proveedor",
    "titularNombre",
    "tipoDocumento",
    "numeroDocumento",
    "bancoCodigo",
    "tipoCuenta",
    "numeroCuentaHash",
    "providerBankId",
  ].some((campo) => String(cuentaActual[campo] || "") !== String(data[campo] || ""));
}

function snapshotCuenta(cuenta) {
  if (!cuenta) return null;
  return {
    proveedor: cuenta.proveedor || null,
    estado: cuenta.estado || null,
    titularNombre: cuenta.titularNombre || null,
    tipoDocumento: cuenta.tipoDocumento || null,
    numeroDocumento: cuenta.numeroDocumento || null,
    bancoCodigo: cuenta.bancoCodigo || null,
    bancoNombre: cuenta.bancoNombre || null,
    tipoCuenta: cuenta.tipoCuenta || null,
    numeroCuentaUltimos4: cuenta.numeroCuentaUltimos4 || null,
    numeroCuentaHash: cuenta.numeroCuentaHash || null,
    providerBankId: cuenta.providerBankId || null,
    verificadaAt: cuenta.verificadaAt || null,
  };
}

const CuentaDispersionService = {
  async obtener(usuarioId) {
    const comercio = await prisma.comercio.findUnique({
      where: { usuarioId },
      include: { cuentaDispersion: true },
    });
    if (!comercio) throw new ErrorNoEncontrado("No tienes un comercio registrado");
    return cuentaSegura(comercio.cuentaDispersion);
  },

  async guardar(usuarioId, datos = {}) {
    const comercio = await prisma.comercio.findUnique({
      where: { usuarioId },
      include: {
        cuentaDispersion: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
            tipoDocumento: true,
            numeroDocumento: true,
          },
        },
      },
    });
    if (!comercio) throw new ErrorNoEncontrado("No tienes un comercio registrado");

    const { nombre: proveedorNombre, provider: proveedor } = await obtenerProveedorConfigurado(datos.proveedor);
    const validada = validarCuenta(datos, comercio.usuario);
    const cuentaParaProveedor = {
      bancoCodigo: validada.banco.codigo,
      bancoNombre: validada.banco.nombre,
      providerBankId: datos.providerBankId || null,
      tipoCuenta: validada.tipoCuenta,
      numeroCuenta: validada.numeroCuenta,
      titularNombre: validada.titularNombre,
      tipoDocumento: validada.tipoDocumento,
      numeroDocumento: validada.numeroDocumento,
      emailNotificacion: datos.emailNotificacion || comercio.usuario.email,
      telefonoNotificacion: datos.telefonoNotificacion || comercio.usuario.telefono,
    };

    const registroProveedor = await proveedor.registrarBeneficiario({
      comercio,
      cuenta: cuentaParaProveedor,
    });

    const data = {
      proveedor: proveedorNombre,
      estado: registroProveedor.estado || "PENDIENTE_VERIFICACION",
      providerRecipientId: registroProveedor.providerRecipientId || null,
      titularNombre: validada.titularNombre,
      tipoDocumento: validada.tipoDocumento,
      numeroDocumento: validada.numeroDocumento,
      bancoCodigo: validada.banco.codigo,
      bancoNombre: validada.banco.nombre,
      tipoCuenta: validada.tipoCuenta,
      numeroCuentaUltimos4: enmascararCuenta(validada.numeroCuenta),
      numeroCuentaCifrado: cifrarNumeroCuenta(validada.numeroCuenta),
      numeroCuentaHash: hashCuenta({
        numeroCuenta: validada.numeroCuenta,
        documento: validada.numeroDocumento,
        comercioId: comercio.id,
      }),
      providerBankId: registroProveedor.providerBankId || cuentaParaProveedor.providerBankId || null,
      providerPayload: registroProveedor.payload || null,
      emailNotificacion: cuentaParaProveedor.emailNotificacion || null,
      telefonoNotificacion: cuentaParaProveedor.telefonoNotificacion || null,
      motivoRechazo: null,
      verificadaAt: registroProveedor.estado === "VERIFICADA" ? new Date() : null,
    };

    const revision = cambioCriticoCuenta(comercio.cuentaDispersion, data)
      ? prepararRevisionPorCambioCritico(comercio, {
          tipoCambio: "la cuenta para recibir pagos",
          tipo: "CUENTA_DISPERSION",
          accion: "REVISION_AUTOMATICA_CUENTA_DISPERSION",
          snapshotAnterior: snapshotCuenta(comercio.cuentaDispersion),
          snapshotNuevo: snapshotCuenta(data),
          solicitadoPor: usuarioId,
        })
      : null;

    const resultado = await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuentaDispersionComercio.upsert({
        where: { comercioId: comercio.id },
        create: { comercioId: comercio.id, ...data },
        update: data,
      });

      if (!revision) {
        return {
          cuenta,
          comercioActualizado: null,
          revisionResultado: { cambioCriticoId: null, productosDesactivados: 0 },
        };
      }

      const comercioActualizado = revision.data
        ? await tx.comercio.update({
            where: { id: comercio.id },
            data: revision.data,
          })
        : null;
      const revisionResultado = await registrarRevisionCriticaTx(tx, comercio, revision);

      return { cuenta, comercioActualizado, revisionResultado };
    });

    if (revision?.data && resultado.comercioActualizado) {
      notificarRevisionCritica(resultado.comercioActualizado, revision);
    }

    return {
      cuenta: cuentaSegura(resultado.cuenta),
      comercio: resultado.comercioActualizado,
      requiereRevision: Boolean(revision?.requiereCambioEstado || resultado.revisionResultado.cambioCriticoId),
      productosDesactivados: resultado.revisionResultado.productosDesactivados,
    };
  },
};

module.exports = CuentaDispersionService;
