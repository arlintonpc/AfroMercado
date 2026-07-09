const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");
const AlianzaService = require("./alianza.service");
const FacturacionService = require("./facturacion.service");

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TX-${ts}-${rnd}`;
}

async function notif(usuarioId, titulo, cuerpo, url) {
  if (!usuarioId) return;
  try {
    await prisma.notificacion.create({
      data: { usuarioId, tipo: "GENERAL", titulo, mensaje: cuerpo, url: url || null },
    });
    sseManager.enviar(usuarioId, "notificacion", { tipo: "TRANSPORTE", titulo, mensaje: cuerpo, url });
    await enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono: "/icon-192.svg" });
  } catch (e) { console.error("[NOTIF-TRANSPORTE]", e.message); }
}

const TRANSPORTE_INCLUDE = {
  comercio: {
    select: {
      id: true, nombre: true, municipio: true, departamento: true,
      latitud: true, longitud: true, logoUrl: true, calificacion: true,
      totalReviews: true, whatsapp: true,
    },
  },
};

async function validarCuponTransporteInterno(db, codigo, configTransporteId, asientos, clienteId, totalOriginal, { bloquear = false, comercioId = null } = {}) {
  const ahora = new Date();
  const codigoNormalizado = String(codigo || "").trim().toUpperCase();
  let cupon = await db.cuponTransporte.findFirst({
    where: {
      codigo: codigoNormalizado,
      activo: true,
      inicio: { lte: ahora },
      fin:    { gte: ahora },
      OR: [
        { configTransporteId: null },
        { configTransporteId },
      ],
    },
  });

  if (!cupon) {
    // Fallback: no es un CuponTransporte propio, ¿es un código de alianza
    // comercial vigente para este comercio en el módulo TRANSPORTE?
    if (comercioId) {
      const alianza = await AlianzaService.validarCodigoAlianza(codigoNormalizado, comercioId, "TRANSPORTE");
      if (alianza) {
        const descuentoAlianza = alianza.tipoDescuento === "PORCENTAJE"
          ? Math.round(totalOriginal * Number(alianza.valorDescuento) / 100 * 100) / 100
          : Math.min(Number(alianza.valorDescuento), totalOriginal);
        return {
          cupon: { codigo: codigoNormalizado },
          descuento: descuentoAlianza,
          totalConDescuento: totalOriginal - descuentoAlianza,
          esAlianza: true,
        };
      }
    }
    throw new ErrorValidacion("Cupon no valido o expirado");
  }
  if (bloquear) {
    await db.$queryRaw`SELECT id FROM "CuponTransporte" WHERE id = ${cupon.id} FOR UPDATE`;
    cupon = await db.cuponTransporte.findUnique({ where: { id: cupon.id } });
    if (!cupon || !cupon.activo || cupon.inicio > ahora || cupon.fin < ahora) {
      throw new ErrorValidacion("Cupon no valido o expirado");
    }
  }

  if (cupon.minimoAsientos && asientos < cupon.minimoAsientos) {
    throw new ErrorValidacion(`Este cupon requiere minimo ${cupon.minimoAsientos} asiento(s)`);
  }

  if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
    throw new ErrorValidacion("El cupon ha alcanzado el limite de usos");
  }

  if (clienteId) {
    const usoExistente = await db.cuponTransporteUso.findFirst({
      where: { cuponTransporteId: cupon.id, clienteId },
    });
    if (usoExistente) throw new ErrorValidacion("Ya usaste este cupon");
  }

  let descuento;
  if (cupon.tipo === "PORCENTAJE") {
    descuento = Math.round(totalOriginal * Number(cupon.valor) / 100 * 100) / 100;
  } else {
    descuento = Math.min(Number(cupon.valor), totalOriginal);
  }

  const totalConDescuento = totalOriginal - descuento;
  return { cupon, descuento, totalConDescuento };
}

const TransporteService = {
  async listar({ municipio, departamento } = {}) {
    const comercioWhere = { verificado: true };
    if (municipio) comercioWhere.municipio = { contains: municipio, mode: "insensitive" };
    if (departamento) comercioWhere.departamento = { contains: departamento, mode: "insensitive" };

    return prisma.configTransporte.findMany({
      where: { activo: true, comercio: comercioWhere },
      include: { ...TRANSPORTE_INCLUDE, rutas: { where: { activo: true }, orderBy: { horario: "asc" } } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async obtener(id) {
    const t = await prisma.configTransporte.findUnique({
      where: { id },
      include: { ...TRANSPORTE_INCLUDE, rutas: { where: { activo: true }, orderBy: { horario: "asc" } } },
    });
    if (!t) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");
    return t;
  },

  async verificarDisponibilidad(rutaId, fecha) {
    const ruta = await prisma.rutaTransporte.findUnique({ where: { id: rutaId } });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");

    const fechaD = new Date(fecha);
    const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaD); fin.setHours(23, 59, 59, 999);

    const reservados = await prisma.reservaTransporte.aggregate({
      where: { rutaTransporteId: rutaId, fechaViaje: { gte: inicio, lte: fin }, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
      _sum: { asientos: true },
    });
    const ocupados = reservados._sum.asientos ?? 0;
    return { disponibles: Math.max(0, ruta.capacidad - ocupados), capacidad: ruta.capacidad };
  },

  async crearReserva(clienteId, { rutaTransporteId, fechaViaje, asientos, metodoPago, notasCliente, nombreContacto, telefonoContacto, codigoCupon }) {
    const ruta = await prisma.rutaTransporte.findUnique({
      where: { id: rutaTransporteId },
      include: { configTransporte: { include: TRANSPORTE_INCLUDE } },
    });
    if (!ruta || !ruta.activo) throw new ErrorValidacion("Ruta no disponible");

    const disp = await TransporteService.verificarDisponibilidad(rutaTransporteId, fechaViaje);
    if (disp.disponibles < asientos) throw new ErrorValidacion("No hay suficientes asientos disponibles");

    const totalOriginal = Number(ruta.precioAsiento) * asientos;

    const { reserva } = await prisma.$transaction(async (tx) => {
      let montoDescuento = 0;
      let cuponValidado = null;
      let cuponEsAlianza = false;
      if (codigoCupon) {
        const cuponResultado = await validarCuponTransporteInterno(
          tx,
          codigoCupon,
          ruta.configTransporteId,
          asientos,
          clienteId,
          totalOriginal,
          { bloquear: true, comercioId: ruta.configTransporte.comercioId }
        );
        montoDescuento = cuponResultado.descuento;
        cuponValidado = cuponResultado.cupon;
        cuponEsAlianza = !!cuponResultado.esAlianza;
      }

      const total = totalOriginal - montoDescuento;

      const nuevaReserva = await tx.reservaTransporte.create({
        data: {
          codigo: generarCodigo(),
          rutaTransporteId,
          clienteId,
          fechaViaje: new Date(fechaViaje),
          asientos,
          total,
          estado: "PENDIENTE",
          metodoPago,
          notasCliente: notasCliente || null,
          nombreContacto,
          telefonoContacto,
          montoDescuento: montoDescuento || null,
          codigoCupon: codigoCupon || null,
        },
        include: { ruta: { include: { configTransporte: { include: TRANSPORTE_INCLUDE } } } },
      });

      // Un descuento de alianza no tiene fila CuponTransporte propia que actualizar.
      if (cuponValidado && !cuponEsAlianza) {
        await tx.cuponTransporteUso.create({
          data: {
            cuponTransporteId: cuponValidado.id,
            clienteId,
            reservaTransporteId: nuevaReserva.id,
          },
        });
        await tx.cuponTransporte.update({
          where: { id: cuponValidado.id },
          data:  { usosActuales: { increment: 1 } },
        });
      }

      return { reserva: nuevaReserva };
    });

    const operadorId = await prisma.comercio.findUnique({
      where: { id: ruta.configTransporte.comercioId }, select: { usuarioId: true },
    }).then(c => c?.usuarioId);
    if (operadorId) {
      await notif(operadorId, "🛥️ Nueva reserva de transporte", `${nombreContacto} reservó ${asientos} asiento(s) en ${ruta.origen} → ${ruta.destino}`, "/comerciante/transportes");
    }

    FacturacionService.emitirParaReferencia("TRANSPORTE", reserva.id).catch((e) =>
      console.error(`[FACTURACION] emisión fallida para ReservaTransporte #${reserva.id}, quedará en reintento:`, e.message)
    );

    return reserva;
  },

  async misReservas(clienteId) {
    return prisma.reservaTransporte.findMany({
      where: { clienteId },
      include: { ruta: { include: { configTransporte: { include: TRANSPORTE_INCLUDE } } }, review: { select: { id: true } } },
      orderBy: { creadoAt: "desc" },
    });
  },

  async cancelarReserva(clienteId, reservaId) {
    const reserva = await prisma.reservaTransporte.findFirst({ where: { id: reservaId, clienteId } });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) throw new ErrorValidacion("No se puede cancelar");
    return prisma.reservaTransporte.update({ where: { id: reservaId }, data: { estado: "CANCELADA", updatedAt: new Date() } });
  },

  // Operador
  async miConfig(comercioId) {
    const cfg = await prisma.configTransporte.findUnique({
      where: { comercioId },
      include: { rutas: { orderBy: { creadoAt: "asc" } } },
    });
    if (!cfg) {
      return prisma.configTransporte.create({
        data: { comercioId, nombre: "Mi Servicio de Transporte", fotos: [] },
        include: { rutas: true },
      });
    }
    return cfg;
  },

  async actualizarConfig(comercioId, datos) {
    return prisma.configTransporte.update({ where: { comercioId }, data: { ...datos, updatedAt: new Date() } });
  },

  async agregarRuta(comercioId, datos) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuración no encontrada");
    return prisma.rutaTransporte.create({ data: { ...datos, configTransporteId: cfg.id } });
  },

  async actualizarRuta(comercioId, rutaId, datos) {
    const ruta = await prisma.rutaTransporte.findFirst({
      where: { id: rutaId, configTransporte: { comercioId } },
    });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");
    return prisma.rutaTransporte.update({ where: { id: rutaId }, data: datos });
  },

  async eliminarRuta(comercioId, rutaId) {
    const ruta = await prisma.rutaTransporte.findFirst({
      where: { id: rutaId, configTransporte: { comercioId } },
    });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");
    return prisma.rutaTransporte.update({ where: { id: rutaId }, data: { activo: false } });
  },

  async reservasOperador(comercioId, estado) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    return prisma.reservaTransporte.findMany({
      where: { ruta: { configTransporteId: cfg.id }, ...(estado ? { estado } : {}) },
      include: { ruta: true, cliente: { select: { id: true, nombre: true, email: true } } },
      orderBy: { fechaViaje: "desc" },
    });
  },

  async cambiarEstado(comercioId, reservaId, nuevoEstado) {
    const TRANSICIONES = {
      PENDIENTE:  ["CONFIRMADA", "RECHAZADA"],
      CONFIRMADA: ["COMPLETADA", "CANCELADA"],
    };
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuración no encontrada");

    const reserva = await prisma.reservaTransporte.findFirst({
      where: { id: reservaId, ruta: { configTransporteId: cfg.id } },
      include: { cliente: { select: { id: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");

    const permitidos = TRANSICIONES[reserva.estado] ?? [];
    if (!permitidos.includes(nuevoEstado)) throw new ErrorValidacion(`No se puede pasar de ${reserva.estado} a ${nuevoEstado}`);

    const actualizada = await prisma.reservaTransporte.update({
      where: { id: reservaId }, data: { estado: nuevoEstado, updatedAt: new Date() },
    });

    const MSGS = {
      CONFIRMADA: ["✅ Viaje confirmado", "Tu reserva de transporte fue confirmada"],
      RECHAZADA:  ["❌ Reserva rechazada", "No pudimos confirmar tu reserva de transporte"],
      COMPLETADA: ["✅ Viaje completado", "¡Gracias por viajar con nosotros!"],
      CANCELADA:  ["❌ Reserva cancelada", "Tu reserva de transporte fue cancelada"],
    };
    const [titulo, cuerpo] = MSGS[nuevoEstado] ?? [`Estado: ${nuevoEstado}`, ""];
    await notif(reserva.cliente.id, titulo, cuerpo, "/transportes/mis-reservas");
    return actualizada;
  },

  async agregarFotos(comercioId, urls) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuración no encontrada");
    return prisma.configTransporte.update({
      where: { comercioId },
      data: { fotos: [...cfg.fotos, ...urls], updatedAt: new Date() },
    });
  },

  // Admin
  async adminListar() {
    return prisma.configTransporte.findMany({
      include: {
        comercio: { select: { id: true, nombre: true, municipio: true, departamento: true } },
        rutas: { where: { activo: true }, select: { id: true } },
        _count: { select: { rutas: true } },
      },
      orderBy: { creadoAt: "desc" },
    });
  },

  async adminCambiarEstado(id, activo) {
    return prisma.configTransporte.update({ where: { id }, data: { activo } });
  },

  // ── VIDEO TRANSPORTE ──────────────────────────────────────────

  async subirVideoTransporte(comercioId, videoUrl, posterUrl, duracion) {
    const config = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!config) throw new Error("Config transporte no encontrada");
    return prisma.configTransporte.update({
      where: { comercioId },
      data: { videoUrl, videoPosterUrl: posterUrl },
    });
  },

  async quitarVideoTransporte(comercioId) {
    return prisma.configTransporte.update({
      where: { comercioId },
      data: { videoUrl: null, videoPosterUrl: null },
    });
  },

  async guardarVideoLinkTransporte(comercioId, videoUrl) {
    return prisma.configTransporte.update({ where: { comercioId }, data: { videoUrl, videoPosterUrl: null } });
  },

  async estadisticas(comercioId, { desde, hasta } = {}) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new Error('No tienes transporte configurado');

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    const reservas = await prisma.reservaTransporte.findMany({
      where: { ruta: { configTransporteId: cfg.id } },
      include: { ruta: { select: { origen: true, destino: true, capacidad: true } } },
      orderBy: { creadoAt: 'desc' },
    });

    const confirmadas = reservas.filter(r => r.estado === 'CONFIRMADA').length;
    const completadas = reservas.filter(r => r.estado === 'COMPLETADA').length;
    const canceladas = reservas.filter(r => ['CANCELADA','RECHAZADA'].includes(r.estado)).length;
    const ingresoTotal = reservas
      .filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado))
      .reduce((s, r) => s + Number(r.total), 0);
    const ingresoMes = reservas
      .filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado) && new Date(r.creadoAt) >= inicioMes)
      .reduce((s, r) => s + Number(r.total), 0);

    // Reservas por mes (últimos 6 meses)
    const reservasPorMes = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth() - i + 1, 1);
      const del_mes = reservas.filter(r => {
        const f = new Date(r.creadoAt);
        return f >= d && f < fin;
      });
      reservasPorMes.push({
        mes: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
        total: del_mes.length,
        ingresos: del_mes.filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado)).reduce((s,r) => s + Number(r.total), 0),
      });
    }

    // Rutas más populares
    const rutaCount = {};
    for (const r of reservas) {
      const key = `${r.ruta.origen}→${r.ruta.destino}`;
      if (!rutaCount[key]) rutaCount[key] = { origen: r.ruta.origen, destino: r.ruta.destino, total: 0 };
      rutaCount[key].total++;
    }
    const rutasPopulares = Object.values(rutaCount).sort((a,b) => b.total - a.total).slice(0,5);

    // Ocupación promedio (asientos reservados / capacidad)
    const activas = reservas.filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado));
    const ocupacion = activas.length > 0
      ? activas.reduce((s,r) => s + (r.asientos / r.ruta.capacidad), 0) / activas.length * 100
      : 0;

    const resultado = {
      totalReservas: reservas.length,
      reservasConfirmadas: confirmadas,
      reservasCompletadas: completadas,
      reservasCanceladas: canceladas,
      ingresoTotal,
      ingresoMes,
      reservasPorMes,
      rutasPopulares,
      ocupacionPromedio: Math.round(ocupacion),
    };

    // Rango de fechas puntual (opcional, para consultas contables)
    if (desde && hasta) {
      const inicioRango = new Date(`${desde}T00:00:00-05:00`);
      const finRango = new Date(`${hasta}T23:59:59-05:00`);

      const reservasRango = reservas.filter(r => {
        const f = new Date(r.creadoAt);
        return f >= inicioRango && f <= finRango;
      });

      const canceladasRango = reservasRango.filter(r => ['CANCELADA','RECHAZADA'].includes(r.estado)).length;
      const ingresosRango = reservasRango
        .filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado))
        .reduce((s, r) => s + Number(r.total), 0);

      const rutaCountRango = {};
      for (const r of reservasRango) {
        const key = `${r.ruta.origen}→${r.ruta.destino}`;
        if (!rutaCountRango[key]) rutaCountRango[key] = { origen: r.ruta.origen, destino: r.ruta.destino, total: 0 };
        rutaCountRango[key].total++;
      }
      const rutasPopularesRango = Object.values(rutaCountRango).sort((a,b) => b.total - a.total).slice(0,5);

      resultado.rango = {
        reservas: reservasRango.length,
        ingresos: ingresosRango,
        canceladas: canceladasRango,
        rutasPopulares: rutasPopularesRango,
        desde,
        hasta,
      };
    }

    return resultado;
  },

  // ── FAVORITOS ─────────────────────────────────────────────────

  async toggleFavorito(usuarioId, configTransporteId) {
    const existe = await prisma.favoritoTransporte.findUnique({
      where: { usuarioId_configTransporteId: { usuarioId, configTransporteId } },
    });
    if (existe) {
      await prisma.favoritoTransporte.delete({ where: { id: existe.id } });
      return { favorito: false };
    } else {
      await prisma.favoritoTransporte.create({ data: { usuarioId, configTransporteId } });
      return { favorito: true };
    }
  },

  async misFavoritosTransporte(usuarioId) {
    const favs = await prisma.favoritoTransporte.findMany({
      where: { usuarioId },
      include: {
        configTransporte: {
          include: {
            ...TRANSPORTE_INCLUDE,
            rutas: { where: { activo: true }, orderBy: { horario: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map(f => f.configTransporte);
  },

  async esFavoritoTransporte(usuarioId, configTransporteId) {
    const existe = await prisma.favoritoTransporte.findUnique({
      where: { usuarioId_configTransporteId: { usuarioId, configTransporteId } },
    });
    return { favorito: !!existe };
  },

  // ── CUPONES DE TRANSPORTE ──────────────────────────────────────

  async validarCuponTransporte(codigo, configTransporteId, asientos, clienteId, totalOriginal, comercioId = null) {
    return validarCuponTransporteInterno(prisma, codigo, configTransporteId, asientos, clienteId, totalOriginal, { comercioId });
  },

  async crearCuponTransporte(comercioId, datos) {
    const transporte = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!transporte || !transporte.activo) throw new ErrorValidacion("No tienes un servicio de transporte activo");

    const { codigo, tipo = "PORCENTAJE", valor, minimoAsientos, usosMaximos, inicio, fin } = datos;
    if (!codigo || !valor || !inicio || !fin) throw new ErrorValidacion("Faltan campos requeridos: codigo, valor, inicio, fin");

    return prisma.cuponTransporte.create({
      data: {
        codigo:         codigo.trim().toUpperCase(),
        tipo,
        valor:          Number(valor),
        minimoAsientos: minimoAsientos ? Number(minimoAsientos) : null,
        usosMaximos:    usosMaximos    ? Number(usosMaximos)    : null,
        inicio:         new Date(inicio),
        fin:            new Date(fin),
        configTransporteId: transporte.id,
      },
    });
  },

  async listarCuponesTransporte(comercioId) {
    const transporte = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!transporte) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");

    return prisma.cuponTransporte.findMany({
      where:   { configTransporteId: transporte.id },
      orderBy: { createdAt: "desc" },
    });
  },

  async eliminarCuponTransporte(comercioId, cuponId) {
    const transporte = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!transporte) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");

    const cupon = await prisma.cuponTransporte.findFirst({
      where: { id: cuponId, configTransporteId: transporte.id },
    });
    if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado");

    return prisma.cuponTransporte.update({
      where: { id: cuponId },
      data:  { activo: false },
    });
  },
};

module.exports = TransporteService;
