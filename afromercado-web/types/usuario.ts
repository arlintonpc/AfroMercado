export type RolUsuario = 'COMPRADOR' | 'COMERCIANTE' | 'ADMIN' | 'REPARTIDOR'

export type TipoDocumento = 'CC' | 'TI' | 'CE' | 'PEP' | 'PASAPORTE' | 'NIT'

export interface Usuario {
  id: string
  nombre: string
  email: string
  telefono?: string | null
  avatarUrl?: string | null
  bio?: string | null
  municipio?: string | null
  departamento?: string | null
  rol: RolUsuario
  activo: boolean
  tipoDocumento?: TipoDocumento | null
  numeroDocumento?: string | null
  autorizacionDatos: boolean
  autorizacionFecha?: string | null
  createdAt?: string
}

export interface DatosRegistro {
  nombre: string
  email: string
  password: string
  telefono?: string
  rol?: RolUsuario
  autorizacionDatos: boolean
  tipoDocumento?: TipoDocumento
  numeroDocumento?: string
  codigoReferido?: string
}

export interface RespuestaAuth {
  token: string
  usuario: Usuario
}
