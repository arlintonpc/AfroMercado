'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { obtenerHotel, verificarDisponibilidad, crearReserva, misReservasHotel, type ConfigHotel, type HabitacionTipo } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import CalendarioReserva from '@/components/hoteles/CalendarioReserva'
import SeccionReviewsHotel from '@/components/hoteles/SeccionReviewsHotel'
import { Toast, useToast } from '@/components/ui/Toast'

const MapaHoteles = dynamic(() => import('@/components/hoteles/MapaHoteles'), { ssr: false })

const SERVICIOS_ICONS: Record<string, { icon: string; label: string }> = {
  wifi:        { icon: '📶', label: 'WiFi gratis' },
  desayuno:    { icon: '🍳', label: 'Desayuno' },
  parking:     { icon: '🅿️', label: 'Parqueadero' },
  piscina:     { icon: '🏊', label: 'Piscina' },
  restaurante: { icon: '🍽️', label: 'Restaurante' },
  aire:        { icon: '❄️', label: 'Aire acond.' },
  gym:         { icon: '💪', label: 'Gimnasio' },
  spa:         { icon: '💆', label: 'Spa' },
  bar:         { icon: '🍸', label: 'Bar' },
  mascotas:    { icon: '🐾', label: 'Mascotas' },
}

/* ── Lightbox ──────────────────────────────────────────── */
function Lightbox({ fotos, inicial, onClose }: { fotos: string[]; inicial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(inicial)
  const prev = () => setIdx(i => (i - 1 + fotos.length) % fotos.length)
  const next = () => setIdx(i => (i + 1) % fotos.length)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <span className="text-white/60 text-sm">{idx + 1} / {fotos.length}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={prev} className="absolute left-3 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <img src={fotos[idx]} alt="" className="max-h-[80vh] max-w-full px-14 object-contain" />
        <button onClick={next} className="absolute right-3 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <div className="flex gap-2 px-5 pb-6 pt-2 overflow-x-auto flex-shrink-0" onClick={e => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
        {fotos.map((f, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${i === idx ? 'ring-2 ring-white opacity-100' : 'opacity-40'}`}>
            <img src={f} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Hero cinematográfico ──────────────────────────────── */
function HeroCine({ fotos, hotel, onAbrirFoto, onShare, precioDesde }: {
  fotos: string[]
  hotel: ConfigHotel
  onAbrirFoto: (i: number) => void
  onShare: () => void
  precioDesde: number | null
}) {
  const [idx, setIdx] = useState(0)
  const startX = useRef<number | null>(null)

  return (
    <div className="relative overflow-hidden"
      style={{ height: '72vw', maxHeight: 420, minHeight: 280 }}
      onTouchStart={e => { startX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (startX.current === null || fotos.length < 2) return
        const dx = e.changedTouches[0].clientX - startX.current
        if (dx > 40) setIdx(i => (i - 1 + fotos.length) % fotos.length)
        else if (dx < -40) setIdx(i => (i + 1) % fotos.length)
        startX.current = null
      }}>

      {/* Foto */}
      {fotos.length > 0 ? (
        <img src={fotos[idx]} alt={hotel.comercio.nombre}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          onClick={() => onAbrirFoto(idx)} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex items-center justify-center text-7xl">🏨</div>
      )}

      {/* Gradientes */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent via-40% to-black/80 pointer-events-none" />

      {/* Nav top */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12">
        <Link href="/hoteles" className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="flex items-center gap-2">
          {fotos.length > 1 && (
            <span className="bg-black/30 backdrop-blur-md text-white/80 text-xs px-3 py-1 rounded-full">
              {idx + 1} / {fotos.length}
            </span>
          )}
          <button onClick={onShare} className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>

      {/* Flechas fotos */}
      {fotos.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + fotos.length) % fotos.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/25 text-white flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => setIdx(i => (i + 1) % fotos.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/25 text-white flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </>
      )}

      {/* Info en hero */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8">
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            {Number(hotel.comercio.totalReviews) > 0 && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(n => (
                    <svg key={n} width="11" height="11" viewBox="0 0 24 24"
                      fill={n <= Math.round(Number(hotel.comercio.calificacion)) ? '#FCD34D' : 'none'}
                      stroke="#FCD34D" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <span className="text-white text-xs font-semibold">{Number(hotel.comercio.calificacion).toFixed(1)}</span>
                <span className="text-white/50 text-xs">({hotel.comercio.totalReviews})</span>
              </div>
            )}
            <h1 className="text-white font-bold leading-tight" style={{ fontSize: 'clamp(18px, 5vw, 24px)' }}>
              {hotel.comercio.nombre}
            </h1>
            <p className="text-white/70 text-xs mt-1 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}
            </p>
          </div>
          {precioDesde && (
            <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-2.5 text-right shadow-xl">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">desde</p>
              <p className="font-bold text-[#2D6A4F] text-lg leading-tight">{formatearPrecio(precioDesde)}</p>
              <p className="text-[10px] text-gray-400">por noche</p>
            </div>
          )}
        </div>

        {/* Dots */}
        {fotos.length > 1 && fotos.length <= 10 && (
          <div className="flex gap-1 mt-3">
            {fotos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-200 ${i === idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Carrusel habitación full-width ─────────────────────── */
function FotoHabitacion({ fotos, nombre, onOpen }: { fotos: string[]; nombre: string; onOpen: (i: number) => void }) {
  const [idx, setIdx] = useState(0)
  const startX = useRef<number | null>(null)

  if (fotos.length === 0) {
    return (
      <div className="h-52 bg-gradient-to-br from-[#E8F4F0] to-[#B7E4C7] flex items-center justify-center">
        <span className="text-6xl opacity-40">🛏️</span>
      </div>
    )
  }

  return (
    <div className="relative h-52 overflow-hidden cursor-pointer"
      onClick={() => onOpen(idx)}
      onTouchStart={e => { startX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (startX.current === null || fotos.length < 2) return
        const dx = e.changedTouches[0].clientX - startX.current
        if (dx > 40) setIdx(i => (i - 1 + fotos.length) % fotos.length)
        else if (dx < -40) setIdx(i => (i + 1) % fotos.length)
        startX.current = null
      }}>

      <img src={fotos[idx]} alt={nombre} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

      {fotos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + fotos.length) % fotos.length) }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % fotos.length) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full font-medium">
            {idx + 1} / {fotos.length}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {fotos.slice(0, 7).map((_, i) => (
              <span key={i} className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}

      {/* Badge ver fotos */}
      <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

/* ── Form reserva ───────────────────────────────────────── */
function FormReserva({ hotel, habitacion, onClose, onSuccess }: {
  hotel: ConfigHotel; habitacion: HabitacionTipo; onClose: () => void; onSuccess: () => void
}) {
  const { usuario } = useAuth()
  const hoy    = new Date().toISOString().split('T')[0]
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fechaEntrada, setFechaEntrada] = useState(hoy)
  const [fechaSalida,  setFechaSalida]  = useState(manana)
  const [huespedes,    setHuespedes]    = useState(1)
  const [metodoPago,   setMetodoPago]   = useState('EFECTIVO')
  const [notas,        setNotas]        = useState('')
  const [nombre,       setNombre]       = useState(usuario?.nombre ?? '')
  const [telefono,     setTelefono]     = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setDisponibilidad] = useState<{ disponibles: number } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const noches = Math.max(1, Math.ceil((new Date(fechaSalida).getTime() - new Date(fechaEntrada).getTime()) / 86400000))
  const total  = Number(habitacion.precioPorNoche) * noches

  useEffect(() => {
    if (!fechaEntrada || !fechaSalida || fechaSalida <= fechaEntrada) { setDisponibilidad(null); return }
    verificarDisponibilidad(habitacion.id, fechaEntrada, fechaSalida).then(setDisponibilidad).catch(() => setDisponibilidad(null))
  }, [fechaEntrada, fechaSalida, habitacion.id])

  async function reservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    if (fechaSalida <= fechaEntrada) { setError('La fecha de salida debe ser posterior'); return }
    setError(''); setCargando(true)
    try {
      await crearReserva({ habitacionTipoId: habitacion.id, fechaEntrada, fechaSalida, huespedes, metodoPago, notasCliente: notas || undefined, nombreHuesped: nombre.trim(), telefonoHuesped: telefono.trim() })
      onSuccess()
    } catch (e: any) { setError(e.message) } finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-h-[93vh] overflow-y-auto rounded-t-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg text-[#1A1A1A]">{habitacion.nombre}</h3>
            <p className="text-sm text-[#2D6A4F] font-semibold mt-0.5">{formatearPrecio(Number(habitacion.precioPorNoche))} <span className="text-gray-400 font-normal">/ noche</span></p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-lg hover:bg-gray-200 transition-colors">×</button>
        </div>

        <div className="px-5 pt-4 pb-8 space-y-5">
          <CalendarioReserva fechaEntrada={fechaEntrada} fechaSalida={fechaSalida}
            onChangeFechaEntrada={setFechaEntrada} onChangeFechaSalida={setFechaSalida}
            checkInHora={hotel.checkInHora} checkOutHora={hotel.checkOutHora} />

          {/* Resumen precio */}
          <div className={`rounded-2xl p-4 flex items-center justify-between ${
            disponibilidad === null ? 'bg-gray-50' : disponibilidad.disponibles > 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'
          }`}>
            <div>
              <p className="font-semibold text-[#1A1A1A]">{noches} noche{noches !== 1 ? 's' : ''}</p>
              {disponibilidad !== null && (
                <p className={`text-xs mt-0.5 font-medium ${disponibilidad.disponibles > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {disponibilidad.disponibles > 0 ? `✓ ${disponibilidad.disponibles} disponible(s)` : '✗ Sin disponibilidad'}
                </p>
              )}
            </div>
            <p className="font-bold text-xl text-[#1A1A1A]">{formatearPrecio(total)}</p>
          </div>

          {/* Huéspedes */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Huéspedes (máx. {habitacion.capacidad})</label>
            <div className="flex items-center gap-4 border border-gray-200 rounded-2xl px-4 py-3">
              <button onClick={() => setHuespedes(h => Math.max(1, h - 1))} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200">−</button>
              <span className="flex-1 text-center font-semibold text-lg">{huespedes}</span>
              <button onClick={() => setHuespedes(h => Math.min(habitacion.capacidad, h + 1))} className="w-8 h-8 rounded-full bg-[#E8F4F0] flex items-center justify-center text-[#2D6A4F] font-bold hover:bg-[#B7E4C7]">+</button>
            </div>
          </div>

          {/* Datos */}
          <div className="space-y-3">
            {[
              { label: 'Nombre del huésped', value: nombre, set: setNombre, type: 'text', ph: 'Nombre completo' },
              { label: 'Teléfono', value: telefono, set: setTelefono, type: 'tel', ph: '3001234567' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10 bg-white" />
              </div>
            ))}
          </div>

          {/* Pago */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Método de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F] bg-white">
              <option value="EFECTIVO">💵 Efectivo al llegar</option>
              <option value="NEQUI">📱 Nequi</option>
              <option value="TRANSFERENCIA">🏦 Transferencia bancaria</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Notas especiales (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Llegada tarde, cama adicional, necesidades especiales…"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none bg-white" />
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600">{error}</div>}

          <button onClick={reservar}
            disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles <= 0)}
            className="w-full bg-[#2D6A4F] text-white font-bold py-4 rounded-2xl text-base hover:bg-[#1B4332] transition-all disabled:opacity-50 shadow-lg shadow-[#2D6A4F]/25 active:scale-[0.98]">
            {cargando ? 'Procesando…' : hotel.confirmacionAuto ? 'Confirmar reserva' : 'Solicitar reserva'}
          </button>

          {!hotel.confirmacionAuto && (
            <p className="text-xs text-center text-gray-400">El hotel confirmará en las próximas {hotel.horasLimiteConfirm} horas</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── PÁGINA PRINCIPAL ───────────────────────────────────── */
export default function HotelDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const { autenticado } = useAuth()

  const [hotel, setHotel]     = useState<ConfigHotel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [habSelec, setHabSelec] = useState<HabitacionTipo | null>(null)
  const [reservaOk, setReservaOk] = useState(false)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null)
  const { mostrar: mostrarToast, toastProps } = useToast()
  const refHabitaciones = useRef<HTMLDivElement>(null)

  useEffect(() => {
    obtenerHotel(Number(id))
      .then(d => { setHotel(d); setCargando(false) })
      .catch(() => setCargando(false))
  }, [id])

  useEffect(() => {
    if (!autenticado || !hotel) return
    misReservasHotel().then(rs => {
      const elegible = rs.find(r => r.configHotelId === hotel.id && r.estado === 'CHECKOUT' && !r.review)
      setReservaElegibleId(elegible?.id)
    }).catch(() => {})
  }, [autenticado, hotel])

  if (cargando) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="space-y-2 text-center">
        <div className="w-12 h-12 border-3 border-[#2D6A4F] border-t-transparent rounded-full animate-spin mx-auto" style={{ borderWidth: 3 }} />
        <p className="text-xs text-gray-400">Cargando hotel…</p>
      </div>
    </div>
  )

  if (!hotel) return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center gap-3 text-gray-400">
      <span className="text-6xl">🏨</span>
      <p className="font-medium">Hotel no encontrado</p>
      <Link href="/hoteles" className="text-[#2D6A4F] text-sm underline">Volver al listado</Link>
    </div>
  )

  const todasFotos  = hotel.habitaciones.flatMap(h => h.fotos)
  const precioDesde = hotel.habitaciones.length > 0
    ? Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche)))
    : null

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: hotel!.comercio.nombre, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* ── HERO ── */}
      <HeroCine
        fotos={todasFotos}
        hotel={hotel}
        onAbrirFoto={i => setLightbox({ fotos: todasFotos, idx: i })}
        onShare={handleShare}
        precioDesde={precioDesde}
      />

      {/* ── CONTENIDO ── */}
      <div className="max-w-xl mx-auto">

        {/* Descripción */}
        {hotel.comercio.descripcion && (
          <div className="px-5 pt-5 pb-1">
            <p className="text-sm text-gray-600 leading-relaxed">{hotel.comercio.descripcion}</p>
          </div>
        )}

        {/* CHECK-IN / CHECK-OUT */}
        <div className="px-5 pt-5 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-5 text-center shadow-sm">
            <div className="text-2xl mb-1">🌅</div>
            <p className="text-[10px] text-[#2D6A4F] font-bold uppercase tracking-widest">Check-in</p>
            <p className="font-black text-[#1A1A1A] text-2xl mt-1">{hotel.checkInHora}</p>
          </div>
          <div className="bg-white rounded-3xl p-5 text-center shadow-sm">
            <div className="text-2xl mb-1">🌇</div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Check-out</p>
            <p className="font-black text-[#1A1A1A] text-2xl mt-1">{hotel.checkOutHora}</p>
          </div>
        </div>

        {/* SERVICIOS — scroll horizontal */}
        {hotel.servicios.length > 0 && (
          <div className="pt-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-5 mb-3">Lo que incluye</p>
            <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {hotel.servicios.map(s => {
                const info = SERVICIOS_ICONS[s]
                return (
                  <div key={s} className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 text-center shadow-sm flex flex-col items-center gap-1 min-w-[72px]">
                    <span className="text-xl">{info?.icon ?? '✓'}</span>
                    <span className="text-[10px] text-gray-600 font-medium leading-tight text-center">{info?.label ?? s}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* HABITACIONES */}
        <div className="pt-6 pb-2" ref={refHabitaciones}>
          <div className="flex items-center justify-between px-5 mb-4">
            <p className="font-bold text-[#1A1A1A] text-lg">Habitaciones</p>
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{hotel.habitaciones.length} tipo{hotel.habitaciones.length !== 1 ? 's' : ''}</span>
          </div>

          {hotel.habitaciones.length === 0 ? (
            <div className="mx-5 bg-white rounded-3xl p-10 text-center text-gray-300 shadow-sm">
              <p className="text-5xl mb-3">🛏️</p>
              <p className="font-medium text-gray-400">Sin habitaciones publicadas</p>
            </div>
          ) : (
            <div className="space-y-4 px-5">
              {hotel.habitaciones.map(hab => (
                <div key={hab.id} className="bg-white rounded-3xl overflow-hidden shadow-sm">

                  {/* Foto full-width */}
                  <FotoHabitacion
                    fotos={hab.fotos}
                    nombre={hab.nombre}
                    onOpen={i => setLightbox({ fotos: hab.fotos, idx: i })}
                  />

                  {/* Info */}
                  <div className="p-5">
                    {/* Nombre + precio */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#1A1A1A] text-base leading-tight">{hab.nombre}</h3>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            hasta {hab.capacidad} persona{hab.capacidad !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                            {hab.cantidad} hab.
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-black text-[#2D6A4F] text-xl leading-none">{formatearPrecio(Number(hab.precioPorNoche))}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">por noche</p>
                      </div>
                    </div>

                    {/* Descripción */}
                    {hab.descripcion && (
                      <p className="text-sm text-gray-500 leading-relaxed mb-3">{hab.descripcion}</p>
                    )}

                    {/* Amenidades de habitación */}
                    {hab.serviciosExtra.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {hab.serviciosExtra.map(s => (
                          <span key={s} className="text-[11px] bg-[#F0F9F4] text-[#2D6A4F] border border-[#B7E4C7] px-3 py-1 rounded-full font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Botón reservar */}
                    <button
                      onClick={() => { if (!autenticado) { router.push('/login'); return }; setHabSelec(hab) }}
                      className="w-full bg-[#2D6A4F] text-white font-bold py-3.5 rounded-2xl text-sm hover:bg-[#1B4332] transition-all active:scale-[0.97] shadow-md shadow-[#2D6A4F]/20">
                      Reservar esta habitación →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* POLÍTICA CANCELACIÓN */}
        {hotel.politicaCancelacion && (
          <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-3xl p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Política de cancelación</p>
            <p className="text-sm text-amber-800 leading-relaxed">{hotel.politicaCancelacion}</p>
          </div>
        )}

        {/* WHATSAPP */}
        {hotel.comercio.whatsapp && (
          <div className="px-5 mt-4">
            <a href={`https://wa.me/57${hotel.comercio.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              className="flex items-center gap-3 justify-center w-full py-4 rounded-3xl text-white font-bold text-sm transition-all active:scale-[0.98] shadow-lg"
              style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Hablar con el hotel por WhatsApp
            </a>
          </div>
        )}

        {/* MAPA */}
        {hotel.comercio.latitud && hotel.comercio.longitud && (
          <div className="mx-5 mt-4 bg-white rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ubicación</p>
            </div>
            <MapaHoteles hoteles={[hotel]} userLat={null} userLon={null} />
          </div>
        )}

        {/* RESEÑAS */}
        <div className="px-5 mt-4 pb-6">
          <SeccionReviewsHotel configHotelId={hotel.id} reservaElegibleId={reservaElegibleId} />
        </div>

        {/* MIS RESERVAS */}
        {autenticado && (
          <div className="px-5 pb-24">
            <Link href="/hoteles/mis-reservas"
              className="flex items-center justify-between bg-white rounded-3xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E8F4F0] rounded-2xl flex items-center justify-center text-lg">📋</div>
                <div>
                  <p className="font-semibold text-[#1A1A1A] text-sm">Mis reservas</p>
                  <p className="text-xs text-gray-400 mt-0.5">Estado de tus reservas activas</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-gray-300"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>
        )}
      </div>

      {/* MODAL RESERVA */}
      {habSelec && !reservaOk && (
        <FormReserva hotel={hotel} habitacion={habSelec}
          onClose={() => setHabSelec(null)}
          onSuccess={() => { setHabSelec(null); setReservaOk(true) }}
        />
      )}

      {/* CONFIRMACIÓN */}
      {reservaOk && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#E8F4F0] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="font-black text-2xl text-[#1A1A1A] mb-2">¡Listo!</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              {hotel.confirmacionAuto
                ? 'Tu reserva fue confirmada. Te esperamos.'
                : `El hotel revisará tu solicitud y te confirmará en las próximas ${hotel.horasLimiteConfirm} horas.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReservaOk(false)}
                className="flex-1 border-2 border-gray-100 rounded-2xl py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Seguir viendo
              </button>
              <Link href="/hoteles/mis-reservas"
                className="flex-1 bg-[#2D6A4F] text-white rounded-2xl py-3 text-sm font-bold text-center hover:bg-[#1B4332] transition-colors">
                Ver reserva
              </Link>
            </div>
          </div>
        </div>
      )}

      <Toast {...toastProps} />
    </div>
  )
}
