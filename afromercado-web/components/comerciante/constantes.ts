/**
 * Constantes compartidas del área del comerciante: municipios del Chocó,
 * unidades de venta y alcances, con etiquetas amigables en español sencillo.
 */

/** Municipios del Chocó (30 oficiales DIVIPOLA — DANE). */
export const MUNICIPIOS_CHOCO: string[] = [
  'Quibdó',
  'Acandí',
  'Alto Baudó',
  'Atrato',
  'Bagadó',
  'Bahía Solano',
  'Bajo Baudó',
  'Bojayá',
  'El Cantón del San Pablo',
  'Carmen del Darién',
  'Cértegui',
  'Condoto',
  'El Carmen de Atrato',
  'El Litoral del San Juan',
  'Istmina',
  'Juradó',
  'Lloró',
  'Medio Atrato',
  'Medio Baudó',
  'Medio San Juan',
  'Nóvita',
  'Nuquí',
  'Río Iró',
  'Río Quito',
  'Riosucio',
  'San José del Palmar',
  'Sipí',
  'Tadó',
  'Unión Panamericana',
  'Ungía',
]

/** Unidad de venta válida en el backend. */
export type Unidad = 'KG' | 'UNIDAD' | 'LITRO' | 'PAQUETE' | 'DOCENA' | 'MANOJO'

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
