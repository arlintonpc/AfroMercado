/**
 * Constantes compartidas del área del comerciante: unidades de venta y alcances.
 *
 * La geografía (departamentos y municipios) tiene una única fuente de verdad en
 * `lib/data/colombia.ts`. Aquí se re-exporta para no romper los imports existentes.
 */

import { DEPARTAMENTOS, MUNICIPIOS_POR_DEPARTAMENTO, municipiosDe } from '@/lib/data/colombia'

export { MUNICIPIOS_POR_DEPARTAMENTO, municipiosDe }

/** Todos los departamentos de Colombia (fuente única: lib/data/colombia). */
export const DEPARTAMENTOS_COLOMBIA: string[] = [...DEPARTAMENTOS].sort()

/** Unidad de venta válida en el backend. */
export type Unidad = 'KG' | 'UNIDAD' | 'LITRO' | 'PAQUETE' | 'DOCENA' | 'MANOJO' | 'ANIMAL'

export interface OpcionUnidad {
  valor: Unidad
  etiqueta: string
}

/** Unidades con nombres fáciles de entender. */
export const UNIDADES: OpcionUnidad[] = [
  { valor: 'KG', etiqueta: 'Kilo' },
  { valor: 'UNIDAD', etiqueta: 'Unidad' },
  { valor: 'LITRO', etiqueta: 'Litro' },
  { valor: 'PAQUETE', etiqueta: 'Paquete' },
  { valor: 'DOCENA', etiqueta: 'Docena' },
  { valor: 'MANOJO', etiqueta: 'Manojo' },
  { valor: 'ANIMAL', etiqueta: 'Animal' },
]

/** Etiqueta amigable para una unidad cualquiera (con respaldo). */
export function etiquetaUnidad(unidad: string): string {
  return UNIDADES.find((u) => u.valor === unidad)?.etiqueta ?? unidad
}

export type Alcance = 'LOCAL' | 'NACIONAL' | 'AMBOS'

export interface OpcionAlcance {
  valor: Alcance
  etiqueta: string
  descripcion: string
}

/** Alcances de venta con explicación sencilla. */
export const ALCANCES: OpcionAlcance[] = [
  {
    valor: 'LOCAL',
    etiqueta: 'Solo en mi zona',
    descripcion: 'Vendes a personas cerca de ti.',
  },
  {
    valor: 'NACIONAL',
    etiqueta: 'Todo el país',
    descripcion: 'Envías tu producto a cualquier parte de Colombia.',
  },
  {
    valor: 'AMBOS',
    etiqueta: 'Ambos',
    descripcion: 'Vendes en tu zona y también a todo el país.',
  },
]
