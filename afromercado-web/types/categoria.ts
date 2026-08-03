export interface Categoria {
  id: string
  nombre: string
  slug: string
  icono?: string
  grupo?: 'ANCESTRAL' | 'LOCAL' | 'AGRO'
  /** Departamento al que pertenece esta categoría hoja (agrupa el selector en /buscar). */
  padre?: { id: string; nombre: string; icono?: string } | null
}
