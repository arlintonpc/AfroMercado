export interface Categoria {
  id: string
  nombre: string
  slug: string
  icono?: string
  grupo?: 'ANCESTRAL' | 'LOCAL'
}
