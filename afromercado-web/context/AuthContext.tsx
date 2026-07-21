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
  logoutApi,
  yoApi,
} from '@/lib/api/auth'
import { USUARIO_KEY } from '@/lib/api/client'
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

function guardarSesion(usuario: Usuario) {
  try {
    window.localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
  } catch {
    // localStorage no disponible: la sesión vive solo en memoria.
  }
}

function limpiarSesion() {
  try {
    window.localStorage.removeItem(USUARIO_KEY)
  } catch {
    // noop
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  // Restaura la sesión verificando con el backend.
  useEffect(() => {
    async function verificarSesion() {
      try {
        // Fast hydration visual:
        const usuarioGuardado = window.localStorage.getItem(USUARIO_KEY)
        if (usuarioGuardado) {
          setUsuario(JSON.parse(usuarioGuardado) as Usuario)
          setToken('http-only')
        }
        
        // Verificación real con la cookie HttpOnly
        const res = await yoApi()
        if (res.ok && res.usuario) {
          setUsuario(res.usuario)
          setToken('http-only')
          guardarSesion(res.usuario)
        } else {
          limpiarSesion()
          setUsuario(null)
          setToken(null)
        }
      } catch {
        // Falló la verificación de sesión (token inválido/expirado)
        limpiarSesion()
        setUsuario(null)
        setToken(null)
      } finally {
        setCargando(false)
      }
    }
    verificarSesion()
  }, [])

  // Cierra sesión automáticamente cuando cualquier petición recibe 401.
  useEffect(() => {
    function manejarExpiracion() {
      limpiarSesion()
      setUsuario(null)
      setToken(null)
    }
    window.addEventListener('afm:session-expired', manejarExpiracion)
    return () => window.removeEventListener('afm:session-expired', manejarExpiracion)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { usuario: u } = await apiLogin(email, password)
    guardarSesion(u)
    setUsuario(u)
    setToken('http-only')
    return u
  }, [])

  const registro = useCallback(async (datos: DatosRegistro) => {
    const { usuario: u } = await apiRegistro(datos)
    guardarSesion(u)
    setUsuario(u)
    setToken('http-only')
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } catch {
      // ignore
    }
    limpiarSesion()
    setUsuario(null)
    setToken(null)
    window.location.href = '/ingresar'
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
