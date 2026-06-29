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
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Toast, useToast } from '@/components/ui/Toast'

const MapaHoteles = dynamic(() => import('@/components/hoteles/MapaHoteles'), { ssr: false })

const SERVICIOS_LABELS: Record<string, string> = {
  wifi: '📶 WiFi', desayuno: '🍳 Desayuno incluido', parking: '🅿️ Parqueadero',
  piscina: '🏊 Piscina', restaurante: '🍽️ Restaurante', aire: '❄️ Aire acondicionado',
  gym: '💪 Gimnasio', spa: '💆 Spa', bar: '🍸 Bar', mascotas: '🐾 Mascotas permitidas',
}

const ESTADO_INFO = {
  PENDIENTE:  { label: '⏳ Pendiente', color: 'bg-amber-100 text-amber-700' },
  CONFIRMADA: { label: '✅ Confirmada', color: 'bg-green-100 text-green-700' },
  CHECKIN:    { label: '🏨 En estadía', color: 'bg-blue-100 text-blue-700' },
  CHECKOUT:   { label: '👋 Finalizada', color: 'bg-gray-100 text-gray-600' },
  CANCELADA:  { label: '❌ Cancelada',  color: 'bg-red-100 text-red-600' },
  RECHAZADA:  { label: '🚫 Rechazada',  color: 'bg-red-100 text-red-600' },
}

