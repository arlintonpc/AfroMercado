const prisma = require("../config/prisma");
const QRCode = require("qrcode");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const sseManager = require("../utils/sse-manager");
const { enviarPushAUsuario } = require("../utils/push");
const AlianzaService = require("./alianza.service");
const FacturacionService = require("./facturacion.service");
const {
  buscarCuponVertical, bloquearYRevalidar, yaUsadoPorCliente,
  calcularDescuento, intentarAlianza, registrarUsoVertical, mapearCuponVertical,
} = require("../utils/cupon-vertical");

const TASA_COMISION_TRANSPORTE = 0.10;

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TX-${ts}-${rnd}`;
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function operaEnFecha(ruta, fecha) {
  // Una ruta sin dias configurados conserva el comportamiento heredado: opera todos los dias.
  if (!ruta.diasSemana || ruta.diasSemana.length === 0) return true;
  const fechaLocal = new Date(`${fecha}T12:00:00`);
  const diasNormalizados = ruta.diasSemana.map((d) => String(d).toLowerCase());
  return diasNormalizados.includes(DIAS_SEMANA[fechaLocal.getDay()]);
}

function datosRutaPermitidos(datos) {
  const permitidos = [
    "origen", "destino", "puntoAbordaje", "puntoDescenso", "horario", "horaLlegada",
    "duracionMinutos", "diasSemana", "capacidad", "precioAsiento", "activo",
  ];
  return Object.fromEntries(Object.entries(datos).filter(([campo]) => permitidos.includes(campo)));
}

function normalizarPuestos(puestos) {
  if (!Array.isArray(puestos)) return [];
  return [...new Set(puestos.map((puesto) => String(puesto).trim()).filter((puesto) => /^\d+$/.test(puesto)))];
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
  let cupon = await buscarCuponVertical(db, { codigo, tipoEntidad: "CONFIG_TRANSPORTE", entidadId: configTransporteId });

  if (!cupon) {
    const alianza = await intentarAlianza(comercioId, codigo, "TRANSPORTE", totalOriginal);
    if (alianza) {
      return {
        cupon: { codigo: alianza.codigo },
        descuento: alianza.descuento,
        totalConDescuento: Number(totalOriginal) - alianza.descuento,
        esAlianza: true,
      };
    }
    throw new ErrorValidacion("Cupon no valido o expirado");
  }
  if (bloquear) {
    cupon = await bloquearYRevalidar(db, "CuponVertical", cupon.id);
    if (!cupon) throw new ErrorValidacion("Cupon no valido o expirado");
  }

  if (cupon.minimoAplicable && asientos < Number(cupon.minimoAplicable)) {
    throw new ErrorValidacion(`Este cupon requiere minimo ${Number(cupon.minimoAplicable)} asiento(s)`);
  }

  if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
    throw new ErrorValidacion("El cupon ha alcanzado el limite de usos");
  }

  if (await yaUsadoPorCliente(db, cupon.id, clienteId)) {
    throw new ErrorValidacion("Ya usaste este cupon");
  }

  const descuento = calcularDescuento(cupon, totalOriginal);
  const totalConDescuento = Number(totalOriginal) - descuento;
  return { cupon, descuento, totalConDescuento };
}

const TransporteService = {
  async listar({ municipio, departamento } = {}) {
    const comercioWhere = { verificado: true };
    if (municipio) comercioWhere.municipio = { contains: municipio, mode: "insensitive" };
    if (departamento) comercioWhere.departamento = { contains: departamento, mode: "insensitive" };

    const transportes = await prisma.configTransporte.findMany({
      where: { activo: true, comercio: comercioWhere },
      include: { ...TRANSPORTE_INCLUDE, rutas: { where: { activo: true }, orderBy: { horario: "asc" } } },
      orderBy: { creadoAt: "desc" },
    });
    
    // Inyectar Banners Publicitarios (Red de Display Cruzada)
    const banners = await prisma.anuncioUbicacion.findMany({
      where: { 
        modulo: 'TRANSPORTE', 
        formato: 'BANNER', 
        activa: true,
        campana: { estado: 'ACTIVA' }
      },
      include: { campana: true },
    });

    const shuffledBanners = banners.sort(() => 0.5 - Math.random()).slice(0, 2);
    let itemsHibridos = [...transportes];

    if (shuffledBanners[0] && itemsHibridos.length >= 3) {
      itemsHibridos.splice(3, 0, {
        id: `banner-${shuffledBanners[0].id}`,
        esBannerDisplay: true,
        titulo: shuffledBanners[0].titulo,
        subtitulo: shuffledBanners[0].subtitulo,
        mediaUrl: shuffledBanners[0].mediaUrl,
        urlDestino: shuffledBanners[0].urlDestino,
        ctaTexto: shuffledBanners[0].ctaTexto,
        etiqueta: shuffledBanners[0].etiqueta,
      });
    }

    if (shuffledBanners[1] && itemsHibridos.length >= 7) {
      itemsHibridos.splice(7, 0, {
        id: `banner-${shuffledBanners[1].id}`,
        esBannerDisplay: true,
        titulo: shuffledBanners[1].titulo,
        subtitulo: shuffledBanners[1].subtitulo,
        mediaUrl: shuffledBanners[1].mediaUrl,
        urlDestino: shuffledBanners[1].urlDestino,
        ctaTexto: shuffledBanners[1].ctaTexto,
        etiqueta: shuffledBanners[1].etiqueta,
      });
    }

    return itemsHibridos;
  },

  async obtener(id) {
    const t = await prisma.configTransporte.findUnique({
      where: { id },
      include: { ...TRANSPORTE_INCLUDE, rutas: { where: { activo: true }, orderBy: { horario: "asc" } } },
    });
    if (!t) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");
    return t;
  },

  async verificarDisponibilidad(rutaId, fecha, salidaTransporteId = null) {
    const ruta = await prisma.rutaTransporte.findUnique({ where: { id: rutaId } });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");

    if (!fecha || Number.isNaN(new Date(`${fecha}T12:00:00`).getTime())) {
      throw new ErrorValidacion("Fecha de viaje invalida");
    }
    if (!salidaTransporteId && !operaEnFecha(ruta, fecha)) {
      return { disponibles: 0, capacidad: ruta.capacidad, opera: false };
    }

    let salida = null;
    if (salidaTransporteId) {
      salida = await prisma.salidaTransporte.findFirst({ where: { id: salidaTransporteId, rutaTransporteId: rutaId } });
      if (!salida || salida.estado !== "PROGRAMADA") return { disponibles: 0, capacidad: 0, opera: false };
    }

    const fechaD = new Date(fecha);
    const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaD); fin.setHours(23, 59, 59, 999);

    const reservados = await prisma.reservaTransporte.aggregate({
      where: salida ? { salidaTransporteId, estado: { in: ["PENDIENTE", "CONFIRMADA"] } } : { rutaTransporteId: rutaId, fechaViaje: { gte: inicio, lte: fin }, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
      _sum: { asientos: true },
    });
    const ocupados = reservados._sum.asientos ?? 0;
    const capacidad = salida?.capacidad ?? ruta.capacidad;
    return { disponibles: Math.max(0, capacidad - ocupados), capacidad, opera: true };
  },

  async crearReserva(clienteId, { rutaTransporteId, salidaTransporteId, fechaViaje, asientos, puestos, metodoPago, notasCliente, nombreContacto, telefonoContacto, codigoCupon }) {
    const ruta = await prisma.rutaTransporte.findUnique({
      where: { id: rutaTransporteId },
      include: { configTransporte: { include: TRANSPORTE_INCLUDE } },
    });
    if (!ruta || !ruta.activo) throw new ErrorValidacion("Ruta no disponible");
    if (!salidaTransporteId && !operaEnFecha(ruta, fechaViaje)) throw new ErrorValidacion("Esta ruta no opera en la fecha seleccionada");

    // Chequeo rápido fuera de la transacción (optimización UX, no atómico) — la
    // garantía real contra sobreventa concurrente viene del lock dentro de la
    // transacción, igual que en Hotel/Tour.
    const disp = await TransporteService.verificarDisponibilidad(rutaTransporteId, fechaViaje, salidaTransporteId);
    if (disp.disponibles < asientos) throw new ErrorValidacion("No hay suficientes asientos disponibles");

    const totalOriginal = Number(ruta.precioAsiento) * asientos;
    const puestosSeleccionados = normalizarPuestos(puestos);
    if (salidaTransporteId && puestosSeleccionados.length !== Number(asientos)) {
      throw new ErrorValidacion("Selecciona exactamente los asientos que deseas reservar");
    }

    const { reserva } = await prisma.$transaction(async (tx) => {
      // Bloquea la fila de la ruta para serializar reservas concurrentes sobre el
      // mismo cupo (antes esta verificación no tenía ningún lock — dos reservas
      // simultáneas podían ambas pasar el chequeo y sobrevender asientos).
      await tx.$queryRaw`SELECT id FROM "RutaTransporte" WHERE id = ${rutaTransporteId} FOR UPDATE`;
      if (salidaTransporteId) await tx.$queryRaw`SELECT id FROM "SalidaTransporte" WHERE id = ${salidaTransporteId} FOR UPDATE`;

      const fechaD = new Date(fechaViaje);
      const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
      const fin    = new Date(fechaD); fin.setHours(23, 59, 59, 999);
      const salidaDentroDeTx = salidaTransporteId ? await tx.salidaTransporte.findFirst({ where: { id: salidaTransporteId, rutaTransporteId, estado: "PROGRAMADA" } }) : null;
      if (salidaTransporteId && !salidaDentroDeTx) throw new ErrorValidacion("La salida seleccionada no esta disponible");
      const reservadosDentroDeTx = await tx.reservaTransporte.aggregate({
        where: salidaTransporteId ? { salidaTransporteId, estado: { in: ["PENDIENTE", "CONFIRMADA"] } } : { rutaTransporteId, fechaViaje: { gte: inicio, lte: fin }, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
        _sum: { asientos: true },
      });
      const capacidadDentroDeTx = salidaDentroDeTx?.capacidad ?? ruta.capacidad;
      const disponiblesDentroDeTx = Math.max(0, capacidadDentroDeTx - (reservadosDentroDeTx._sum.asientos ?? 0));
      if (disponiblesDentroDeTx < asientos) throw new ErrorValidacion("No hay suficientes asientos disponibles");
      if (salidaTransporteId && puestosSeleccionados.some((puesto) => Number(puesto) < 1 || Number(puesto) > capacidadDentroDeTx)) {
        throw new ErrorValidacion("Uno o mas asientos no pertenecen a esta salida");
      }

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
      const comision = Math.round(total * TASA_COMISION_TRANSPORTE);

      const nuevaReserva = await tx.reservaTransporte.create({
        data: {
          codigo: generarCodigo(),
          rutaTransporteId,
          salidaTransporteId: salidaTransporteId || null,
          clienteId,
          fechaViaje: new Date(fechaViaje),
          asientos,
          total,
          comision,
          tasaComision: TASA_COMISION_TRANSPORTE,
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

      if (salidaTransporteId) {
        try {
          await tx.asientoReservaTransporte.createMany({
            data: puestosSeleccionados.map((codigoAsiento) => ({ salidaTransporteId, reservaTransporteId: nuevaReserva.id, codigoAsiento })),
          });
        } catch (error) {
          if (error?.code === "P2002") throw new ErrorValidacion("Uno de los asientos acaba de ser reservado. Elige otro.");
          throw error;
        }
      }

      // Un descuento de alianza no tiene fila CuponVertical propia que actualizar.
      if (cuponValidado && !cuponEsAlianza) {
        await registrarUsoVertical(tx, {
          cuponId: cuponValidado.id, clienteId,
          tipoEntidad: "CONFIG_TRANSPORTE", entidadId: nuevaReserva.id,
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

  async listarSalidas(rutaId, fecha) {
    const inicio = new Date(`${fecha}T00:00:00`);
    const fin = new Date(`${fecha}T23:59:59.999`);
    return prisma.salidaTransporte.findMany({
      where: { rutaTransporteId: rutaId, fechaHora: { gte: inicio, lte: fin }, estado: "PROGRAMADA" },
      orderBy: { fechaHora: "asc" },
    });
  },

  async listarAsientosSalida(salidaId) {
    const salida = await prisma.salidaTransporte.findUnique({ include: { ruta: true }, where: { id: salidaId } });
    if (!salida || salida.estado !== "PROGRAMADA") throw new ErrorNoEncontrado("Salida no disponible");
    const asientos = await prisma.asientoReservaTransporte.findMany({
      where: { salidaTransporteId: salidaId, reserva: { estado: { in: ["PENDIENTE", "CONFIRMADA"] } } },
      select: { codigoAsiento: true },
    });
    return { capacidad: salida.capacidad ?? salida.ruta.capacidad, ocupados: asientos.map((asiento) => asiento.codigoAsiento) };
  },

  async crearSalida(comercioId, rutaId, datos) {
    const ruta = await prisma.rutaTransporte.findFirst({ where: { id: rutaId, configTransporte: { comercioId } } });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");
    const fechaHora = new Date(datos.fechaHora);
    if (Number.isNaN(fechaHora.getTime())) throw new ErrorValidacion("Fecha y hora de salida invalidas");
    if (datos.capacidad != null && (!Number.isInteger(Number(datos.capacidad)) || Number(datos.capacidad) < 1)) throw new ErrorValidacion("La capacidad debe ser mayor que cero");
    if (datos.vehiculoId) {
      const vehiculo = await prisma.vehiculoTransporte.findFirst({ where: { id: Number(datos.vehiculoId), configTransporte: { comercioId }, activo: true } });
      if (!vehiculo) throw new ErrorValidacion("Vehiculo no disponible");
    }
    return prisma.salidaTransporte.create({ data: { rutaTransporteId: rutaId, fechaHora, capacidad: datos.capacidad ?? null, vehiculoId: datos.vehiculoId ? Number(datos.vehiculoId) : null, conductorNombre: datos.conductorNombre?.trim() || null, notasOperativas: datos.notasOperativas?.trim() || null } });
  },

  async listarVehiculos(comercioId) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    return prisma.vehiculoTransporte.findMany({ where: { configTransporteId: cfg.id }, orderBy: { creadoAt: "desc" } });
  },

  async listarSalidasOperador(comercioId) {
    return prisma.salidaTransporte.findMany({
      where: { ruta: { configTransporte: { comercioId } }, fechaHora: { gte: new Date() } },
      include: { ruta: true, vehiculo: true },
      orderBy: { fechaHora: "asc" },
      take: 100,
    });
  },

  async crearVehiculo(comercioId, datos) {
    const cfg = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configuracion no encontrada");
    const capacidad = Number(datos.capacidad);
    if (!datos.nombre?.trim() || !datos.tipo?.trim() || !Number.isInteger(capacidad) || capacidad < 1) throw new ErrorValidacion("Nombre, tipo y capacidad valida son obligatorios");
    return prisma.vehiculoTransporte.create({ data: { configTransporteId: cfg.id, nombre: datos.nombre.trim(), tipo: datos.tipo.trim(), placa: datos.placa?.trim().toUpperCase() || null, capacidad } });
  },

  async actualizarVehiculo(comercioId, vehiculoId, datos) {
    const vehiculo = await prisma.vehiculoTransporte.findFirst({ where: { id: vehiculoId, configTransporte: { comercioId } } });
    if (!vehiculo) throw new ErrorNoEncontrado("Vehiculo no encontrado");
    const capacidad = datos.capacidad == null ? vehiculo.capacidad : Number(datos.capacidad);
    if (!Number.isInteger(capacidad) || capacidad < 1) throw new ErrorValidacion("Capacidad invalida");
    return prisma.vehiculoTransporte.update({ where: { id: vehiculoId }, data: { nombre: datos.nombre?.trim() || vehiculo.nombre, tipo: datos.tipo?.trim() || vehiculo.tipo, placa: datos.placa === undefined ? vehiculo.placa : (datos.placa?.trim().toUpperCase() || null), capacidad, activo: datos.activo === undefined ? vehiculo.activo : Boolean(datos.activo) } });
  },

  async cambiarEstadoOperacionSalida(comercioId, salidaId, estadoOperacion) {
    const permitidos = ["PROGRAMADA", "EN_ABORDAJE", "EN_RUTA", "FINALIZADA"];
    if (!permitidos.includes(estadoOperacion)) throw new ErrorValidacion("Estado operativo invalido");
    const salida = await prisma.salidaTransporte.findFirst({ where: { id: salidaId, ruta: { configTransporte: { comercioId } } }, include: { reservas: { where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] } }, include: { cliente: { select: { id: true } } } }, ruta: true } });
    if (!salida) throw new ErrorNoEncontrado("Salida no encontrada");
    const actualizada = await prisma.salidaTransporte.update({ where: { id: salidaId }, data: { estadoOperacion } });
    await Promise.all(salida.reservas.map(reserva => notif(reserva.cliente.id, `Viaje ${estadoOperacion.toLowerCase().replace("_", " ")}`, `${salida.ruta.origen} -> ${salida.ruta.destino}`, "/transportes/mis-reservas")));
    return actualizada;
  },

  async registrarAbordaje(comercioId, reservaId, tipo) {
    if (!["ABORDO", "NO_SHOW"].includes(tipo)) throw new ErrorValidacion("Registro de abordaje invalido");
    const reserva = await prisma.reservaTransporte.findFirst({ where: { id: reservaId, ruta: { configTransporte: { comercioId } } } });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (reserva.estado !== "CONFIRMADA") throw new ErrorValidacion("Solo se puede registrar una reserva confirmada");
    return prisma.reservaTransporte.update({ where: { id: reservaId }, data: tipo === "ABORDO" ? { abordadoAt: new Date() } : { noShowAt: new Date() } });
  },

  async cambiarEstadoSalida(comercioId, salidaId, estado) {
    if (!["PROGRAMADA", "CANCELADA"].includes(estado)) throw new ErrorValidacion("Estado de salida invalido");
    const salida = await prisma.salidaTransporte.findFirst({
      where: { id: salidaId, ruta: { configTransporte: { comercioId } } },
      include: { ruta: true },
    });
    if (!salida) throw new ErrorNoEncontrado("Salida no encontrada");
    const actualizada = await prisma.salidaTransporte.update({ where: { id: salidaId }, data: { estado } });

    // Una salida cancelada no cambia silenciosamente: cada pasajero activo recibe
    // el aviso y puede gestionar su reserva desde sus viajes.
    if (estado === "CANCELADA" && salida.estado !== "CANCELADA") {
      const reservasActivas = await prisma.reservaTransporte.findMany({
        where: { salidaTransporteId: salidaId, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
        include: { cliente: { select: { id: true } } },
      });
      await Promise.all(reservasActivas.map((reserva) =>
        notif(
          reserva.cliente.id,
          "Salida cancelada",
          `La salida ${salida.ruta.origen} -> ${salida.ruta.destino} fue cancelada. Revisa tus viajes para gestionar la reserva.`,
          "/transportes/mis-reservas"
        )
      ));
    }
    return actualizada;
  },

  async misReservas(clienteId) {
    const reservas = await prisma.reservaTransporte.findMany({
      where: { clienteId },
      include: { salida: { include: { vehiculo: true } }, ruta: { include: { configTransporte: { include: TRANSPORTE_INCLUDE } } } },
      orderBy: { creadoAt: "desc" },
    });
    // Resena (Fase 3, Anexo B) no tiene relación directa a ReservaTransporte
    // (entidadId no es FK real) — se resuelve con una sola consulta por lote.
    if (reservas.length === 0) return reservas;
    const resenas = await prisma.resena.findMany({
      where: { tipoEntidad: "RESERVA_TRANSPORTE", entidadId: { in: reservas.map(r => r.id) }, autorId: clienteId },
      select: { id: true, entidadId: true },
    });
    const resenaPorReserva = new Map(resenas.map(r => [r.entidadId, r]));
    return reservas.map(r => ({ ...r, review: resenaPorReserva.get(r.id) ?? null }));
  },

  async cancelarReserva(clienteId, reservaId) {
    const reserva = await prisma.reservaTransporte.findFirst({ where: { id: reservaId, clienteId } });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) throw new ErrorValidacion("No se puede cancelar");
    return prisma.reservaTransporte.update({ where: { id: reservaId }, data: { estado: "CANCELADA", updatedAt: new Date() } });
  },

  async reprogramarReserva(clienteId, reservaId, salidaTransporteId, puestos) {
    const reserva = await prisma.reservaTransporte.findFirst({ where: { id: reservaId, clienteId } });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) throw new ErrorValidacion("Esta reserva no se puede reprogramar");
    const puestosSeleccionados = normalizarPuestos(puestos);
    if (puestosSeleccionados.length !== reserva.asientos) throw new ErrorValidacion("Selecciona todos los nuevos asientos");
    return prisma.$transaction(async (tx) => {
      const salida = await tx.salidaTransporte.findFirst({ where: { id: Number(salidaTransporteId), rutaTransporteId: reserva.rutaTransporteId, estado: "PROGRAMADA" }, include: { ruta: true } });
      if (!salida) throw new ErrorValidacion("La nueva salida no esta disponible para esta ruta");
      await tx.$queryRaw`SELECT id FROM "SalidaTransporte" WHERE id = ${salida.id} FOR UPDATE`;
      const ocupados = await tx.reservaTransporte.aggregate({ where: { salidaTransporteId: salida.id, estado: { in: ["PENDIENTE", "CONFIRMADA"] }, id: { not: reserva.id } }, _sum: { asientos: true } });
      const capacidad = salida.capacidad ?? salida.ruta.capacidad;
      if (capacidad - (ocupados._sum.asientos ?? 0) < reserva.asientos) throw new ErrorValidacion("La nueva salida no tiene cupos suficientes");
      if (puestosSeleccionados.some(puesto => Number(puesto) < 1 || Number(puesto) > capacidad)) throw new ErrorValidacion("Uno o mas asientos no pertenecen a la nueva salida");
      await tx.asientoReservaTransporte.deleteMany({ where: { reservaTransporteId: reserva.id } });
      await tx.asientoReservaTransporte.createMany({ data: puestosSeleccionados.map(codigoAsiento => ({ salidaTransporteId: salida.id, reservaTransporteId: reserva.id, codigoAsiento })) });
      return tx.reservaTransporte.update({ where: { id: reserva.id }, data: { salidaTransporteId: salida.id, fechaViaje: salida.fechaHora, updatedAt: new Date() } });
    });
  },

  async obtenerTicket(clienteId, reservaId) {
    const reserva = await prisma.reservaTransporte.findFirst({
      where: { id: reservaId, clienteId },
      include: { salida: true, ruta: { include: { configTransporte: { include: TRANSPORTE_INCLUDE } } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva no encontrada");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) {
      throw new ErrorValidacion("El pase QR no esta disponible para esta reserva");
    }
    const contenidoQr = JSON.stringify({ tipo: "PASE_TRANSPORTE", codigo: reserva.codigo, reservaId: reserva.id });
    const qrDataUrl = await QRCode.toDataURL(contenidoQr, { margin: 1, width: 360, errorCorrectionLevel: "M" });
    return { reserva, qrDataUrl };
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
    const ruta = datosRutaPermitidos(datos);
    if (!ruta.origen || !ruta.destino || !ruta.horario) throw new ErrorValidacion("Origen, destino y hora de salida son obligatorios");
    if (!Number.isInteger(Number(ruta.capacidad)) || Number(ruta.capacidad) < 1) throw new ErrorValidacion("La capacidad debe ser mayor que cero");
    if (Number(ruta.precioAsiento) < 0) throw new ErrorValidacion("El precio por asiento no puede ser negativo");
    return prisma.rutaTransporte.create({ data: { ...ruta, configTransporteId: cfg.id } });
  },

  async actualizarRuta(comercioId, rutaId, datos) {
    const ruta = await prisma.rutaTransporte.findFirst({
      where: { id: rutaId, configTransporte: { comercioId } },
    });
    if (!ruta) throw new ErrorNoEncontrado("Ruta no encontrada");
    const rutaActualizada = datosRutaPermitidos(datos);
    if (rutaActualizada.capacidad !== undefined && (!Number.isInteger(Number(rutaActualizada.capacidad)) || Number(rutaActualizada.capacidad) < 1)) {
      throw new ErrorValidacion("La capacidad debe ser mayor que cero");
    }
    if (rutaActualizada.precioAsiento !== undefined && Number(rutaActualizada.precioAsiento) < 0) throw new ErrorValidacion("El precio por asiento no puede ser negativo");
    return prisma.rutaTransporte.update({ where: { id: rutaId }, data: rutaActualizada });
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
      include: { salida: true, ruta: true, cliente: { select: { id: true, nombre: true, email: true } } },
      orderBy: { fechaViaje: "desc" },
    });
  },

  async manifiestoSalida(comercioId, salidaId) {
    const salida = await prisma.salidaTransporte.findFirst({
      where: { id: salidaId, ruta: { configTransporte: { comercioId } } },
      include: {
        ruta: { include: { configTransporte: { select: { nombre: true, tipo: true } } } },
        reservas: {
          where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
          include: { cliente: { select: { id: true, nombre: true, email: true } } },
          orderBy: { creadoAt: "asc" },
        },
      },
    });
    if (!salida) throw new ErrorNoEncontrado("Salida no encontrada");
    const asientosReservados = salida.reservas.reduce((total, reserva) => total + reserva.asientos, 0);
    return { ...salida, asientosReservados, capacidadTotal: salida.capacidad ?? salida.ruta.capacidad };
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
    const comisionTotal = reservas
      .filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado))
      .reduce((s, r) => s + Number(r.comision ?? 0), 0);
    const comisionMes = reservas
      .filter(r => ['CONFIRMADA','COMPLETADA'].includes(r.estado) && new Date(r.creadoAt) >= inicioMes)
      .reduce((s, r) => s + Number(r.comision ?? 0), 0);

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
      comisionTotal,
      comisionMes,
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
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "CONFIG_TRANSPORTE", entidadId: configTransporteId } },
    });
    if (existe) {
      await prisma.favorito.delete({ where: { id: existe.id } });
      return { favorito: false };
    } else {
      await prisma.favorito.create({ data: { usuarioId, tipoEntidad: "CONFIG_TRANSPORTE", entidadId: configTransporteId } });
      return { favorito: true };
    }
  },

  async misFavoritosTransporte(usuarioId) {
    const favs = await prisma.favorito.findMany({
      where: { usuarioId, tipoEntidad: "CONFIG_TRANSPORTE" },
      orderBy: { createdAt: 'desc' },
    });
    if (favs.length === 0) return [];
    const configs = await prisma.configTransporte.findMany({
      where: { id: { in: favs.map(f => f.entidadId) } },
      include: {
        ...TRANSPORTE_INCLUDE,
        rutas: { where: { activo: true }, orderBy: { horario: 'asc' } },
      },
    });
    const porId = new Map(configs.map(c => [c.id, c]));
    return favs.map(f => porId.get(f.entidadId)).filter(Boolean);
  },

  async esFavoritoTransporte(usuarioId, configTransporteId) {
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "CONFIG_TRANSPORTE", entidadId: configTransporteId } },
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

    const cupon = await prisma.cuponVertical.create({
      data: {
        codigo:          codigo.trim().toUpperCase(),
        tipoEntidad:     "CONFIG_TRANSPORTE",
        tipo,
        valor:           Number(valor),
        minimoAplicable: minimoAsientos ? Number(minimoAsientos) : null,
        usosMaximos:     usosMaximos    ? Number(usosMaximos)    : null,
        inicio:          new Date(inicio),
        fin:             new Date(fin),
        entidadId:       transporte.id,
      },
    });
    return mapearCuponVertical(cupon, "minimoAsientos", "configTransporteId");
  },

  async listarCuponesTransporte(comercioId) {
    const transporte = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!transporte) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");

    const cupones = await prisma.cuponVertical.findMany({
      where:   { tipoEntidad: "CONFIG_TRANSPORTE", entidadId: transporte.id },
      orderBy: { createdAt: "desc" },
    });
    return cupones.map((c) => mapearCuponVertical(c, "minimoAsientos", "configTransporteId"));
  },

  async eliminarCuponTransporte(comercioId, cuponId) {
    const transporte = await prisma.configTransporte.findUnique({ where: { comercioId } });
    if (!transporte) throw new ErrorNoEncontrado("Servicio de transporte no encontrado");

    const cupon = await prisma.cuponVertical.findFirst({
      where: { id: cuponId, tipoEntidad: "CONFIG_TRANSPORTE", entidadId: transporte.id },
    });
    if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado");

    return prisma.cuponVertical.update({
      where: { id: cuponId },
      data:  { activo: false },
    });
  },
};

module.exports = TransporteService;
