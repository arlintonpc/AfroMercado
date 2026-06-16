// Cron job: expira pedidos que no fueron pagados a tiempo.
// Corre cada 5 minutos dentro del mismo proceso Node.
const prisma = require("../config/prisma");

const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

async function expirarPedidosVencidos() {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: "PENDIENTE_PAGO",
        expiresAt: { lt: new Date() },
      },
      include: {
        subPedidos: { include: { items: true } },
      },
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
          }
        }
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { estado: "EXPIRADO" },
        });
      });
      console.log(`[CRON] Pedido #${pedido.id} expirado — stock liberado`);
    }

    console.log(`[CRON] ${pedidos.length} pedido(s) expirado(s) y stock liberado`);
  } catch (err) {
    console.error("[CRON] Error al expirar pedidos:", err.message);
  }
}

function iniciarCron() {
  // Ejecuta una vez al arrancar (por si el servidor estuvo caído)
  expirarPedidosVencidos();
  // Luego cada 5 minutos
  setInterval(expirarPedidosVencidos, INTERVALO_MS);
  console.log("[CRON] Job de expiración de pedidos iniciado (cada 5 min)");
}

module.exports = { iniciarCron };
