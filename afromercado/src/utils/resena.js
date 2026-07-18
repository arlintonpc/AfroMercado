// Recalcula Comercio.calificacion/totalReviews desde Resena tras cada
// creación — mismo patrón write-through que ya usaba Hotel/Marketplace,
// generalizado a todos los verticales (Anexo B, Fase 3). PRODUCTO se excluye
// a propósito: es una reseña de un producto puntual, no del comercio.
async function recalcularCalificacionComercio(db, comercioId) {
  if (!comercioId) return;
  const agg = await db.resena.aggregate({
    where: { comercioId, tipoEntidad: { not: "PRODUCTO" } },
    _avg: { calificacion: true },
    _count: true,
  });
  await db.comercio.update({
    where: { id: comercioId },
    data: {
      calificacion: Math.round((agg._avg.calificacion ?? 0) * 100) / 100,
      totalReviews: agg._count,
    },
  });
}

module.exports = { recalcularCalificacionComercio };
