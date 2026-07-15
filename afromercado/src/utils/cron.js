// Jobs programados que corren en el mismo proceso Node.
// Usan setInterval; no requieren dependencias externas.
const prisma = require("../config/prisma");
const sseManager = require("./sse-manager");
const { enviarMensajeWA } = require("./whatsapp");
const ExpressService = require("../services/express.service");
const HotelService = require("../services/hotel.service");

async function cancelarPedidosExpressExpirados() {
  try {
    const n = await ExpressService.cancelarExpirados();
    if (n > 0) console.log(`[CRON] Express: ${n} pedido(s) cancelado(s) por expiración`);
  } catch (err) {
    console.error("[CRON] Express cancelarExpirados:", err.message);
  }
}

async function cancelarReservasHotelExpiradas() {
  try {
    // Buscar reservas PENDIENTE cuyo tiempo límite de confirmación ya venció
    const reservas = await prisma.reservaHotel.findMany({
      where: { estado: "PENDIENTE" },
      include: {
        configHotel: { select: { horasLimiteConfirm: true } },
        cliente: { select: { id: true, nombre: true } },
        habitacionTipo: { select: { nombre: true } },
      },
    });

    let canceladas = 0;
    for (const r of reservas) {
      const horas = r.configHotel?.horasLimiteConfirm ?? 2;
      const limite = new Date(r.creadoAt.getTime() + horas * 60 * 60 * 1000);
      if (new Date() < limite) continue;

      await prisma.reservaHotel.update({
        where: { id: r.id },
        data: { estado: "CANCELADA", updatedAt: new Date() },
      });

      // Notificar al cliente
      try {
        await prisma.notificacion.create({
          data: {
            usuarioId: r.clienteId,
            tipo: "GENERAL",
            titulo: "Reserva no confirmada",
            mensaje: `Tu reserva ${r.codigo} (${r.habitacionTipo?.nombre}) fue cancelada automáticamente por falta de respuesta del hotel.`,
            url: "/hoteles/mis-reservas",
          },
        });
        sseManager.enviar(r.clienteId, "notificacion", {
          tipo: "HOTEL",
          titulo: "Reserva cancelada",
          mensaje: `Tu reserva ${r.codigo} fue cancelada por falta de respuesta.`,
          url: "/hoteles/mis-reservas",
        });
      } catch {}

      canceladas++;
    }

    if (canceladas > 0) console.log(`[CRON] Hotel: ${canceladas} reserva(s) cancelada(s) por falta de respuesta`);
  } catch (err) {
    console.error("[CRON] Hotel cancelarReservasExpiradas:", err.message);
  }
}

const CADA_5_MIN  = 5  * 60 * 1000;
const CADA_10_MIN = 10 * 60 * 1000;
const CADA_1_HORA = 60 * 60 * 1000;

// ─── Helper local (no importa NotificacionService para evitar ciclo) ─────────

async function crearNotif(usuarioId, datos) {
  try {
    const notif = await prisma.notificacion.create({
      data: { usuarioId, leida: false, ...datos },
    });
    sseManager.enviar(usuarioId, "notificacion", notif);
  } catch (e) {
    console.error("[CRON-NOTIF]", e.message);
  }
}

async function notificarAdmins(datos) {
  try {
    const admins = await prisma.usuario.findMany({
      where: { rol: "ADMIN" }, select: { id: true },
    });
    for (const a of admins) await crearNotif(a.id, datos);
  } catch (e) {
    console.error("[CRON-NOTIF-ADMIN]", e.message);
  }
}

function primerNombre(nombre) {
  return (nombre || "").split(" ")[0] || nombre || "";
}

// ─── Job 1: Expirar pedidos vencidos (ya existía) ────────────────────────────

