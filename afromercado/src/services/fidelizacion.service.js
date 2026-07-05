// ============================================================
//  Servicio de Fidelización/Referidos (Fase 5.2)
//  Economía configurable vía Config (no hardcodeada):
//    - "fidelizacion.puntosPorCOP" (default 0.001 = 1 punto por $1.000)
//  El bono de referido se otorga solo en la PRIMERA compra confirmada del
//  referido (evita fraude de cuentas falsas creadas solo para farmear bonos).
// ============================================================
const prisma = require("../config/prisma");
const FidelizacionRepository = require("../repositories/fidelizacion.repository");
const ConfigRepository = require("../repositories/config.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

const PUNTOS_POR_COP_DEFAULT = 0.001; // 1 punto por cada $1.000
const BONO_REFERIDO_DEFAULT = 500;
const PUNTOS_POR_PESO_DESCUENTO_DEFAULT = 100; // 100 puntos = $1.000 de descuento al canjear

function generarCodigoReferido(usuarioId) {
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AFM${usuarioId}${rnd}`;
}

async function config(clave, porDefecto) {
  const valor = await ConfigRepository.obtener(clave);
  return valor != null ? Number(valor) : porDefecto;
}

const FidelizacionService = {
  async obtenerOCrearPerfil(usuarioId, referidoPorCodigo) {
    let perfil = await FidelizacionRepository.buscarPorUsuarioId(usuarioId);
    if (perfil) return perfil;

    let referidoPorId = null;
    if (referidoPorCodigo) {
      const referente = await FidelizacionRepository.buscarPorCodigoReferido(referidoPorCodigo.trim().toUpperCase());
      if (referente && referente.usuarioId !== usuarioId) referidoPorId = referente.usuarioId;
    }

    // Reintentar si el código generado ya existe (colisión muy improbable, pero el campo es único).
    for (let intento = 0; intento < 5; intento++) {
      try {
        perfil = await FidelizacionRepository.crear(usuarioId, generarCodigoReferido(usuarioId), referidoPorId);
        return perfil;
      } catch (e) {
        if (e?.code !== "P2002" || intento === 4) throw e;
      }
    }
  },

  async miPerfil(usuarioId) {
    const perfil = await this.obtenerOCrearPerfil(usuarioId);
    return perfil;
  },

  async misMovimientos(usuarioId) {
    const perfil = await this.obtenerOCrearPerfil(usuarioId);
    return FidelizacionRepository.listarMovimientos(perfil.id);
  },

  /** Fire-and-forget desde confirmarPago() — nunca debe lanzar hacia el llamador. */
  async otorgarPuntosPorCompra(usuarioId, { moduloOrigen, referenciaId, subtotal }) {
    const perfil = await this.obtenerOCrearPerfil(usuarioId);
    const tasa = await config("fidelizacion.puntosPorCOP", PUNTOS_POR_COP_DEFAULT);
    const puntos = Math.floor(Number(subtotal) * tasa);
    if (puntos > 0) {
      await FidelizacionRepository.registrarMovimiento(perfil.id, {
        tipo: "GANADO_COMPRA",
        puntos,
        moduloOrigen,
        referenciaId,
        descripcion: `Compra en ${moduloOrigen} #${referenciaId}`,
      });
    }

    // Bono al referidor, solo si esta es la primera compra confirmada del referido.
    if (perfil.referidoPorId) {
      const tuvoOtra = await FidelizacionRepository.yaTuvoCompraPrevia(usuarioId, moduloOrigen, referenciaId);
      if (!tuvoOtra) {
        const perfilReferente = await this.obtenerOCrearPerfil(perfil.referidoPorId);
        const bono = await config("fidelizacion.bonoReferido", BONO_REFERIDO_DEFAULT);
        if (bono > 0) {
          await FidelizacionRepository.registrarMovimiento(perfilReferente.id, {
            tipo: "GANADO_REFERIDO",
            puntos: bono,
            descripcion: `Bono por referir a un usuario que ya compró`,
          });
        }
      }
    }
  },

  /** Canjea puntos por un Cupón de descuento de un solo uso, asignado solo a este usuario. */
  async canjearPuntos(usuarioId, puntosACanjear) {
    const cant = Number(puntosACanjear);
    if (!Number.isInteger(cant) || cant <= 0) throw new ErrorValidacion("La cantidad de puntos a canjear debe ser un entero mayor a 0");

    const perfil = await this.obtenerOCrearPerfil(usuarioId);
    if (perfil.puntos < cant) throw new ErrorValidacion("No tienes suficientes puntos para este canje");

    const puntosPorPeso = await config("fidelizacion.puntosPorPesoDescuento", PUNTOS_POR_PESO_DESCUENTO_DEFAULT);
    const valorDescuento = Math.floor(cant / puntosPorPeso) * 1000;
    if (valorDescuento <= 0) throw new ErrorValidacion(`Necesitas al menos ${puntosPorPeso} puntos para canjear`);

    const codigo = `PUNTOS${usuarioId}${Date.now().toString(36).toUpperCase()}`;
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 días para usarlo

    const cupon = await prisma.$transaction(async (tx) => {
      const nuevoCupon = await tx.cupon.create({
        data: {
          codigo,
          tipo: "VALOR_FIJO",
          valor: valorDescuento,
          usosMaximos: 1,
          usosMaximosPorUsuario: 1,
          activo: true,
          inicio: ahora,
          fin,
          distribucion: "ASIGNADO",
        },
      });
      await tx.cuponAsignacion.create({ data: { cuponId: nuevoCupon.id, usuarioId } });
      return nuevoCupon;
    });

    await FidelizacionRepository.registrarMovimiento(perfil.id, {
      tipo: "CANJEADO",
      puntos: -cant,
      descripcion: `Canjeado por cupón ${codigo} (${valorDescuento} COP)`,
    });

    return cupon;
  },
};

module.exports = FidelizacionService;
