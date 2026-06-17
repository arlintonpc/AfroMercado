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

interface NotificacionCtx {
  notificaciones: Notificacion[]
  noLeidas: number
  marcarLeida: (id: number) => void
  marcarTodasLeidas: () => void
}

const Ctx = createContext<NotificacionCtx>({
  notificaciones: [],
  noLeidas: 0,
  marcarLeida: () => {},
  marcarTodasLeidas: () => {},
})

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export function NotificacionProvider({ children }: { children: React.ReactNode }) {
  const { autenticado, token } = useAuth()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const esRef = useRef<EventSource | null>(null)

  // Cargar historial inicial
  const cargarHistorial = useCallback(async () => {
    try {
      const res = await apiFetch<{ ok: boolean; data: { notificaciones: Notificacion[]; noLeidas: number } }>('/notificaciones')
      setNotificaciones(res?.data?.notificaciones ?? [])
    } catch { /* silencioso */ }
  }, [])

  // Conectar SSE
  useEffect(() => {
    if (!autenticado || !token) {
      setNotificaciones([])
      esRef.current?.close()
      esRef.current = null
      return
    }

    cargarHistorial()

    const url = `${API_URL}/notificaciones/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('notificacion', (e) => {
      try {
        const nueva: Notificacion = JSON.parse(e.data)
        setNotificaciones((prev) => [nueva, ...prev].slice(0, 50))
      } catch { /* malformed */ }
    })

    es.onerror = () => {
      // El navegador reintenta automáticamente — no necesitamos hacer nada
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [autenticado, token, cargarHistorial])

  const marcarLeida = useCallback((id: number) => {
    setNotificaciones((prev) => prev.map((n) => n.id === id ? { ...n, leida: true } : n))
    apiFetch(`/notificaciones/${id}/leer`, { method: 'PATCH' }).catch(() => {})
  }, [])

  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    apiFetch('/notificaciones/leer-todas', { method: 'PATCH' }).catch(() => {})
  }, [])

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  return (
    <Ctx.Provider value={{ notificaciones, noLeidas, marcarLeida, marcarTodasLeidas }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotificaciones() {
  return useContext(Ctx)
}
