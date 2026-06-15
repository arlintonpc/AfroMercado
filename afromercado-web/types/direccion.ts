export interface Direccion {
  id: number
  alias: string
  linea1: string
  barrio: string | null
  municipio: string
  departamento: string
  referencia: string | null
  telefono: string | null
  esPrincipal: boolean
}

export interface CrearDireccionInput {
  alias: string
  linea1: string
  barrio?: string
  municipio: string
  departamento: string
  referencia?: string
  telefono?: string
  esPrincipal?: boolean
}
