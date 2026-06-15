'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  registro as apiRegistro,
  login as apiLogin,
} from '@/lib/api/auth'
import { TOKEN_KEY, USUARIO_KEY } from '@/lib/api/client'
import type { Usuario, DatosRegistro } from '@/types/usuario'

interface AuthContextValor {
  usuario: Usuario | null
  token: string | null
  cargando: boolean
  autenticado: boolean
  login: (email: string, password: string) => Promise<Usuario>
  registro: (datos: DatosRegistro) => Promise<Usuario>
  logout: () => void
  actualizarUsuario: (usuario: Usuario) => void
}

const AuthContext = createContext<AuthContextValor | undefined>(undefined)

function guardarSesion(usuario: Usuario, token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
    window.localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
  } catch {
    // localStorage no disponible: la sesión vive solo en memoria.
  }
}

function limpiarSesion() {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USUARIO_KEY)
  } catch {
    // noop
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  // Restaura la sesión desde localStorage al montar.
  useEffect(() => {
    try {
      const tokenGuardado = window.localStorage.getItem(TOKEN_KEY)
      const usuarioGuardado = window.localStorage.getItem(USUARIO_KEY)
      if (tokenGuardado && usuarioGuardado) {
        setToken(tokenGuardado)
        setUsuario(JSON.parse(usuarioGuardado) as Usuario)
      }
    } catch {
      // Datos corruptos: limpiamos para evitar estados inconsistentes.
      limpiarSesion()
    } finally {
      setCargando(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { usuario: u, token: t } = await apiLogin(email, password)
    guardarSesion(u, t)
    setUsuario(u)
    setToken(t)
    return u
  }, [])

  const registro = useCallback(async (datos: DatosRegistro) => {
    const { usuario: u, token: t } = await apiRegistro(datos)
    guardarSesion(u, t)
    setUsuario(u)
    setToken(t)
    return u
  }, [])

  const logout = useCallback(() => {
    limpiarSesion()
    setUsuario(null)
    setToken(null)
  }, [])

  const actualizarUsuario = useCallback((nuevoUsuario: Usuario) => {
    setUsuario(nuevoUsuario)
    try {
      window.localStorage.setItem(USUARIO_KEY, JSON.stringify(nuevoUsuario))
    } catch {
      // localStorage no disponible
    }
  }, [])

  const valor: AuthContextValor = {
    usuario,
    token,
    cargando,
    autenticado: !!token,
    login,
    registro,
    logout,
    actualizarUsuario,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValor {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
