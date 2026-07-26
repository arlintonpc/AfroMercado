async function bloquearPedido(tx, pedidoId) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Pedido"
    WHERE "id" = ${Number(pedidoId)}
    FOR UPDATE
  `;
}

async function bloquearProducto(tx, productoId) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Producto"
    WHERE "id" = ${Number(productoId)}
    FOR UPDATE
  `;
}

module.exports = {
  bloquearPedido,
  bloquearProducto,
};
