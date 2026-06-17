export interface Producto {
  id: string
  nombre: string
  descripcion?: string
  historia?: string
  precio: number
  unidad: string
  stock: number
  stockReservado?: number
  diasAlistamientoMin: number
  diasAlistamientoMax: number
  alcance: 'LOCAL' | 'NACIONAL' | 'AMBOS'
  fotoUrl?: string
  /** Galería: imágenes adicionales del producto (además de fotoUrl). */
  imagenes?: string[]
  activo: boolean
  comercio: {
    nombre: string
    municipio: string
    verificado: boolean
    totalVentas: number
    calificacion: number
    totalReviews: number
    historia?: string
  }
  categoriaId?: string
  comercioId?: string
  categoria?: { id: string; nombre: string; slug?: string }
  oferta?: {
    id?:         number
    tipo:        'PORCENTAJE' | 'VALOR_FIJO'
    valor:       number
    etiqueta?:   string
    precioFinal: number
    fin:         string
    stockLimite?: number | null
    stockUsado:  number
  }
}
