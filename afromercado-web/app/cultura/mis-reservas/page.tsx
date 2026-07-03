'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import { misReservasCultura, cancelarReservaCultura, type ReservaCultural } from '@/lib/api/cultura'

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-[#FAEEDA] text-[#854F0B]' },
  CONFIRMADA: { texto: 'Confirmada', clase: 'bg-[#EAF3DE] text-[#3B6D11]' },
  USADA: { texto: 'Usada', clase: 'bg-[#1A1A1A]/8 text-[#1A1A1A]/60' },
  CANCELADA: { texto: 'Cancelada', clase: 'bg-[#C0392B]/10 text-[#C0392B]' },
  RECHAZADA: { texto: 'Rechazada', clase: 'bg-[#C0392B]/10 text-[#C0392B]' },
}

function fmtFecha(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function CulturaShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export default function MisReservasCulturaPage() {
  const { usuario } = useAuth()
  const [reservas, setReservas] = useState<ReservaCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setReservas(await misReservasCultura())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar tus reservas.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (usuario) cargar()
    else setCargando(false)
  }, [usuario, cargar])

  async function cancelar(id: number) {
    await cancelarReservaCultura(id)
    await cargar()
  }

  if (!usuario) {
    return (
      <CulturaShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">🎭</p>
        <p className="mt-3 font-serif text-2xl text-[#1B4332]">Ingresa para ver tus reservas</p>
        <Link href="/ingresar?redirect=/cultura/mis-reservas" className="mt-4 inline-block rounded-full bg-[#1B4332] px-5 py-2 text-sm text-white">
          Ingresar
        </Link>
        </div>
      </CulturaShell>
    )
  }

  return (
    <CulturaShell>
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 font-serif text-3xl text-[#1B4332]">🎭 Mis reservas de cultura</h1>

      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#1A1A1A]/5" />)}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-5 text-center text-[#C0392B]">
          {error}
        </div>
      ) : reservas.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-10 text-center">
          <p className="text-[#1A1A1A]/60">Aún no tienes reservas de eventos.</p>
          <Link href="/cultura" className="mt-3 inline-block text-sm text-[#2D6A4F] hover:underline">
            Ver la agenda cultural
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reservas.map((r) => {
            const est = ETIQUETA_ESTADO[r.estado] ?? { texto: r.estado, clase: 'bg-[#1A1A1A]/8 text-[#1A1A1A]/60' }
            const cancelable = r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA'
            return (
              <div key={r.id} className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/cultura/${r.eventoCulturalId}`} className="font-serif text-lg text-[#1B4332] hover:underline">
                      {r.evento?.titulo ?? 'Evento'}
                    </Link>
                    {r.evento && (
                      <p className="text-sm text-[#1A1A1A]/60">{fmtFecha(r.evento.fechaInicio)} · {r.evento.municipio}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${est.clase}`}>{est.texto}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-[#1A1A1A]/70">
                    {r.entrada?.nombre ?? 'Entrada'} × {r.cantidad} ·{' '}
                    <span className="font-semibold text-[#1B4332]">
                      {Number(r.total) === 0 ? 'Gratis' : `$${Number(r.total).toLocaleString('es-CO')}`}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-[#1A1A1A]/50">{r.codigo}</span>
                </div>
                {cancelable && (
                  <button onClick={() => cancelar(r.id)} className="mt-2 text-xs text-[#C0392B] hover:underline">
                    Cancelar reserva
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </CulturaShell>
  )
}
