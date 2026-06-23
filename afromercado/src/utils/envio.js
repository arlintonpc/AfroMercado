// ============================================================
//  Cotización de envío por departamento + peso.
//  Fuente única usada por el checkout (cobro real) y por el
//  endpoint /envios/calcular (estimación que ve el comprador),
//  para que lo que se muestra coincida con lo que se cobra.
// ============================================================
const prisma = require("../config/prisma");

/**
 * Precio para una lista de tarifas (de un departamento) y un peso:
 *  - usa el tier cuyo pesoMaxKg cubre el peso (el menor que lo cubra);
 *  - si el peso supera el tier más alto, extrapola linealmente desde ese tope
 *    (precio_tope / kg_tope * peso) para no romper ni cobrar de menos.
 * @returns {number|null} precio, o null si no hay tarifas.
 */
function precioPorPeso(tarifas, pesoKg) {
  if (!tarifas.length) return null;
  const cubre = tarifas.find((t) => Number(t.pesoMaxKg) >= pesoKg);
  if (cubre) return Number(cubre.precio);
  const tope = tarifas[tarifas.length - 1]; // mayor pesoMaxKg (orden asc)
  const porKg = Number(tope.precio) / Number(tope.pesoMaxKg);
  return Math.round(porKg * pesoKg);
}

/**
 * Cotiza el envío base (sin envío gratis) para un departamento y peso.
 *  - Busca tarifas del departamento; si no hay, respalda a "Nacional" salvo
 *    que la regla sea "bloquear".
 * @returns {Promise<number|null>} precio base, o null si no se puede cotizar.
 */
async function cotizarEnvio({ departamento, pesoKg, accionSinTarifa = "nacional" }) {
  const peso = Number(pesoKg) > 0 ? Number(pesoKg) : 1;

  const locales = await prisma.tarifaEnvio.findMany({
    where: { departamento: { equals: departamento, mode: "insensitive" }, activa: true },
    orderBy: { pesoMaxKg: "asc" },
  });
  let precio = precioPorPeso(locales, peso);

  if (precio === null && accionSinTarifa !== "bloquear") {
    const nacional = await prisma.tarifaEnvio.findMany({
      where: { departamento: "Nacional", activa: true },
      orderBy: { pesoMaxKg: "asc" },
    });
    precio = precioPorPeso(nacional, peso);
  }

  return precio;
}

module.exports = { cotizarEnvio, precioPorPeso };
