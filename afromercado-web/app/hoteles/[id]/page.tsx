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

const SERVICIOS_LABELS: Record<string, string> = {
  wifi: '📶 WiFi', desayuno: '🍳 Desayuno', parking: '🅿️ Parqueadero',
  piscina: '🏊 Piscina', restaurante: '🍽️ Restaurante', aire: '❄️ A/C',
  gym: '💪 Gym', spa: '💆 Spa', bar: '🍸 Bar', mascotas: '🐾 Mascotas',
}

/* ─────────────── Lightbox ─────────────────────────────── */
function Lightbox({ fotos, inicial, onClose }: { fotos: string[]; inicial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(inicial)
  const prev = () => setIdx(i => (i - 1 + fotos.length) % fotos.length)
  const next = () => setIdx(i => (i + 1) % fotos.length)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-4" onClick={e => e.stopPropagation()}>
        <span className="text-white/50 text-sm font-medium">{idx + 1} / {fotos.length}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white text-3xl leading-none">×</button>
      </div>
      <div className="flex-1 flex items-center justify-center relative px-12" onClick={e => e.stopPropagation()}>
        <button onClick={prev} className="absolute left-2 bg-white/10 hover:bg-white/25 text-white rounded-full w-11 h-11 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <img src={fotos[idx]} alt="" className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl" />
        <button onClick={next} className="absolute right-2 bg-white/10 hover:bg-white/25 text-white rounded-full w-11 h-11 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="flex gap-2 px-5 py-4 overflow-x-auto" onClick={e => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
        {fotos.map((f, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === idx ? 'border-white scale-105' : 'border-transparent opacity-40 hover:opacity-70'}`}>
            <img src={f} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────── Hero con foto + info flotante ─────────── */
function HeroHotel({ fotos, hotel, onFotoClick, onShare }: {
  fotos: string[]
  hotel: ConfigHotel
  onFotoClick: (i: number) => void
  onShare: () => void
}) {
  const [idx, setIdx] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const desde = hotel.habitaciones.length > 0
    ? Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche)))
    : null

  return (
    <div className="relative h-[340px] overflow-hidden"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStartX.current === null || fotos.length < 2) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        if (dx > 40) setIdx(i => (i - 1 + fotos.length) % fotos.length)
        else if (dx < -40) setIdx(i => (i + 1) % fotos.length)
        touchStartX.current = null
      }}
    >
      {/* Foto de fondo */}
      {fotos.length > 0 ? (
        <img src={fotos[idx]} alt={hotel.comercio.nombre}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          onClick={() => onFotoClick(idx)} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] to-[#40916C]" />
      )}

      {/* Gradiente top y bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

      {/* Top bar: back + share */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4">
        <Link href="/hoteles" className="bg-black/40 backdrop-blur-sm text-white rounded-full p-2.5 hover:bg-black/60 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="flex items-center gap-2">
          {fotos.length > 1 && (
            <span className="bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
              {idx + 1}/{fotos.length}
            </span>
          )}
          <button onClick={onShare} className="bg-black/40 backdrop-blur-sm text-white rounded-full p-2.5 hover:bg-black/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>

      {/* Flechas de navegación */}
      {fotos.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + fotos.length) % fotos.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/35 hover:bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => setIdx(i => (i + 1) % fotos.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/35 hover:bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </>
      )}

      {/* Info flotando sobre el hero — efecto Airbnb */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">
              📍 {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}
            </p>
            <h1 className="text-white font-bold text-2xl leading-tight drop-shadow-lg">
              {hotel.comercio.nombre}
            </h1>
            {Number(hotel.comercio.totalReviews) > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-yellow-400 text-sm">★</span>
                <span className="text-white font-semibold text-sm">{Number(hotel.comercio.calificacion).toFixed(1)}</span>
                <span className="text-white/60 text-xs">({hotel.comercio.totalReviews} reseñas)</span>
              </div>
            )}
          </div>
          {desde && (
            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-right flex-shrink-0">
              <p className="text-white/70 text-[10px] font-medium uppercase tracking-wide">Desde</p>
              <p className="text-white font-bold text-base leading-tight">{formatearPrecio(desde)}</p>
              <p className="text-white/60 text-[10px]">/noche</p>
            </div>
          )}
        </div>

        {/* Dots */}
        {fotos.length > 1 && fotos.length <= 8 && (
          <div className="flex gap-1 mt-3">
            {fotos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Card que emerge del hero */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#FAF8F5] rounded-t-3xl" />
    </div>
  )
}

/* ─────────────── Carrusel compacto habitación ──────────── */
function CarruselHab({ fotos, nombre, onOpen }: { fotos: string[]; nombre: string; onOpen: (i: number) => void }) {
  const [idx, setIdx] = useState(0)
  const touchX = useRef<number | null>(null)

  if (fotos.length === 0) {
    return (
      <div className="w-28 h-full min-h-[120px] bg-gradient-to-br from-[#E8F4F0] to-[#B7E4C7] flex items-center justify-center text-3xl flex-shrink-0 rounded-l-2xl">
        🛏️
      </div>
    )
  }

  return (
    <div className="relative w-28 flex-shrink-0 overflow-hidden rounded-l-2xl cursor-pointer"
      onClick={() => onOpen(idx)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null || fotos.length < 2) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx > 30) setIdx(i => (i - 1 + fotos.length) % fotos.length)
        else if (dx < -30) setIdx(i => (i + 1) % fotos.length)
        touchX.current = null
      }}>
      <img src={fotos[idx]} alt={nombre} className="w-full h-full object-cover" />
      {fotos.length > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
          {fotos.slice(0, 5).map((_, i) => (
            <span key={i} className={`rounded-full transition-all ${i === idx ? 'w-3 h-1 bg-white' : 'w-1 h-1 bg-white/50'}`} />
          ))}
        </div>
      )}
      {/* Ver más fotos */}
      <div className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </div>
    </div>
  )
}

/* ─────────────── Form de reserva ──────────────────────── */
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
  const [error,    setError]    = useState('')

  const noches = Math.max(1, Math.ceil((new Date(fechaSalida).getTime() - new Date(fechaEntrada).getTime()) / 86400000))
  const total  = Number(habitacion.precioPorNoche) * noches

  useEffect(() => {
    if (!fechaEntrada || !fechaSalida || fechaSalida <= fechaEntrada) { setDisponibilidad(null); return }
    verificarDisponibilidad(habitacion.id, fechaEntrada, fechaSalida).then(setDisponibilidad).catch(() => setDisponibilidad(null))
  }, [fechaEntrada, fechaSalida, habitacion.id])

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    if (fechaSalida <= fechaEntrada) { setError('La salida debe ser después de la entrada'); return }
    setError(''); setCargando(true)
    try {
      await crearReserva({ habitacionTipoId: habitacion.id, fechaEntrada, fechaSalida, huespedes, metodoPago, notasCliente: notas || undefined, nombreHuesped: nombre.trim(), telefonoHuesped: telefono.trim() })
      onSuccess()
    } catch (e: any) { setError(e.message) } finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#1A1A1A] text-lg">Reservar</h3>
              <p className="text-xs text-gray-500 mt-0.5">{habitacion.nombre} · {formatearPrecio(Number(habitacion.precioPorNoche))}/noche</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors text-lg leading-none">×</button>
          </div>

          <div className="space-y-4">
            <CalendarioReserva fechaEntrada={fechaEntrada} fechaSalida={fechaSalida}
              onChangeFechaEntrada={setFechaEntrada} onChangeFechaSalida={setFechaSalida}
              checkInHora={hotel.checkInHora} checkOutHora={hotel.checkOutHora} />

            {/* Resumen */}
            <div className={`rounded-2xl p-4 text-sm flex items-center justify-between ${
              disponibilidad === null ? 'bg-gray-50' : disponibilidad.disponibles > 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
            }`}>
              <div>
                <p className="font-semibold text-[#1A1A1A]">{noches} noche{noches !== 1 ? 's' : ''}</p>
                {disponibilidad !== null && (
                  <p className={`text-xs mt-0.5 ${disponibilidad.disponibles > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {disponibilidad.disponibles > 0 ? `✓ ${disponibilidad.disponibles} disponible(s)` : '✗ Sin disponibilidad'}
                  </p>
                )}
              </div>
              <p className="font-bold text-[#1A1A1A] text-lg">{formatearPrecio(total)}</p>
            </div>

            {[
              { label: `Huéspedes (máx. ${habitacion.capacidad})`, el: <input type="number" min={1} max={habitacion.capacidad} value={huespedes} onChange={e => setHuespedes(Number(e.target.value))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10" /> },
              { label: 'Nombre del huésped', el: <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10" /> },
              { label: 'Teléfono de contacto', el: <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 3001234567" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10" /> },
            ].map(({ label, el }) => (
              <div key={label}><label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>{el}</div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10 bg-white">
                <option value="EFECTIVO">Efectivo al llegar</option>
                <option value="NEQUI">Nequi</option>
                <option value="TRANSFERENCIA">Transferencia bancaria</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Notas (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Llegada tarde, cama adicional, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/10 resize-none" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <button onClick={handleReservar}
              disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles <= 0)}
              className="w-full bg-[#2D6A4F] text-white font-bold py-4 rounded-2xl text-sm hover:bg-[#40916C] transition-colors disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-[#2D6A4F]/30">
              {cargando ? 'Procesando…' : hotel.confirmacionAuto ? '✅ Confirmar reserva' : '📩 Solicitar reserva'}
            </button>
            {!hotel.confirmacionAuto && (
              <p className="text-xs text-center text-gray-400">El hotel confirmará en las próximas {hotel.horasLimiteConfirm}h</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Página principal ──────────────────────── */
export default function HotelDetallePage() {
  const { id }    = useParams()
  const router    = useRouter()
  const { autenticado } = useAuth()
  const [hotel,   setHotel]   = useState<ConfigHotel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [habitacionSelec, setHabitacionSelec] = useState<HabitacionTipo | null>(null)
  const [reservaOk, setReservaOk] = useState(false)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null)
  const { mostrar: mostrarToast, toastProps } = useToast()

  useEffect(() => {
    obtenerHotel(Number(id)).then(d => { setHotel(d); setCargando(false) }).catch(() => setCargando(false))
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
      <div className="w-10 h-10 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!hotel) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-gray-400">
      <div className="text-center"><p className="text-4xl mb-3">🏨</p><p>Hotel no encontrado</p></div>
    </div>
  )

  const todasFotos = hotel.habitaciones.flatMap(h => h.fotos)

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: hotel!.comercio.nombre, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* Hero con foto + info flotante */}
      <HeroHotel
        fotos={todasFotos}
        hotel={hotel}
        onFotoClick={i => setLightbox({ fotos: todasFotos, idx: i })}
        onShare={handleShare}
      />

      <main className="max-w-2xl mx-auto px-4 pb-20 space-y-4" style={{ marginTop: '-6px' }}>

        {/* Descripción */}
        {hotel.comercio.descripcion && (
          <p className="text-sm text-gray-600 leading-relaxed px-1">{hotel.comercio.descripcion}</p>
        )}

        {/* Check-in / Check-out */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
            <p className="text-[10px] text-[#2D6A4F] font-bold uppercase tracking-widest mb-1">Check-in</p>
            <p className="font-bold text-[#1A1A1A] text-2xl">{hotel.checkInHora}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Check-out</p>
            <p className="font-bold text-[#1A1A1A] text-2xl">{hotel.checkOutHora}</p>
          </div>
        </div>

        {/* Servicios */}
        {hotel.servicios.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Servicios incluidos</p>
            <div className="flex flex-wrap gap-2">
              {hotel.servicios.map(s => (
                <span key={s} className="inline-flex items-center gap-1 text-xs bg-[#E8F4F0] text-[#2D6A4F] font-medium px-3 py-1.5 rounded-full border border-[#B7E4C7]">
                  {SERVICIOS_LABELS[s] ?? s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Habitaciones */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Habitaciones disponibles</p>
          {hotel.habitaciones.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm border border-gray-100">
              <p className="text-4xl mb-2">🛏️</p>
              <p className="font-medium">Sin habitaciones publicadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hotel.habitaciones.map(hab => (
                <div key={hab.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex" style={{ minHeight: 130 }}>
                  {/* Foto lateral — carrusel compacto */}
                  <CarruselHab
                    fotos={hab.fotos}
                    nombre={hab.nombre}
                    onOpen={i => setLightbox({ fotos: hab.fotos, idx: i })}
                  />

                  {/* Info */}
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#1A1A1A] text-sm leading-tight truncate">{hab.nombre}</h3>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            👤 {hab.capacidad} · 🏠 {hab.cantidad}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-[#2D6A4F] text-base">{formatearPrecio(Number(hab.precioPorNoche))}</p>
                          <p className="text-[10px] text-gray-400">/noche</p>
                        </div>
                      </div>
                      {hab.descripcion && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{hab.descripcion}</p>
                      )}
                      {hab.serviciosExtra.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {hab.serviciosExtra.slice(0, 3).map(s => (
                            <span key={s} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                          {hab.serviciosExtra.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{hab.serviciosExtra.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { if (!autenticado) { router.push('/login'); return }; setHabitacionSelec(hab) }}
                      className="mt-3 w-full bg-[#2D6A4F] text-white font-semibold py-2 rounded-xl text-xs hover:bg-[#40916C] transition-colors active:scale-[0.97]">
                      Reservar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Política de cancelación */}
        {hotel.politicaCancelacion && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5">⚠️ Política de cancelación</p>
            <p className="text-sm text-amber-800 leading-relaxed">{hotel.politicaCancelacion}</p>
          </div>
        )}

        {/* WhatsApp */}
        {hotel.comercio.whatsapp && (
          <a href={`https://wa.me/57${hotel.comercio.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
            className="flex items-center gap-3 justify-center w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors shadow-lg shadow-green-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contactar por WhatsApp
          </a>
        )}

        {/* Mapa */}
        {hotel.comercio.latitud && hotel.comercio.longitud && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ubicación</p>
            </div>
            <MapaHoteles hoteles={[hotel]} userLat={null} userLon={null} />
          </div>
        )}

        {/* Reseñas */}
        <SeccionReviewsHotel configHotelId={hotel.id} reservaElegibleId={reservaElegibleId} />

        {/* Mis reservas link */}
        {autenticado && (
          <Link href="/hoteles/mis-reservas"
            className="flex items-center justify-between bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 hover:border-[#2D6A4F]/30 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-semibold text-[#1A1A1A] text-sm">Mis reservas</p>
                <p className="text-xs text-gray-400">Ver el estado de tus reservas</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-gray-300"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
        )}
      </main>

      {/* Modal reserva */}
      {habitacionSelec && !reservaOk && (
        <FormReserva hotel={hotel} habitacion={habitacionSelec}
          onClose={() => setHabitacionSelec(null)}
          onSuccess={() => { setHabitacionSelec(null); setReservaOk(true) }}
        />
      )}

      {/* Confirmación */}
      {reservaOk && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h3 className="font-bold text-xl text-[#1A1A1A] mb-2">¡Reserva enviada!</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {hotel.confirmacionAuto ? 'Tu reserva fue confirmada automáticamente.' : `El hotel revisará tu solicitud y confirmará en las próximas ${hotel.horasLimiteConfirm}h.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReservaOk(false)} className="flex-1 border border-gray-200 rounded-2xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Seguir viendo
              </button>
              <Link href="/hoteles/mis-reservas" className="flex-1 bg-[#2D6A4F] text-white rounded-2xl py-3 text-sm font-bold text-center hover:bg-[#40916C] transition-colors">
                Mis reservas
              </Link>
            </div>
          </div>
        </div>
      )}

      <Toast {...toastProps} />
    </div>
  )
}