async function expirarPedidosVencidos() {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { estado: "PENDIENTE_PAGO", expiresAt: { lt: new Date() } },
      include: { subPedidos: { include: { items: true } } },
    });

    if (!pedidos.length) return;

    for (const pedido of pedidos) {
      await prisma.$transaction(async (tx) => {
        for (const sub of pedido.subPedidos) {
          for (const item of sub.items) {
            await tx.$executeRaw`
              UPDATE "Producto"
              SET "stockReservado" = GREATEST("stockReservado" - ${item.cantidad}, 0)
              WHERE id = ${item.productoId}
            `;
            if (item.ofertaId) {
              await tx.$executeRaw`
                UPDATE "Oferta"
                SET "stockUsado" = GREATEST("stockUsado" - ${item.cantidad}, 0)
                WHERE id = ${item.ofertaId}
              `;
            }
          }
        }
        await tx.pedido.update({ where: { id: pedido.id }, data: { estado: "EXPIRADO" } });
      });
      console.log(`[CRON] Pedido #${pedido.id} expirado — stock liberado`);
    }

    console.log(`[CRON] ${pedidos.length} pedido(s) expirado(s) y stock liberado`);
  } catch (err) {
    console.error("[CRON] expirarPedidosVencidos:", err.message);
  }
}

// ─── Job 2: Recordatorio de pago 30 min antes de vencer — N-C-02 ─────────────

async function recordatoriosPago() {
  try {
    const ahora    = new Date();
    const en30min  = new Date(ahora.getTime() + 30 * 60 * 1000);
    const hace35   = new Date(ahora.getTime() - 35 * 60 * 1000);

    const pedidos = await prisma.pedido.findMany({
      where: { estado: "PENDIENTE_PAGO", expiresAt: { gt: ahora, lte: en30min } },
      include: { comprador: { select: { id: true, nombre: true, telefono: true } } },
    });

    for (const pedido of pedidos) {
      // Deduplicar: no enviar si ya hubo notif de este tipo en los últimos 35 min
      const yaEnviado = await prisma.notificacion.findFirst({
        where: {
          usuarioId: pedido.compradorId,
          tipo: "RECORDATORIO_PAGO",
          createdAt: { gte: hace35 },
        },
      });
      if (yaEnviado) continue;

      await crearNotif(pedido.compradorId, {
        tipo: "RECORDATORIO_PAGO",
        titulo: "Tu pedido vence pronto ⏰",
        mensaje: `Tu pedido #${pedido.id} vence en menos de 30 minutos. Sube el comprobante para no perderlo.`,
        url: `/mis-pedidos`,
        datos: { pedidoId: pedido.id },
      });

      if (pedido.comprador.telefono) {
        enviarMensajeWA(pedido.comprador.telefono,
          `⏰ *Recordatorio: tu pedido vence pronto*\n\nHola ${primerNombre(pedido.comprador.nombre)}, tu pedido *#${pedido.id}* vence en menos de 30 minutos.\n\nSube el comprobante para no perderlo. 🌿`
        ).catch((e) => console.error("[CRON] WA recordatorio pago:", e.message));
      }
    }
  } catch (err) {
    console.error("[CRON] recordatoriosPago:", err.message);
  }
}

// ─── Job 3: Entrega asignada sin RECOGIDA en >1h — N-R-05 ────────────────────

async function recordatoriosRecogida() {
  try {
    const hace1h   = new Date(Date.now() - 60 * 60 * 1000);
    const hace55   = new Date(Date.now() - 55 * 60 * 1000); // ventana deduplicación

    const entregas = await prisma.entrega.findMany({
      where: {
        estado: "ASIGNADA",
        repartidorId: { not: null },
        updatedAt: { lt: hace1h },
      },
      include: {
        subPedido: {
          include: {
            pedido: { select: { id: true } },
            comercio: { select: { nombre: true, municipio: true } },
          },
        },
      },
    });

    for (const entrega of entregas) {
      if (!entrega.repartidorId) continue;

      const yaEnviado = await prisma.notificacion.findFirst({
        where: {
          usuarioId: entrega.repartidorId,
          tipo: "RECORDATORIO_RECOGIDA",
          createdAt: { gte: hace55 },
        },
      });
      if (yaEnviado) continue;

      const pedidoId     = entrega.subPedido?.pedido?.id;
      const comercioNombre = entrega.subPedido?.comercio?.nombre || "el comercio";

      await crearNotif(entrega.repartidorId, {
        tipo: "RECORDATORIO_RECOGIDA",
        titulo: "Recuerda recoger este pedido",
        mensaje: `Llevas más de 1 hora con la entrega del pedido #${pedidoId} asignada. El cliente está esperando.`,
        url: `/repartidor`,
        datos: { entregaId: entrega.id, pedidoId },
      });

      const repartidor = await prisma.usuario.findUnique({
        where: { id: entrega.repartidorId },
        select: { telefono: true, nombre: true },
      });
      if (repartidor?.telefono) {
        enviarMensajeWA(repartidor.telefono,
          `📦 *Recordatorio — Teravia*\n\nHola ${primerNombre(repartidor.nombre)}, llevas más de 1 hora con la entrega del pedido *#${pedidoId}* asignada.\n\nRecuerda pasar por *${comercioNombre}* a recogerlo. El cliente está esperando. 🌿`
        ).catch((e) => console.error("[CRON] WA recordatorio recogida:", e.message));
      }
    }
  } catch (err) {
    console.error("[CRON] recordatoriosRecogida:", err.message);
  }
}

