'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { misReservasTransporte, cancelarReservaTransporte, type ReservaTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import ModalReportarProblema from '@/components/disputas/ModalReportarProblema'

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: '⏳ Pendiente',   color: 'bg-amber-100 text-amber-700' },
  CONFIRMADA: { label: '✅ Confirmada',  color: 'bg-green-100 text-green-700' },
  COMPLETADA: { label: '✈️ Completada',  color: 'bg-blue-100 text-blue-700'  },
  CANCELADA:  { label: '❌ Cancelada',   color: 'bg-red-100 text-red-600'    },
  RECHAZADA:  { label: '🚫 Rechazada',   color: 'bg-red-100 text-red-600'    },
}

export default function MisReservasTransportePage() {
  const { usuario } = useAuth()
  const [reservas, setReservas] = useState<ReservaTransporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState<number | null>(null)

  useEffect(() => {
    if (!usuario) return
    misReservasTransporte().then(d => { setReservas(d); setCargando(false) })
  }, [usuario])

  async function cancelar(id: number) {
    if (!confirm('¿Cancelar esta reserva?')) return
    setCancelando(id)
    try {
      await cancelarReservaTransporte(id)
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'CANCELADA' } : r))
    } catch (e: any) { alert(e.message) }
    finally { setCancelando(null) }
  }

  const activas = reservas.filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado))
  const anteriores = reservas.filter(r => !['PENDIENTE', 'CONFIRMADA'].includes(r.estado))

  function TarjetaReserva({ r }: { r: ReservaTransporte }) {
    const ei = ESTADO_INFO[r.estado]
    const ruta = r.ruta
    const cfg = ruta?.configTransporte
    const [modalReportar, setModalReportar] = useState(false)
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-[#1A1A1A]">{cfg?.nombre ?? 'Transporte'}</p>
            <p className="text-sm text-gray-600">{ruta?.origen} → {ruta?.destino}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              📅 {new Date(r.fechaViaje).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              {ruta?.horario ? ` · 🕐 ${ruta.horario}` : ''}
            </p>
          </div>
          {ei && <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ei.color}`}>{ei.label}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Asientos</p>
            <p className="text-sm font-bold">{r.asientos}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xs font-bold text-[#023E8A]">{formatearPrecio(Number(r.total))}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-400 font-mono">{r.codigo}</span>
          {['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && (
            <button onClick={() => cancelar(r.id)} disabled={cancelando === r.id}
              className="text-xs text-red-500 hover:underline disabled:opacity-50">
              {cancelando === r.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          )}
          {r.estado === 'COMPLETADA' && (
            <button onClick={() => setModalReportar(true)}
              className="text-xs text-[#C0392B] hover:underline">
              Reportar un problema
            </button>
          )}
        </div>

        {modalReportar && (
          <ModalReportarProblema
            moduloOrigen="TRANSPORTE"
            referenciaId={r.id}
            onCerrar={() => setModalReportar(false)}
            onExito={() => setModalReportar(false)}
          />
        )}
      </div>
    )
  }

  if (!usuario) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-4xl mb-3">🛥️</p>
        <Link href="/ingresar" className="text-sm text-[#023E8A] underline">Ingresar para ver reservas</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/transportes" className="text-[#023E8A] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A]">Mis viajes reservados</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="ml-auto h-5 bg-gray-100 rounded w-20" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 bg-gray-100 rounded-xl" />
                  <div className="h-12 bg-gray-100 rounded-xl" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : reservas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🛥️</p>
            <p>Sin reservas de transporte</p>
            <Link href="/transportes" className="text-sm text-[#023E8A] underline mt-2 block">Ver servicios</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {activas.length > 0 && <div><h2 className="text-sm font-semibold mb-3">Activas ({activas.length})</h2><div className="space-y-3">{activas.map(r => <TarjetaReserva key={r.id} r={r} />)}</div></div>}
            {anteriores.length > 0 && <div><h2 className="text-sm font-semibold text-gray-400 mb-3">Historial</h2><div className="space-y-3">{anteriores.map(r => <TarjetaReserva key={r.id} r={r} />)}</div></div>}
          </div>
        )}
      </main>
    </div>
  )
}
