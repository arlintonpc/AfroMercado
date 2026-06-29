'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { misReservasHotel, cancelarReservaHotel, type ReservaHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

const ESTADO_INFO: Record<string, { label: string; color: string; paso: number }> = {
  PENDIENTE:  { label: '⏳ Esperando confirmación', color: 'bg-amber-100 text-amber-700',  paso: 0 },
  CONFIRMADA: { label: '✅ Confirmada',              color: 'bg-blue-100 text-blue-700',   paso: 1 },
  CHECKIN:    { label: '🏨 En estadía',              color: 'bg-green-100 text-green-700', paso: 2 },
  CHECKOUT:   { label: '👋 Check-out realizado',     color: 'bg-green-100 text-green-700', paso: 3 },
  CANCELADA:  { label: '❌ Cancelada',               color: 'bg-red-100 text-red-600',     paso: -1 },
  RECHAZADA:  { label: '🚫 Rechazada',               color: 'bg-red-100 text-red-600',     paso: -1 },
}

const PASOS = ['Solicitada', 'Confirmada', 'Check-in', 'Check-out']

function BarraProgreso({ paso }: { paso: number }) {
  if (paso < 0) return null
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1">
        {PASOS.map((p, i) => (
          <div key={p} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
            <div className={`w-4 h-4 rounded-full border-2 transition-all ${i <= paso ? 'bg-[#2D6A4F] border-[#2D6A4F]' : 'bg-white border-gray-300'}`} />
            <span className={`text-[9px] text-center leading-tight ${i <= paso ? 'text-[#2D6A4F] font-medium' : 'text-gray-400'}`}>{p}</span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-gray-200 rounded-full mt-0.5">
        <div className="absolute h-1 bg-[#2D6A4F] rounded-full transition-all duration-700" style={{ width: `${(paso / (PASOS.length - 1)) * 100}%` }} />
      </div>
    </div>
  )
}

function TarjetaReserva({ reserva, onCancelado }: { reserva: ReservaHotel; onCancelado: () => void }) {
  const info = ESTADO_INFO[reserva.estado] ?? { label: reserva.estado, color: 'bg-gray-100 text-gray-600', paso: -1 }
  const activa = !['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(reserva.estado)
  const [cancelando, setCancelando] = useState(false)

  const entrada = new Date(reserva.fechaEntrada)
  const salida  = new Date(reserva.fechaSalida)
  const noches  = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000)

  const fmtFecha = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

  async function handleCancelar() {
    if (!confirm('¿Cancelar esta reserva?')) return
    setCancelando(true)
    try { await cancelarReservaHotel(reserva.id); onCancelado() } catch {}
    setCancelando(false)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${activa ? 'border-[#2D6A4F]' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-[#1A1A1A] truncate">{reserva.configHotel?.comercio.nombre ?? 'Hotel'}</p>
          <p className="text-xs text-gray-400">{reserva.codigo}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${info.color}`}>{info.label}</span>
      </div>

      {activa && <BarraProgreso paso={info.paso} />}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-gray-400 mb-0.5">Check-in</p>
          <p className="font-medium">{fmtFecha(entrada)}</p>
          <p className="text-gray-400">{reserva.configHotel?.checkInHora}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-gray-400 mb-0.5">Check-out</p>
          <p className="font-medium">{fmtFecha(salida)}</p>
          <p className="text-gray-400">{reserva.configHotel?.checkOutHora}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p className="text-gray-600">🛏️ {reserva.habitacionTipo?.nombre} · {noches} noche{noches !== 1 ? 's' : ''}</p>
        <p className="text-gray-600">👤 {reserva.huespedes} huésped{reserva.huespedes !== 1 ? 'es' : ''}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">{reserva.metodoPago}</span>
        <span className="font-bold text-[#1A1A1A]">{formatearPrecio(Number(reserva.total))}</span>
      </div>

      {['PENDIENTE', 'CONFIRMADA'].includes(reserva.estado) && (
        <button onClick={handleCancelar} disabled={cancelando}
          className="mt-3 w-full text-center text-xs font-medium text-red-500 border border-red-200 rounded-xl py-2 hover:bg-red-50 transition-colors disabled:opacity-50">
          {cancelando ? 'Cancelando…' : 'Cancelar reserva'}
        </button>
      )}
    </div>
  )
}

export default function MisReservasHotelPage() {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const router = useRouter()
  const [reservas, setReservas] = useState<ReservaHotel[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    const data = await misReservasHotel()
    setReservas(data)
    setCargando(false)
  }

  useEffect(() => {
    if (cargandoAuth) return
    if (!autenticado) { router.push('/login'); return }
    cargar()
  }, [autenticado, cargandoAuth])

  const activas   = reservas.filter(r => !['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(r.estado))
  const anteriores = reservas.filter(r => ['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(r.estado))

  if (cargando) return <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/hoteles" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A] text-lg">Mis reservas</h1>
          {activas.length > 0 && (
            <span className="ml-auto bg-[#2D6A4F] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {activas.length} activa{activas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {reservas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏨</p>
            <p className="font-medium">Aún no tienes reservas</p>
            <Link href="/hoteles" className="mt-4 inline-block text-[#2D6A4F] underline text-sm">Ver hoteles</Link>
          </div>
        ) : (
          <>
            {activas.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Activas</h2>
                <div className="space-y-3">{activas.map(r => <TarjetaReserva key={r.id} reserva={r} onCancelado={cargar} />)}</div>
              </section>
            )}
            {anteriores.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Anteriores</h2>
                <div className="space-y-3">{anteriores.map(r => <TarjetaReserva key={r.id} reserva={r} onCancelado={cargar} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
