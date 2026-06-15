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
  // Campos opcionales que puede devolver la API y que el frontend
  // existente no usa todavía. Son opcionales para no romper el mock
  // ni los componentes ya construidos.
  categoriaId?: string
  comercioId?: string
}
