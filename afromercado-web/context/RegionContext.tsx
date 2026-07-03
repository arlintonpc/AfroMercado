'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { departamentoMasCercano } from '@/lib/data/departamentos-geo'
import { actualizarPerfil } from '@/lib/api/usuario'
import { useAuth } from './AuthContext'

const REGION_KEY = 'afm_region_activa'
const GPS_PEDIDO_KEY = 'afm_region_gps_pedido'

interface RegionContextValor {
  /** Departamento activo para filtrar catálogos. `null` = ver todo el país. */
  regionActiva: string | null
  /** Departamento detectado por GPS, pendiente de confirmación del usuario (o `null` si no hay ninguna). */
  sugerencia: string | null
  detectando: boolean
  /** Pide el GPS del navegador y calcula el departamento más cercano como sugerencia (no lo aplica todavía). */
  detectarRegion: () => void
  /** Acepta la sugerencia detectada como región activa. */
  confirmarSugerencia: () => void
  /** Descarta la sugerencia sin cambiar la región activa. */
  descartarSugerencia: () => void
  /** Selección manual (Header u otro selector). `null` = ver todo el país. */
  elegirRegion: (departamento: string | null) => void
}

const RegionContext = createContext<RegionContextValor | undefined>(undefined)

function leerRegionGuardada(): string | null {
  try {
    return window.localStorage.getItem(REGION_KEY)
  } catch {
    return null
  }
}

function guardarRegion(departamento: string | null) {
  try {
    if (departamento) window.localStorage.setItem(REGION_KEY, departamento)
    else window.localStorage.removeItem(REGION_KEY)
  } catch {
    // localStorage no disponible: la región activa vive solo en memoria de esta carga.
  }
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const { usuario, autenticado } = useAuth()
  const [regionActiva, setRegionActivaState] = useState<string | null>(null)
  const [sugerencia, setSugerencia] = useState<string | null>(null)
  const [detectando, setDetectando] = useState(false)

  // Al montar: localStorage tiene prioridad (última elección explícita en este navegador);
  // si no hay nada guardado, usar el departamento ya guardado en el perfil del usuario autenticado.
  useEffect(() => {
    const guardada = leerRegionGuardada()
    if (guardada) {
      setRegionActivaState(guardada)
    } else if (usuario?.departamento) {
      setRegionActivaState(usuario.departamento)
    }
  }, [usuario?.departamento])

  const detectarRegion = useCallback(() => {
    try {
      window.localStorage.setItem(GPS_PEDIDO_KEY, '1')
    } catch { /* noop */ }

    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    setDetectando(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const centro = departamentoMasCercano(pos.coords.latitude, pos.coords.longitude)
        setSugerencia(centro.departamento)
        setDetectando(false)
      },
      () => {
        // Permiso denegado o error: no rompe nada, simplemente no hay sugerencia.
        setDetectando(false)
      },
      { timeout: 8000, maximumAge: 3600_000 },
    )
  }, [])

  // Ofrecer detección automática una sola vez por navegador, nunca aplicar en silencio.
  useEffect(() => {
    if (regionActiva) return // ya hay región activa, no hace falta sugerir
    let yaPedido = false
    try {
      yaPedido = window.localStorage.getItem(GPS_PEDIDO_KEY) === '1'
    } catch { /* noop */ }
    if (yaPedido) return
    detectarRegion()
  }, [regionActiva, detectarRegion])

  const aplicarRegion = useCallback((departamento: string | null) => {
    setRegionActivaState(departamento)
    guardarRegion(departamento)
    setSugerencia(null)
    if (autenticado && departamento) {
      // Best-effort: sincroniza el perfil para que la región persista entre dispositivos.
      actualizarPerfil({ departamento }).catch(() => {})
    }
  }, [autenticado])

  const confirmarSugerencia = useCallback(() => {
    if (sugerencia) aplicarRegion(sugerencia)
  }, [sugerencia, aplicarRegion])

  const descartarSugerencia = useCallback(() => {
    setSugerencia(null)
  }, [])

  const elegirRegion = useCallback((departamento: string | null) => {
    aplicarRegion(departamento)
  }, [aplicarRegion])

  const valor: RegionContextValor = {
    regionActiva,
    sugerencia,
    detectando,
    detectarRegion,
    confirmarSugerencia,
    descartarSugerencia,
    elegirRegion,
  }

  return <RegionContext.Provider value={valor}>{children}</RegionContext.Provider>
}

export function useRegion(): RegionContextValor {
  const ctx = useContext(RegionContext)
  if (ctx === undefined) {
    throw new Error('useRegion debe usarse dentro de <RegionProvider>')
  }
  return ctx
}
