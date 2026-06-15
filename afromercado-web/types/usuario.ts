export type RolUsuario = 'CLIENTE' | 'COMERCIANTE' | 'ADMIN'

export interface Usuario {
  id: string
  nombre: string
  email: string
  telefono?: string
  rol: RolUsuario
}

export interface DatosRegistro {
  nombre: string
  email: string
  password: string
  telefono?: string
  rol?: RolUsuario
}

export interface RespuestaAuth {
  usuario: Usuario
  token: string
}
