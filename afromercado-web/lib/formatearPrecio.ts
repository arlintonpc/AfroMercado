/**
 * Formatea un número como precio en pesos colombianos (COP).
 * Ejemplo: 45000 → "$45.000"
 */
export function formatearPrecio(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
}
