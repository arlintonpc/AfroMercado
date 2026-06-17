const prisma = require("../config/prisma");

const CuponRepository = {
  async buscarPorCodigo(codigo) {
    return prisma.cupon.findUnique({ where: { codigo } });
  },

  async validarParaUsuario(codigo, usuarioId, subtotal) {
    const cupon = await prisma.cupon.findUnique({ where: { codigo } });
    if (!cupon) return { error: "El cupón no existe" };

    if (!cupon.activo) return { error: "Este cupón no está activo" };

    const ahora = new Date();
    if (ahora < cupon.inicio) return { error: "Este cupón aún no está vigente" };
    if (ahora > cupon.fin) return { error: "Este cupón ya expiró" };

    if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) {
      return { error: "Este cupón ya alcanzó el límite de usos" };
    }

    const yaUsado = await prisma.cuponUso.findFirst({
      where: { cuponId: cupon.id, usuarioId },
    });
    if (yaUsado) return { error: "Ya usaste este cupón anteriormente" };

    if (cupon.soloNuevos) {
      const pedidoPrevio = await prisma.pedido.findFirst({
        where: {
          compradorId: usuarioId,
          estado: { in: ["CONFIRMADO", "ENTREGADO"] },
        },
      });
      if (pedidoPrevio) return { error: "Este cupón es solo para compradores nuevos" };
    }

    if (cupon.minimoCompra !== null && subtotal < Number(cupon.minimoCompra)) {
      return {
        error: `El cupón requiere un mínimo de compra de $${Number(cupon.minimoCompra).toLocaleString("es-CO")}`,
      };
    }

    let descuento;
    if (cupon.tipo === "PORCENTAJE") {
      descuento = Math.min(subtotal * (Number(cupon.valor) / 100), subtotal);
    } else {
      descuento = Math.min(Number(cupon.valor), subtotal);
    }

    return {
      cupon,
      descuento,
      totalConDescuento: subtotal - descuento,
    };
  },

  async incrementarUso(cuponId) {
    return prisma.cupon.update({
      where: { id: cuponId },
      data: { usosActuales: { increment: 1 } },
    });
  },

  async registrarUso({ cuponId, usuarioId, pedidoId }) {
    return prisma.cuponUso.create({
      data: { cuponId, usuarioId, pedidoId },
    });
  },

  async crearAdmin(datos) {
    return prisma.cupon.create({ data: datos });
  },

  async listarAdmin({ pagina = 1, porPagina = 20 } = {}) {
    const skip = (pagina - 1) * porPagina;
    const [items, total] = await Promise.all([
      prisma.cupon.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: porPagina,
      }),
      prisma.cupon.count(),
    ]);
    return { items, total, pagina, porPagina };
  },

  async desactivar(id) {
    return prisma.cupon.update({ where: { id }, data: { activo: false } });
  },
};

module.exports = CuponRepository;
