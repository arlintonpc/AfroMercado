'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Notificacion {
  id: number
  tipo: string
  titulo: string
  mensaje: string
  url?: string | null
  leida: boolean
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ICONO: Record<string, string> = {
  RECORDATORIO_PAGO:               '⏰',
  PAGO_CONFIRMADO:                 '✅',
  PAGO_RECHAZADO:                  '❌',
  PEDIDO_CONFIRMADO:               '📦',
  PEDIDO_LISTO:                    '🎉',
  PEDIDO_ENTREGADO:                '🌟',
  RECORDATORIO_RESENA:             '⭐',
  RECORDATORIO_RECOGIDA:           '🚴',
  ALERTA_SIN_REPARTIDOR:           '⚠️',
  SOLICITUD_REPARTIDOR_APROBADA:   '✅',
  SOLICITUD_REPARTIDOR_RECHAZADA:  '❌',
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function agrupar(items: Notificacion[]): { etiqueta: string; items: Notificacion[] }[] {
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
  const grupos: { etiqueta: string; items: Notificacion[] }[] = [
    { etiqueta: 'Hoy',   items: [] },
    { etiqueta: 'Ayer',  items: [] },
    { etiqueta: 'Antes', items: [] },
  ]
  for (const n of items) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0)
    if (d >= hoy)  grupos[0].items.push(n)
    else if (d >= ayer) grupos[1].items.push(n)
    else grupos[2].items.push(n)
  }
  return grupos.filter((g) => g.items.length > 0)
}

function formatearDiaRelativo(offsetDias: number) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + offsetDias)
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Ítem ─────────────────────────────────────────────────────────────────────

function ItemNotif({
  n,
  esPrimero,
  onLeer,
}: {
  n: Notificacion
  esPrimero: boolean
  onLeer: (id: number) => void
}) {
  const icono = ICONO[n.tipo] ?? '🔔'

  const clases = [
    'flex gap-4 px-5 py-4 transition-colors',
    esPrimero ? '' : 'border-t border-[#1A1A1A]/5',
    !n.leida ? 'bg-[#52B788]/5' : 'hover:bg-[#F8F5F0]/60',
    n.url ? 'cursor-pointer' : '',
  ].join(' ')

  const contenido = (
    <>
      <span className="flex-shrink-0 mt-0.5 text-xl">{icono}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-snug ${n.leida ? 'text-[#1A1A1A]/60' : 'text-[#1A1A1A]'}`}>
            {n.titulo}
          </p>
        </div>
        <p className="mt-0.5 text-sm text-[#1A1A1A]/55 line-clamp-2">{n.mensaje}</p>
      </div>
      {!n.leida && (
        <span className="flex-shrink-0 mt-2 h-2 w-2 rounded-full bg-[#2D6A4F]" />
      )}
    </>
  )

  if (n.url) {
    return (
      <Link href={n.url} className={clases} onClick={() => { if (!n.leida) onLeer(n.id) }}>
        {contenido}
      </Link>
    )
  }
  return (
    <div
      className={clases}
      onClick={() => { if (!n.leida) onLeer(n.id) }}
      role={!n.leida ? 'button' : undefined}
    >
      {contenido}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function NotificacionesPage() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()

  const [items, setItems]               = useState<Notificacion[]>([])
  const [cargando, setCargando]         = useState(true)
  const [marcandoTodas, setMarcandoTodas] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/notificaciones')
    }
  }, [cargandoAuth, autenticado, router])

  const cargar = useCallback(async () => {
    if (!autenticado) return
    setCargando(true)
    try {
      // El backend responde { ok, data: { notificaciones, noLeidas } }.
      // Aceptamos también un arreglo directo por compatibilidad.
      const res = await apiFetch<{
        ok: boolean
        data: Notificacion[] | { notificaciones?: Notificacion[]; noLeidas?: number }
      }>('/notificaciones')
      const data = res.data
      const lista = Array.isArray(data) ? data : (data?.notificaciones ?? [])
      setItems(lista)
    } catch { /**/ } finally {
      setCargando(false)
    }
  }, [autenticado])

  useEffect(() => {
    if (!cargandoAuth) void cargar()
  }, [cargandoAuth, cargar])

  async function marcarLeida(id: number) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, leida: true } : n))
    try { await apiFetch(`/notificaciones/${id}/leer`, { method: 'PATCH' }) } catch { /**/ }
  }

  async function marcarTodas() {
    setMarcandoTodas(true)
    try {
      await apiFetch('/notificaciones/leer-todas', { method: 'PATCH' })
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })))
    } catch { /**/ } finally {
      setMarcandoTodas(false)
    }
  }

  const sinLeer = items.filter((n) => !n.leida).length
  const grupos  = agrupar(items)

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Notificaciones
            </h1>
            <p className="mt-1 text-sm text-[#1A1A1A]/55">
              {sinLeer > 0 ? `${sinLeer} sin leer` : 'Todo al día'}
            </p>
          </div>
          {sinLeer > 0 && (
            <Button variant="secondary" size="sm" onClick={marcarTodas} loading={marcandoTodas}>
              Marcar todas leídas
            </Button>
          )}
        </div>

        {/* Contenido */}
        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-4xl mb-4">🔔</p>
            <p className="text-base font-semibold text-[#1A1A1A]/55">Sin notificaciones</p>
            <p className="mt-1 text-sm text-[#1A1A1A]/35">
              Aquí aparecerán las actualizaciones de tus pedidos y cuenta.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {grupos.map(({ etiqueta, items: grupo }) => (
              <section key={etiqueta}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#1A1A1A]/35 mb-3 px-1">
                  {etiqueta}
                  {etiqueta !== 'Antes' && (
                    <span className="ml-2 text-[#1A1A1A]/20 normal-case tracking-normal">
                      {etiqueta === 'Hoy'
                        ? formatearDiaRelativo(0)
                        : formatearDiaRelativo(-1)}
                    </span>
                  )}
                </p>
                <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
                  {grupo.map((n, i) => (
                    <ItemNotif
                      key={n.id}
                      n={n}
                      esPrimero={i === 0}
                      onLeer={marcarLeida}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