// ─── Job 4: Recordatorio de reseña 24h post entrega — N-C-17 ─────────────────

async function recordatoriosResena() {
  try {
    const hace24h  = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hace30h  = new Date(Date.now() - 30 * 60 * 60 * 1000);

    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: "ENTREGADO",
        updatedAt: { gte: hace30h, lte: hace24h },
      },
      include: {
        comprador: { select: { id: true, nombre: true } },
      },
    });

    for (const pedido of pedidos) {
      const yaEnviado = await prisma.notificacion.findFirst({
        where: {
          usuarioId: pedido.compradorId,
          tipo: "RECORDATORIO_RESENA",
          datos: { path: ["pedidoId"], equals: pedido.id },
        },
      });
      if (yaEnviado) continue;

      await crearNotif(pedido.compradorId, {
        tipo: "RECORDATORIO_RESENA",
        titulo: "¿Cómo estuvo tu pedido?",
        mensaje: `Cuéntanos tu experiencia con el pedido #${pedido.id}. Tu reseña ayuda a los productores del Chocó.`,
        url: `/mis-pedidos`,
        datos: { pedidoId: pedido.id },
      });
    }
  } catch (err) {
    console.error("[CRON] recordatoriosResena:", err.message);
  }
}

// ─── Job 5: Subpedido listo sin repartidor >30min — N-A-05 ───────────────────

async function alertasSinRepartidor() {
  try {
    const hace30min = new Date(Date.now() - 30 * 60 * 1000);
    const hace25min = new Date(Date.now() - 25 * 60 * 1000);

    const entregas = await prisma.entrega.findMany({
      where: {
        repartidorId: null,
        estado: "ASIGNADA",
        updatedAt: { lt: hace30min },
      },
      include: {
        subPedido: { include: { pedido: { select: { id: true } } } },
      },
    });

    for (const entrega of entregas) {
      const pedidoId = entrega.subPedido?.pedido?.id;

      const yaEnviado = await prisma.notificacion.findFirst({
        where: {
          tipo: "ALERTA_SIN_REPARTIDOR",
          createdAt: { gte: hace25min },
          datos: { path: ["entregaId"], equals: entrega.id },
        },
      });
      if (yaEnviado) continue;

      await notificarAdmins({
        tipo: "ALERTA_SIN_REPARTIDOR",
        titulo: "Pedido listo sin repartidor ⚠️",
        mensaje: `El pedido #${pedidoId} lleva más de 30 minutos listo sin repartidor asignado.`,
        url: `/admin/entregas`,
        datos: { entregaId: entrega.id, pedidoId },
      });
    }
  } catch (err) {
    console.error("[CRON] alertasSinRepartidor:", err.message);
  }
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

function iniciarCron() {
  // Ejecutar una vez al arrancar (por si el servidor estuvo caído)
  expirarPedidosVencidos();
  recordatoriosPago();
  alertasSinRepartidor();

  setInterval(expirarPedidosVencidos,    CADA_5_MIN);
  setInterval(recordatoriosPago,         CADA_5_MIN);
  setInterval(alertasSinRepartidor,      CADA_5_MIN);
  setInterval(recordatoriosRecogida,     CADA_10_MIN);
  setInterval(recordatoriosResena,       CADA_1_HORA);
  setInterval(cancelarPedidosExpressExpirados,  60_000); // cada 1 min
  setInterval(cancelarReservasHotelExpiradas,  5 * 60_000); // cada 5 min

  cancelarReservasHotelExpiradas(); // ejecutar al arrancar

  console.log("[CRON] Jobs iniciados: expiración, recordatorios de pago, alertas de entrega, reseñas, hotel");
}

module.exports = { iniciarCron };
