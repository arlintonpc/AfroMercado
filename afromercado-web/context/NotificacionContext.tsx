'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { apiFetch } from '@/lib/api/client'

export interface Notificacion {
  id: number
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  url: string | null
  datos: Record<string, unknown> | null
  createdAt: string
}

export interface EventoMensajeChat {
  conversacionId: number
  mensaje: { id: number }
}

export interface EventoUbicacionRepartidor {
  entregaId: number
  lat: number
  lng: number
  actualizadoAt: string
}

interface NotificacionCtx {
  notificaciones: Notificacion[]
  noLeidas: number
  cargando: boolean
  ultimoMensajeChat: EventoMensajeChat | null
  ultimaUbicacionRepartidor: EventoUbicacionRepartidor | null
  marcarLeida: (id: number) => Promise<void>
  marcarTodasLeidas: () => Promise<void>
}

const Ctx = createContext<NotificacionCtx>({
  notificaciones: [],
  noLeidas: 0,
  cargando: false,
  ultimoMensajeChat: null,
  ultimaUbicacionRepartidor: null,
  marcarLeida: async () => {},
  marcarTodasLeidas: async () => {},
})

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

export function NotificacionProvider({ children }: { children: React.ReactNode }) {
  const { autenticado, token } = useAuth()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [ultimoMensajeChat, setUltimoMensajeChat] = useState<EventoMensajeChat | null>(null)
  const [ultimaUbicacionRepartidor, setUltimaUbicacionRepartidor] = useState<EventoUbicacionRepartidor | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const idsRef = useRef<Set<number>>(new Set())
  const idsNoLeidasRef = useRef<Set<number>>(new Set())
  const tokenActivoRef = useRef<string | null>(null)

  const cargarHistorial = useCallback(async (tokenEsperado: string) => {
    try {
      const [historial, contador] = await Promise.all([
        apiFetch<{ ok: boolean; data: { notificaciones: Notificacion[]; noLeidas?: number } }>('/notificaciones'),
        apiFetch<{ ok: boolean; data: { count: number } }>('/notificaciones/no-leidas/count'),
      ])
      if (tokenActivoRef.current !== tokenEsperado) return

      const lista = historial?.data?.notificaciones ?? []
      for (const notificacion of lista) {
        idsRef.current.add(notificacion.id)
        if (!notificacion.leida) idsNoLeidasRef.current.add(notificacion.id)
      }
      setNotificaciones((actuales) => {
        const unicas = new Map<number, Notificacion>()
        for (const notificacion of [...lista, ...actuales]) {
          unicas.set(notificacion.id, notificacion)
        }
        return Array.from(unicas.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 50)
      })

      const exactas = contador?.data?.count
      if (typeof exactas === 'number') {
        setNoLeidas((actuales) => Math.max(actuales, exactas))
      } else {
        setNoLeidas(historial?.data?.noLeidas ?? lista.filter((n) => !n.leida).length)
      }
    } catch {
      // silencioso
    } finally {
      if (tokenActivoRef.current === tokenEsperado) setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!autenticado || !token) {
      setNotificaciones([])
      setNoLeidas(0)
      setCargando(false)
      setUltimoMensajeChat(null)
      idsRef.current = new Set()
      idsNoLeidasRef.current = new Set()
      tokenActivoRef.current = null
      esRef.current?.close()
      esRef.current = null
      return
    }

    if (tokenActivoRef.current !== token) {
      tokenActivoRef.current = token
      setNotificaciones([])
      setNoLeidas(0)
      setCargando(true)
      setUltimoMensajeChat(null)
      idsRef.current = new Set()
      idsNoLeidasRef.current = new Set()
    }

    // withCredentials: EventSource no manda cookies cross-origin por defecto.
    // La sesión ya no vive en un JWT accesible desde JS (cookie httpOnly desde
    // la migración a cookies) — sin esto, /notificaciones/stream siempre
    // respondía 401 y el navegador reintentaba en un loop silencioso.
    const url = `${API_URL}/notificaciones/stream`
    const esActual = new EventSource(url, { withCredentials: true })
    esRef.current = esActual

    esActual.addEventListener('notificacion', (e) => {
      try {
        if (tokenActivoRef.current !== token) return
        const nueva: Notificacion = JSON.parse(e.data)
        if (idsRef.current.has(nueva.id)) return

        idsRef.current.add(nueva.id)
        setNotificaciones((prev) => [nueva, ...prev].slice(0, 50))
        if (!nueva.leida) {
          idsNoLeidasRef.current.add(nueva.id)
          setNoLeidas((count) => count + 1)
        }
      } catch {
        // evento malformado
      }
    })

    esActual.addEventListener('MENSAJE_NUEVO', (e) => {
      try {
        if (tokenActivoRef.current !== token) return
        setUltimoMensajeChat(JSON.parse(e.data) as EventoMensajeChat)
      } catch {
        // evento malformado
      }
    })

    esActual.addEventListener('ubicacion-repartidor', (e) => {
      try {
        if (tokenActivoRef.current !== token) return
        setUltimaUbicacionRepartidor(JSON.parse(e.data) as EventoUbicacionRepartidor)
      } catch {
        // evento malformado
      }
    })

    esActual.onerror = () => {
      // El navegador reintenta automaticamente.
    }

    void cargarHistorial(token)

    return () => {
      esActual.close()
      if (esRef.current === esActual) {
        esRef.current = null
      }
    }
  }, [autenticado, token, cargarHistorial])

  const marcarLeida = useCallback(async (id: number) => {
    if (idsNoLeidasRef.current.delete(id)) {
      setNoLeidas((count) => Math.max(0, count - 1))
    }
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    try {
      await apiFetch(`/notificaciones/${id}/leer`, { method: 'PATCH' })
    } catch {
      // La UI permanece optimista; el conteo exacto se recupera en la siguiente carga.
    }
  }, [])

  const marcarTodasLeidas = useCallback(async () => {
    idsNoLeidasRef.current.clear()
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    setNoLeidas(0)
    try {
      await apiFetch('/notificaciones/leer-todas', { method: 'PATCH' })
    } catch {
      // La UI permanece optimista; el conteo exacto se recupera en la siguiente carga.
    }
  }, [])

  return (
    <Ctx.Provider value={{
      notificaciones,
      noLeidas,
      cargando,
      ultimoMensajeChat,
      ultimaUbicacionRepartidor,
      marcarLeida,
      marcarTodasLeidas,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotificaciones() {
  return useContext(Ctx)
}
