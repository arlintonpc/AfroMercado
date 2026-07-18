const AlianzaService = require("../services/alianza.service");

// Piezas mecánicas compartidas por los 4 validadores de cupón de vertical
// (Hotel/Express/Tour/Transporte) contra el modelo CuponVertical unificado
// (Anexo B, Fase 4). Cada servicio conserva su propio texto de error y
// semántica de "cantidad mínima" (noches/subtotal/personas/asientos) — solo
// se comparte lo que ya era idéntico entre los 4.

async function buscarCuponVertical(db, { codigo, tipoEntidad, entidadId }) {
  const ahora = new Date();
  return db.cuponVertical.findFirst({
    where: {
      codigo: String(codigo || "").trim().toUpperCase(),
      tipoEntidad,
      activo: true,
      inicio: { lte: ahora },
      fin: { gte: ahora },
      OR: [{ entidadId: null }, { entidadId }],
    },
  });
}

async function bloquearYRevalidar(db, tabla, cuponId) {
  const ahora = new Date();
  await db.$queryRawUnsafe(`SELECT id FROM "CuponVertical" WHERE id = $1 FOR UPDATE`, cuponId);
  const cupon = await db.cuponVertical.findUnique({ where: { id: cuponId } });
  if (!cupon || !cupon.activo || cupon.inicio > ahora || cupon.fin < ahora) return null;
  return cupon;
}

async function yaUsadoPorCliente(db, cuponId, clienteId) {
  if (!clienteId) return false;
  const uso = await db.cuponVerticalUso.findFirst({ where: { cuponId, clienteId } });
  return !!uso;
}

function calcularDescuento(cupon, base) {
  const b = Number(base);
  if (cupon.tipo === "PORCENTAJE") return Math.round(b * Number(cupon.valor) / 100 * 100) / 100;
  return Math.min(Number(cupon.valor), b);
}

async function intentarAlianza(comercioId, codigo, modulo, totalOriginal) {
  if (!comercioId) return null;
  const codigoNormalizado = String(codigo).trim().toUpperCase();
  const alianza = await AlianzaService.validarCodigoAlianza(codigoNormalizado, comercioId, modulo);
  if (!alianza) return null;
  const descuento = alianza.tipoDescuento === "PORCENTAJE"
    ? Math.round(Number(totalOriginal) * Number(alianza.valorDescuento) / 100 * 100) / 100
    : Math.min(Number(alianza.valorDescuento), Number(totalOriginal));
  return { codigo: codigoNormalizado, descuento, esAlianza: true };
}

async function registrarUsoVertical(db, { cuponId, clienteId, tipoEntidad, entidadId }) {
  await db.cuponVerticalUso.create({ data: { cuponId, clienteId, tipoEntidad, entidadId } });
  await db.cuponVertical.update({ where: { id: cuponId }, data: { usosActuales: { increment: 1 } } });
}

// Traduce una fila de CuponVertical al shape legado por vertical
// (campoMinimo/campoEntidad son los nombres que el frontend ya espera).
function mapearCuponVertical(row, campoMinimo, campoEntidad, extra = {}) {
  if (!row || !row.id) return row; // objetos sintéticos de alianza ({codigo}) pasan tal cual
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    valor: row.valor,
    [campoMinimo]: row.minimoAplicable,
    usosMaximos: row.usosMaximos,
    usosActuales: row.usosActuales,
    activo: row.activo,
    inicio: row.inicio,
    fin: row.fin,
    [campoEntidad]: row.entidadId,
    createdAt: row.createdAt,
    ...extra,
  };
}

module.exports = {
  buscarCuponVertical,
  bloquearYRevalidar,
  yaUsadoPorCliente,
  calcularDescuento,
  intentarAlianza,
  registrarUsoVertical,
  mapearCuponVertical,
};
