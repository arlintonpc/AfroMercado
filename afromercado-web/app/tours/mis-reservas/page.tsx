'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { misReservasTour, cancelarReservaTour, type ReservaTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'

const ESTADO_INFO: Record<string, { label: string; color: string; paso: number }> = {
  PENDIENTE:  { label: '⏳ Pendiente',   color: 'bg-amber-100 text-amber-700', paso: 1 },
  CONFIRMADA: { label: '✅ Confirmada',  color: 'bg-green-100 text-green-700', paso: 2 },
  COMPLETADA: { label: '🎉 Completada',  color: 'bg-blue-100 text-blue-700',   paso: 3 },
  CANCELADA:  { label: '❌ Cancelada',   color: 'bg-red-100 text-red-600',     paso: 0 },
  RECHAZADA:  { label: '🚫 Rechazada',   color: 'bg-red-100 text-red-600',     paso: 0 },
}

const PASOS = ['Solicitada', 'Confirmada', 'Completada']

function BarraProgreso({ estado }: { estado: string }) {
  const paso = ESTADO_INFO[estado]?.paso ?? 0
  if (paso === 0) return null
  return (
    <div className="flex items-center gap-1 mt-3">
      {PASOS.map((p, i) => (
        <div key={p} className="flex items-center flex-1">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
            i + 1 <= paso ? 'bg-[#2D6A4F] text-white' : 'bg-gray-200 text-gray-400'
          }`}>{i + 1}</div>
          {i < PASOS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 ${i + 1 < paso ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function MisReservasTourPage() {
  const { usuario } = useAuth()
  const [reservas, setReservas] = useState<ReservaTour[]>([])
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState<number | null>(null)

  useEffect(() => {
    if (!usuario) return
    misReservasTour().then(d => { setReservas(d); setCargando(false) })
  }, [usuario])

  async function cancelar(id: number) {
    if (!confirm('¿Cancelar esta reserva?')) return
    setCancelando(id)
    try {
      await cancelarReservaTour(id)
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'CANCELADA' } : r))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setCancelando(null)
    }
  }

  const activas = reservas.filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado))
  const anteriores = reservas.filter(r => !['PENDIENTE', 'CONFIRMADA'].includes(r.estado))

  function TarjetaReserva({ r }: { r: ReservaTour }) {
    const ei = ESTADO_INFO[r.estado]
    const fecha = new Date(r.fechaTour).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-bold text-[#1A1A1A] truncate">{r.configTour?.nombre ?? 'Tour'}</p>
            <p className="text-xs text-gray-500 mt-0.5">📍 {r.configTour?.comercio.municipio}</p>
          </div>
          {ei && <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ei.color}`}>{ei.label}</span>}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center my-3">
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Fecha</p>
            <p className="text-xs font-semibold text-[#1A1A1A] mt-0.5">{fecha}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Participantes</p>
            <p className="text-sm font-bold text-[#1A1A1A]">{r.participantes}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xs font-bold text-[#2D6A4F]">{formatearPrecio(Number(r.total))}</p>
          </div>
        </div>

        <BarraProgreso estado={r.estado} />

        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-400 font-mono">{r.codigo}</span>
          {['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && (
            <button onClick={() => cancelar(r.id)} disabled={cancelando === r.id}
              className="text-xs text-red-500 hover:underline disabled:opacity-50">
              {cancelando === r.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!usuario) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-4xl mb-3">🗺️</p>
        <p className="font-bold text-[#1A1A1A] mb-1">Inicia sesión para ver tus reservas</p>
        <Link href="/ingresar" className="text-sm text-[#2D6A4F] underline">Ingresar</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/tours" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A]">Mis reservas de tours</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reservas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">Sin reservas de tours</p>
            <Link href="/tours" className="text-sm text-[#2D6A4F] underline mt-2 block">Ver tours disponibles</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {activas.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Activas ({activas.length})</h2>
                <div className="space-y-3">{activas.map(r => <TarjetaReserva key={r.id} r={r} />)}</div>
              </div>
            )}
            {anteriores.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Historial</h2>
                <div className="space-y-3">{anteriores.map(r => <TarjetaReserva key={r.id} r={r} />)}</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