/* ── Lightbox ─────────────────────────────────────────────── */
function Lightbox({ fotos, inicial, onClose }: { fotos: string[]; inicial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(inicial)
  const prev = () => setIdx(i => (i - 1 + fotos.length) % fotos.length)
  const next = () => setIdx(i => (i + 1) % fotos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/60 text-sm">{idx + 1} / {fotos.length}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
      </div>

      {/* Imagen principal */}
      <div className="flex-1 flex items-center justify-center relative px-10" onClick={e => e.stopPropagation()}>
        <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <img src={fotos[idx]} alt="" className="max-h-full max-w-full object-contain rounded-xl" style={{ maxHeight: 'calc(100vh - 180px)' }} />
        <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto flex-shrink-0" onClick={e => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
        {fotos.map((f, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${i === idx ? 'border-white' : 'border-transparent opacity-50'}`}>
            <img src={f} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Carrusel de fotos para habitación ───────────────────── */
function CarruselHabitacion({ fotos, nombre, onFotoClick }: { fotos: string[]; nombre: string; onFotoClick: (i: number) => void }) {
  const [idx, setIdx] = useState(0)
  const touchStartX = useRef<number | null>(null)

  if (fotos.length === 0) {
    return <div className="h-52 bg-gradient-to-br from-[#E8F4F0] to-[#B7E4C7] flex items-center justify-center text-5xl">🛏️</div>
  }

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + fotos.length) % fotos.length) }
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % fotos.length) }

  return (
    <div className="relative h-52 bg-gray-100 overflow-hidden cursor-pointer"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        if (dx > 40) setIdx(i => (i - 1 + fotos.length) % fotos.length)
        else if (dx < -40) setIdx(i => (i + 1) % fotos.length)
        touchStartX.current = null
      }}
      onClick={() => onFotoClick(idx)}
    >
      <img src={fotos[idx]} alt={nombre} className="w-full h-full object-cover transition-opacity duration-200" />

      {/* Flechas */}
      {fotos.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          {/* Contador */}
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {idx + 1}/{fotos.length}
          </div>
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {fotos.slice(0, 6).map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i) }}
                className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}

      {/* Ícono lupa */}
      <div className="absolute top-2 right-2 bg-black/40 text-white rounded-full p-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </div>
    </div>
  )
}

/* ── Hero con galería del hotel ──────────────────────────── */
function HeroGaleria({ fotos, onFotoClick }: { fotos: string[]; onFotoClick: (i: number) => void }) {
  if (fotos.length === 0) return null

  if (fotos.length === 1) {
    return (
      <div className="h-60 overflow-hidden cursor-pointer relative" onClick={() => onFotoClick(0)}>
        <img src={fotos[0]} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
    )
  }

  // Grid: 1 grande + columna de 2
  const [main, ...rest] = fotos
  return (
    <div className="h-64 flex gap-1 overflow-hidden">
      <div className="flex-1 relative cursor-pointer" onClick={() => onFotoClick(0)}>
        <img src={main} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="w-28 flex flex-col gap-1">
        {rest.slice(0, 2).map((f, i) => (
          <div key={i} className={`flex-1 relative cursor-pointer overflow-hidden ${i === 1 && fotos.length > 3 ? 'relative' : ''}`}
            onClick={() => onFotoClick(i + 1)}>
            <img src={f} alt="" className="w-full h-full object-cover" />
            {i === 1 && fotos.length > 3 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{fotos.length - 3}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Formulario de reserva ───────────────────────────────── */
function FormReserva({ hotel, habitacion, onClose, onSuccess }: {
  hotel: ConfigHotel
  habitacion: HabitacionTipo
  onClose: () => void
  onSuccess: () => void
}) {
  const { usuario } = useAuth()
  const hoy = new Date().toISOString().split('T')[0]
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fechaEntrada, setFechaEntrada] = useState(hoy)
  const [fechaSalida, setFechaSalida]   = useState(manana)
  const [huespedes, setHuespedes]       = useState(1)
  const [metodoPago, setMetodoPago]     = useState('EFECTIVO')
  const [notas, setNotas]               = useState('')
  const [nombre, setNombre]             = useState(usuario?.nombre ?? '')
  const [telefono, setTelefono]         = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setDisponibilidad] = useState<{ disponibles: number } | null>(null)
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')

  const noches = Math.max(1, Math.ceil((new Date(fechaSalida).getTime() - new Date(fechaEntrada).getTime()) / 86400000))
  const total  = Number(habitacion.precioPorNoche) * noches

  useEffect(() => {
    if (!fechaEntrada || !fechaSalida || fechaSalida <= fechaEntrada) { setDisponibilidad(null); return }
    verificarDisponibilidad(habitacion.id, fechaEntrada, fechaSalida)
      .then(setDisponibilidad).catch(() => setDisponibilidad(null))
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#1A1A1A]">Reservar</h3>
              <p className="text-xs text-gray-500">{habitacion.nombre}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
          <div className="space-y-4">
            <CalendarioReserva fechaEntrada={fechaEntrada} fechaSalida={fechaSalida}
              onChangeFechaEntrada={setFechaEntrada} onChangeFechaSalida={setFechaSalida}
              checkInHora={hotel.checkInHora} checkOutHora={hotel.checkOutHora} />

            <div className={`rounded-xl p-3 text-sm flex items-center justify-between ${disponibilidad === null ? 'bg-gray-50' : disponibilidad.disponibles > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="text-gray-600">{noches} noche{noches !== 1 ? 's' : ''}</span>
              <div className="text-right">
                <span className="font-bold text-[#1A1A1A]">{formatearPrecio(total)}</span>
                {disponibilidad !== null && (
                  <p className={`text-xs ${disponibilidad.disponibles > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {disponibilidad.disponibles > 0 ? `✓ ${disponibilidad.disponibles} disponible(s)` : '✗ Sin disponibilidad'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Huéspedes (máx. {habitacion.capacidad})</label>
              <input type="number" min={1} max={habitacion.capacidad} value={huespedes} onChange={e => setHuespedes(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del huésped</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono de contacto</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 3001234567"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]">
                <option value="EFECTIVO">Efectivo al llegar</option>
                <option value="NEQUI">Nequi</option>
                <option value="TRANSFERENCIA">Transferencia bancaria</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas especiales (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Llegada tarde, cama adicional, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={handleReservar}
              disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles <= 0)}
              className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] transition-colors disabled:opacity-50">
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

/* ── Página principal ────────────────────────────────────── */
export default function HotelDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const { autenticado } = useAuth()
  const [hotel, setHotel] = useState<ConfigHotel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [habitacionSelec, setHabitacionSelec] = useState<HabitacionTipo | null>(null)
  const [reservaOk, setReservaOk] = useState(false)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const { mostrar: mostrarToast, toastProps } = useToast()

  // Lightbox
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null)

  useEffect(() => {
    obtenerHotel(Number(id)).then(data => { setHotel(data); setCargando(false) }).catch(() => setCargando(false))
  }, [id])

  useEffect(() => {
    if (!autenticado || !hotel) return
    misReservasHotel().then(rs => {
      const elegible = rs.find(r => r.configHotelId === hotel.id && r.estado === 'CHECKOUT' && !r.review)
      setReservaElegibleId(elegible?.id)
    }).catch(() => {})
  }, [autenticado, hotel])

  if (cargando) return <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" /></div>
  if (!hotel) return <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-gray-400"><p>Hotel no encontrado</p></div>

  // Todas las fotos del hotel (de todas las habitaciones)
  const todasFotos = hotel.habitaciones.flatMap(h => h.fotos)

  function handleReservar(hab: HabitacionTipo) {
    if (!autenticado) { router.push('/login'); return }
    setHabitacionSelec(hab)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Lightbox global */}
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* Header */}
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <Link href="/hoteles" className="text-[#2D6A4F] p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-[#1A1A1A] truncate">{hotel.comercio.nombre}</h1>
          <p className="text-xs text-gray-500">📍 {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {autenticado && (
            <Link href="/hoteles/mis-reservas" className="text-xs text-[#2D6A4F] font-medium whitespace-nowrap">Mis reservas</Link>
          )}
          <button onClick={async () => {
            const url = window.location.href
            if (navigator.share) { try { await navigator.share({ title: hotel.comercio.nombre, url }) } catch {} }
            else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
          }} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </header>

      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Hoteles', href: '/hoteles' }, { label: hotel.comercio.nombre }]} />

      {/* Hero galería */}
      {todasFotos.length > 0 && (
        <HeroGaleria fotos={todasFotos} onFotoClick={i => setLightbox({ fotos: todasFotos, idx: i })} />
      )}

      <main className="max-w-2xl mx-auto px-4 py-5 pb-16 space-y-5">

        {/* Info hotel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            {hotel.comercio.logoUrl && (
              <img src={hotel.comercio.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-xl text-[#1A1A1A]">{hotel.comercio.nombre}</h2>
              {Number(hotel.comercio.totalReviews) > 0 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex text-yellow-400 text-xs">{'★'.repeat(Math.round(Number(hotel.comercio.calificacion)))}{'☆'.repeat(5 - Math.round(Number(hotel.comercio.calificacion)))}</div>
                  <span className="text-sm font-semibold">{Number(hotel.comercio.calificacion).toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({hotel.comercio.totalReviews} reseñas)</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-0.5">📍 {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}</p>
            </div>
          </div>

          {hotel.comercio.descripcion && (
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{hotel.comercio.descripcion}</p>
          )}

          {/* Check-in / Check-out */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#E8F4F0] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[#2D6A4F] font-semibold uppercase tracking-wide mb-0.5">Check-in</p>
              <p className="font-bold text-[#1A1A1A] text-lg">{hotel.checkInHora}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Check-out</p>
              <p className="font-bold text-[#1A1A1A] text-lg">{hotel.checkOutHora}</p>
            </div>
          </div>

          {/* Servicios */}
          {hotel.servicios.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Servicios incluidos</p>
              <div className="flex flex-wrap gap-2">
                {hotel.servicios.map(s => (
                  <span key={s} className="text-xs bg-[#E8F4F0] text-[#2D6A4F] px-3 py-1 rounded-full font-medium">
                    {SERVICIOS_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Política de cancelación */}
          {hotel.politicaCancelacion && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Política de cancelación</p>
              <p className="text-xs text-amber-800 leading-relaxed">{hotel.politicaCancelacion}</p>
            </div>
          )}

          {/* WhatsApp */}
          {hotel.comercio.whatsapp && (
            <a href={`https://wa.me/57${hotel.comercio.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              className="flex items-center gap-2 justify-center w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Contactar por WhatsApp
            </a>
          )}

          {/* Mapa */}
          {hotel.comercio.latitud && hotel.comercio.longitud && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ubicación</p>
              <MapaHoteles hoteles={[hotel]} userLat={null} userLon={null} />
            </div>
          )}
        </div>

        {/* Habitaciones */}
        <div>
          <h2 className="font-bold text-[#1A1A1A] text-lg mb-3">🛏️ Habitaciones disponibles</h2>
          {hotel.habitaciones.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <p className="text-3xl mb-2">🛏️</p>
              <p>Este hotel aún no tiene habitaciones publicadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hotel.habitaciones.map(hab => (
                <div key={hab.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <CarruselHabitacion
                    fotos={hab.fotos}
                    nombre={hab.nombre}
                    onFotoClick={i => setLightbox({ fotos: hab.fotos, idx: i })}
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-bold text-[#1A1A1A] text-base">{hab.nombre}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          👤 hasta {hab.capacidad} persona{hab.capacidad !== 1 ? 's' : ''} &nbsp;·&nbsp;
                          🏠 {hab.cantidad} habitación{hab.cantidad !== 1 ? 'es' : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 bg-[#E8F4F0] px-3 py-1.5 rounded-xl">
                        <p className="font-bold text-[#2D6A4F] text-base">{formatearPrecio(Number(hab.precioPorNoche))}</p>
                        <p className="text-[10px] text-[#40916C]">por noche</p>
                      </div>
                    </div>

                    {hab.descripcion && (
                      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{hab.descripcion}</p>
                    )}

                    {hab.serviciosExtra.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {hab.serviciosExtra.map(s => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}

                    <button onClick={() => handleReservar(hab)}
                      className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] transition-colors active:scale-[0.98]">
                      Reservar esta habitación
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reseñas */}
        <SeccionReviewsHotel configHotelId={hotel.id} reservaElegibleId={reservaElegibleId} />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
            <p className="text-5xl mb-3">🎉</p>
            <h3 className="font-bold text-xl text-[#1A1A1A] mb-2">¡Reserva enviada!</h3>
            <p className="text-sm text-gray-500 mb-6">
              {hotel.confirmacionAuto ? 'Tu reserva fue confirmada automáticamente.' : `El hotel revisará tu solicitud y confirmará en las próximas ${hotel.horasLimiteConfirm}h.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReservaOk(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Seguir viendo
              </button>
              <Link href="/hoteles/mis-reservas" className="flex-1 bg-[#2D6A4F] text-white rounded-xl py-2.5 text-sm font-bold text-center">
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
