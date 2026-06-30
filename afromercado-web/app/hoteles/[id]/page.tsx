'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { obtenerHotel, verificarDisponibilidad, crearReserva, misReservasHotel, listarHoteles, iniciarPagoReserva, validarCuponHotel, esFavoritoHotel, toggleFavoritoHotel, type ConfigHotel, type HabitacionTipo, type ReservaHotel, type ValidacionCupon, type TemporadaHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import CalendarioReserva from '@/components/hoteles/CalendarioReserva'
import SeccionReviewsHotel from '@/components/hoteles/SeccionReviewsHotel'
import { Toast, useToast } from '@/components/ui/Toast'

const MapaHoteles = dynamic(() => import('@/components/hoteles/MapaHoteles'), { ssr: false })

const SERVICIOS_ICONS: Record<string, { icon: string; label: string }> = {
  wifi:        { icon: '📶', label: 'WiFi gratis' },
  desayuno:    { icon: '🍳', label: 'Desayuno incluido' },
  parking:     { icon: '🅿️', label: 'Parqueadero' },
  piscina:     { icon: '🏊', label: 'Piscina' },
  restaurante: { icon: '🍽️', label: 'Restaurante' },
  aire:        { icon: '❄️', label: 'Aire acondicionado' },
  ventilador:  { icon: '🌀', label: 'Ventilador' },
  gym:         { icon: '💪', label: 'Gimnasio' },
  spa:         { icon: '💆', label: 'Spa' },
  bar:         { icon: '🍸', label: 'Bar' },
  mascotas:    { icon: '🐾', label: 'Mascotas OK' },
  tv:            { icon: '📺', label: 'TV' },
  cocina:        { icon: '🍳', label: 'Cocina equipada' },
  lavadora:      { icon: '🧺', label: 'Lavadora' },
  agua_caliente: { icon: '🚿', label: 'Agua caliente' },
  balcon:        { icon: '🌇', label: 'Balcón' },
}

function esVideo(url: string): boolean {
  return url.includes('/video/upload/') || /\.(mp4|webm|mov|avi)$/i.test(url)
}

function waUrl(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  const normalizado = digitos.startsWith('57') ? digitos : `57${digitos}`
  return `https://wa.me/${normalizado}`
}

/* ── Lightbox ──────────────────────────────────────────── */
function Lightbox({ fotos, inicial, onClose }: { fotos: string[]; inicial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(inicial)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + fotos.length) % fotos.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % fotos.length)
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fotos.length, onClose])

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors flex items-center gap-2 text-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          Cerrar
        </button>
        <span className="text-white/50 text-sm font-medium">{idx + 1} / {fotos.length}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative px-16" onClick={e => e.stopPropagation()}>
        <button onClick={() => setIdx(i => (i - 1 + fotos.length) % fotos.length)}
          className="absolute left-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        {esVideo(fotos[idx])
          ? <video src={fotos[idx]} controls autoPlay className="max-h-[75vh] max-w-full rounded-xl" />
          : <img src={fotos[idx]} alt="" className="max-h-[75vh] max-w-full object-contain rounded-xl" />
        }
        <button onClick={() => setIdx(i => (i + 1) % fotos.length)}
          className="absolute right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="flex gap-2 px-6 pb-6 pt-3 overflow-x-auto flex-shrink-0 justify-center" onClick={e => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
        {fotos.map((f, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 ${i === idx ? 'ring-2 ring-white opacity-100' : 'opacity-35 hover:opacity-60'}`}>
            {esVideo(f)
              ? <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" fill="none" stroke="white" strokeWidth="2"/></svg>
                </div>
              : <img src={f} alt="" className="w-full h-full object-cover" />
            }
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Galería tipo Airbnb ─────────────────────────────── */
function GaleriaHero({ fotos, nombre, onOpen }: { fotos: string[]; nombre: string; onOpen: (i: number) => void }) {
  if (fotos.length === 0) {
    return (
      <div className="h-64 lg:h-[460px] bg-gradient-to-br from-[#1B4332] to-[#40916C] flex items-center justify-center rounded-2xl">
        <span className="text-8xl opacity-30">🏨</span>
      </div>
    )
  }
  if (fotos.length === 1) {
    return (
      <div className="relative h-64 lg:h-[460px] cursor-pointer overflow-hidden rounded-2xl" onClick={() => onOpen(0)}>
        <img src={fotos[0]} alt={nombre} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
        <button onClick={() => onOpen(0)}
          className="absolute bottom-4 right-4 bg-white text-gray-800 font-semibold text-sm px-4 py-2 rounded-xl shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Ver 1 foto
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className={`grid gap-2 h-64 lg:h-[460px] overflow-hidden rounded-2xl ${fotos.length >= 3 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className={`relative cursor-pointer overflow-hidden ${fotos.length >= 3 ? 'row-span-2' : ''}`} onClick={() => onOpen(0)}>
          <img src={fotos[0]} alt={nombre} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
        </div>
        {fotos.length >= 2 && (
          <div className="relative cursor-pointer overflow-hidden" onClick={() => onOpen(1)}>
            <img src={fotos[1]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        )}
        {fotos.length >= 3 && (
          <div className="relative cursor-pointer overflow-hidden" onClick={() => onOpen(2)}>
            <img src={fotos[2]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            {fotos.length > 3 && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{fotos.length - 3} fotos</span>
              </div>
            )}
          </div>
        )}
      </div>
      <button onClick={() => onOpen(0)}
        className="absolute bottom-4 right-4 bg-white text-gray-800 font-semibold text-sm px-4 py-2 rounded-xl shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Ver {fotos.length} fotos
      </button>
    </div>
  )
}

/* ── Tarjeta habitación ─────────────────────────────────── */
function TarjetaHabitacion({ hab, onReservar, onVerFotos }: {
  hab: HabitacionTipo
  onReservar: (h: HabitacionTipo) => void
  onVerFotos: (fotos: string[], idx: number) => void
}) {
  const media = [...hab.fotos, ...(hab.videoUrl ? [hab.videoUrl] : [])]
  const [idx, setIdx] = useState(0)
  const startX = useRef<number | null>(null)
  const cur = media[idx]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="flex flex-col md:flex-row">

        {/* ── Galería izquierda ── */}
        <div className="relative md:w-72 lg:w-80 flex-shrink-0">
          {/* Imagen / video principal */}
          <div
            className="relative aspect-[4/3] md:aspect-auto md:h-full min-h-[220px] cursor-pointer overflow-hidden bg-gray-100"
            onClick={() => media.length > 0 && onVerFotos(media, idx)}
            onTouchStart={e => { startX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              if (!startX.current || media.length < 2) return
              const dx = e.changedTouches[0].clientX - startX.current
              if (dx > 40)  setIdx(i => (i - 1 + media.length) % media.length)
              if (dx < -40) setIdx(i => (i + 1) % media.length)
              startX.current = null
            }}>
            {cur ? (
              esVideo(cur)
                ? <video src={cur} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                : <img src={cur} alt={hab.nombre} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#E8F4F0] to-[#B7E4C7] flex items-center justify-center">
                <span className="text-5xl opacity-20">🛏️</span>
              </div>
            )}

            {/* Badge video */}
            {cur && esVideo(cur) && (
              <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                VIDEO
              </span>
            )}

            {/* Flechas nav */}
            {media.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + media.length) % media.length) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow transition-colors text-lg font-bold">‹</button>
                <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % media.length) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow transition-colors text-lg font-bold">›</button>
              </>
            )}

            {/* Expandir */}
            <button onClick={e => { e.stopPropagation(); onVerFotos(media, idx) }}
              className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow flex items-center gap-1.5 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              {media.length > 1 ? `${media.length} fotos` : 'Ver'}
            </button>
          </div>

          {/* Miniaturas */}
          {media.length > 1 && (
            <div className="flex gap-1.5 px-3 pb-3 pt-2 bg-white overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {media.map((m, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`flex-shrink-0 w-12 h-9 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-[#1B4332] opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                  {esVideo(m)
                    ? <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" fill="none" stroke="white" strokeWidth="2"/></svg>
                      </div>
                    : <img src={m} alt="" className="w-full h-full object-cover" />
                  }
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info derecha ── */}
        <div className="flex-1 flex flex-col p-5 lg:p-6">
          {/* Nombre + precio */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-xl leading-tight">{hab.nombre}</h3>
                {hab.videoUrl && (
                  <span className="inline-flex items-center gap-1 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Video
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Hasta {hab.capacidad} huéspedes
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {hab.cantidad} {hab.cantidad === 1 ? 'habitación' : 'habitaciones'} disponibles
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {(() => {
                const hoy = new Date()
                const temporadaVigente = hab.temporadas?.find(t =>
                  t.activo && new Date(t.inicio) <= hoy && new Date(t.fin) >= hoy
                )
                const precioMostrar = temporadaVigente ? Number(temporadaVigente.precioPorNoche) : Number(hab.precioPorNoche)
                return temporadaVigente ? (
                  <div className="flex items-baseline gap-1.5 justify-end flex-wrap">
                    <span className="text-xs text-gray-400 line-through">{formatearPrecio(Number(hab.precioPorNoche))}</span>
                    <span className="text-2xl font-black text-[#1B4332] leading-none">{formatearPrecio(precioMostrar)}</span>
                    <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{temporadaVigente.nombre}</span>
                  </div>
                ) : (
                  <div className="text-2xl font-black text-[#1B4332] leading-none">{formatearPrecio(precioMostrar)}</div>
                )
              })()}
              <div className="text-xs text-gray-400 mt-1">por noche</div>
            </div>
          </div>

          {/* Descripción */}
          {hab.descripcion && (
            <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-3">{hab.descripcion}</p>
          )}

          {/* Amenidades */}
          {hab.serviciosExtra.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {hab.serviciosExtra.map(s => (
                <span key={s} className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1B4332] flex-shrink-0" />
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Spacer + botón */}
          <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">Sin cobros ocultos · Cancelación flexible</p>
            <button onClick={() => onReservar(hab)}
              className="flex-shrink-0 bg-[#1B4332] hover:bg-[#15362A] active:scale-[0.98] text-white font-bold px-7 py-3 rounded-xl text-sm transition-all shadow-sm whitespace-nowrap">
              Reservar ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Widget reserva lateral (desktop) ──────────────────── */
function WidgetReserva({ hotel, habitaciones, habIdx, fechaEntrada, fechaSalida, onFechaEntrada, onFechaSalida, onHabIdx, onReservar, autenticado, router }: {
  hotel: ConfigHotel; habitaciones: HabitacionTipo[]
  habIdx: number; fechaEntrada: string; fechaSalida: string
  onFechaEntrada: (v: string) => void; onFechaSalida: (v: string) => void; onHabIdx: (i: number) => void
  onReservar: (h: HabitacionTipo) => void
  autenticado: boolean; router: any
}) {
  const hab = habitaciones[habIdx]
  const noches = Math.max(1, Math.ceil((new Date(fechaSalida).getTime() - new Date(fechaEntrada).getTime()) / 86400000))

  async function compartir() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: `${hotel.comercio.nombre} — ${hab?.nombre ?? ''}`, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sticky top-20">
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-3xl font-black text-gray-900">{hab ? formatearPrecio(Number(hab.precioPorNoche)) : '—'}</span>
        <span className="text-gray-500 text-sm">/ noche</span>
      </div>

      {habitaciones.length > 1 && (
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Habitación</label>
          <select value={habIdx} onChange={e => onHabIdx(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1B4332] bg-white">
            {habitaciones.map((h, i) => (
              <option key={h.id} value={i}>{h.nombre} — {formatearPrecio(Number(h.precioPorNoche))}/noche</option>
            ))}
          </select>
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          <div className="px-3 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Llegada</p>
            <input type="date" value={fechaEntrada} onChange={e => onFechaEntrada(e.target.value)}
              className="text-sm font-semibold text-gray-800 border-none p-0 focus:outline-none w-full bg-transparent" />
          </div>
          <div className="px-3 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Salida</p>
            <input type="date" value={fechaSalida} onChange={e => onFechaSalida(e.target.value)}
              className="text-sm font-semibold text-gray-800 border-none p-0 focus:outline-none w-full bg-transparent" />
          </div>
        </div>
      </div>

      <button
        onClick={() => { if (!autenticado) { router.push('/ingresar'); return }; if (hab) onReservar(hab) }}
        className="w-full bg-[#1B4332] hover:bg-[#15362A] text-white font-bold py-4 rounded-xl text-base transition-all active:scale-[0.98] shadow-md mb-4">
        Reservar ahora
      </button>

      {hab && (
        <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4 mb-4">
          <div className="flex justify-between">
            <span className="underline decoration-dotted">{formatearPrecio(Number(hab.precioPorNoche))} × {noches} noche{noches !== 1 ? 's' : ''}</span>
            <span>{formatearPrecio(Number(hab.precioPorNoche) * noches)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
            <span>Total</span>
            <span>{formatearPrecio(Number(hab.precioPorNoche) * noches)}</span>
          </div>
        </div>
      )}

      <button onClick={compartir}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-gray-600 font-medium text-sm border border-gray-200 hover:bg-gray-50 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Compartir alojamiento
      </button>

      <p className="text-xs text-center text-gray-400 mt-3">Sin cobros ocultos · Pago en el hotel</p>
    </div>
  )
}

/* ── Form reserva modal ─────────────────────────────────── */
type ModoPago = 'efectivo' | 'deposito' | 'total'

function FormReserva({ hotel, habitacion, fechaEntradaInicial, fechaSalidaInicial, onClose, onSuccess }: {
  hotel: ConfigHotel; habitacion: HabitacionTipo
  fechaEntradaInicial: string; fechaSalidaInicial: string
  onClose: () => void; onSuccess: (r: ReservaHotel) => void
}) {
  const { usuario } = useAuth()
  const [fechaEntrada, setFechaEntrada] = useState(fechaEntradaInicial)
  const [fechaSalida,  setFechaSalida]  = useState(fechaSalidaInicial)
  const [huespedes,    setHuespedes]    = useState(1)
  const [notas,        setNotas]        = useState('')
  const [nombre,       setNombre]       = useState(usuario?.nombre ?? '')
  const [telefono,     setTelefono]     = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [modoPago,     setModoPago]     = useState<ModoPago>('efectivo')
  const [disponibilidad, setDisponibilidad] = useState<{ disponibles: number } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [codigoCupon, setCodigoCupon] = useState('')
  const [cuponAplicado, setCuponAplicado] = useState<ValidacionCupon | null>(null)
  const [cuponError, setCuponError] = useState('')
  const [aplicandoCupon, setAplicandoCupon] = useState(false)

  const noches = Math.max(1, Math.ceil((new Date(fechaSalida).getTime() - new Date(fechaEntrada).getTime()) / 86400000))
  const total  = Number(habitacion.precioPorNoche) * noches

  async function aplicarCupon() {
    if (!codigoCupon.trim()) return
    setAplicandoCupon(true)
    setCuponError('')
    setCuponAplicado(null)
    try {
      const resultado = await validarCuponHotel({
        codigo: codigoCupon.trim().toUpperCase(),
        habitacionTipoId: habitacion.id,
        fechaEntrada: fechaEntrada || '',
        fechaSalida: fechaSalida || '',
      })
      setCuponAplicado(resultado)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Cupón inválido o expirado'
      setCuponError(msg)
    }
    setAplicandoCupon(false)
  }

  useEffect(() => {
    if (!fechaEntrada || !fechaSalida || fechaSalida <= fechaEntrada) { setDisponibilidad(null); return }
    verificarDisponibilidad(habitacion.id, fechaEntrada, fechaSalida).then(setDisponibilidad).catch(() => setDisponibilidad(null))
  }, [fechaEntrada, fechaSalida, habitacion.id])

  async function reservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    if (fechaSalida <= fechaEntrada) { setError('La fecha de salida debe ser posterior'); return }
    setError(''); setCargando(true)
    try {
      const metodoPagoFinal = modoPago === 'efectivo' ? 'EFECTIVO' : 'WOMPI'
      const reservaCreada = await crearReserva({
        habitacionTipoId: habitacion.id,
        fechaEntrada, fechaSalida, huespedes,
        metodoPago: metodoPagoFinal,
        notasCliente: notas || undefined,
        nombreHuesped: nombre.trim(),
        telefonoHuesped: telefono.trim(),
        codigoCupon: cuponAplicado?.cupon?.codigo || undefined,
      })
      if (modoPago !== 'efectivo') {
        const { checkoutUrl } = await iniciarPagoReserva(reservaCreada.id)
        window.location.href = checkoutUrl
        return
      }
      onSuccess(reservaCreada)
    } catch (e: any) { setError(e.message) } finally { setCargando(false) }
  }

  const opcionesPago: { id: ModoPago; icon: string; titulo: string; desc: string }[] = [
    ...(hotel.permitePagarAlLlegar !== false ? [{ id: 'efectivo' as ModoPago, icon: '💵', titulo: 'Pagar al llegar', desc: 'Sin cargo ahora. Efectivo, Nequi o transferencia al check-in.' }] : []),
    ...(hotel.permiteDeposito30    !== false ? [{ id: 'deposito' as ModoPago, icon: '💳', titulo: `Depósito 30% — ${formatearPrecio(Math.round(total * 0.30))}`, desc: 'Confirma inmediatamente. El resto lo pagas al llegar.' }] : []),
    ...(hotel.permiteTotal         !== false ? [{ id: 'total'    as ModoPago, icon: '🔒', titulo: `Pagar total — ${formatearPrecio(total)}`, desc: 'Pago completo ahora. Reserva garantizada al 100%.' }] : []),
  ]

  const textoBoton = cargando ? 'Procesando…'
    : modoPago === 'deposito' ? `Pagar depósito ${formatearPrecio(Math.round(total * 0.30))} →`
    : modoPago === 'total'    ? `Pagar total ${formatearPrecio(total)} →`
    : hotel.confirmacionAuto  ? 'Confirmar reserva' : 'Solicitar reserva'

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg max-h-[93vh] overflow-y-auto rounded-t-3xl lg:rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center py-3 lg:hidden"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xl text-gray-900">{habitacion.nombre}</h3>
            <p className="text-sm text-[#1B4332] font-semibold mt-0.5">{formatearPrecio(Number(habitacion.precioPorNoche))}<span className="text-gray-400 font-normal"> / noche</span></p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-xl leading-none font-bold">×</button>
        </div>
        <div className="px-6 pt-5 pb-8 space-y-5">
          <CalendarioReserva fechaEntrada={fechaEntrada} fechaSalida={fechaSalida}
            onChangeFechaEntrada={setFechaEntrada} onChangeFechaSalida={setFechaSalida}
            checkInHora={hotel.checkInHora} checkOutHora={hotel.checkOutHora} />

          <div className={`rounded-xl p-4 flex items-center justify-between border ${
            disponibilidad === null ? 'bg-gray-50 border-gray-100'
            : disponibilidad.disponibles > 0 ? 'bg-emerald-50 border-emerald-100'
            : 'bg-red-50 border-red-100'}`}>
            <div>
              <p className="font-semibold text-gray-900">{noches} noche{noches !== 1 ? 's' : ''}</p>
              {disponibilidad !== null && (
                <p className={`text-xs mt-0.5 font-medium ${disponibilidad.disponibles > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {disponibilidad.disponibles > 0 ? `✓ ${disponibilidad.disponibles} habitación(es) disponible(s)` : '✗ Sin disponibilidad'}
                </p>
              )}
            </div>
            {cuponAplicado ? (
              <div className="text-right">
                <p className="text-xs text-gray-400 line-through">{formatearPrecio(total)}</p>
                <p className="font-black text-2xl text-[#1B4332]">{formatearPrecio(cuponAplicado.totalConDescuento)}</p>
                <p className="text-xs text-emerald-600">Ahorras {formatearPrecio(cuponAplicado.descuento)}</p>
              </div>
            ) : (
              <p className="font-black text-2xl text-gray-900">{formatearPrecio(total)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Huéspedes (máx. {habitacion.capacidad})</label>
            <div className="flex items-center gap-4 border border-gray-200 rounded-xl px-4 py-3">
              <button onClick={() => setHuespedes(h => Math.max(1, h - 1))} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">−</button>
              <span className="flex-1 text-center font-bold text-lg">{huespedes}</span>
              <button onClick={() => setHuespedes(h => Math.min(habitacion.capacidad, h + 1))} className="w-9 h-9 rounded-full bg-[#ECFDF5] flex items-center justify-center font-bold text-[#16A34A] hover:bg-[#D1FAE5] transition-colors">+</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Nombre del huésped', value: nombre, set: setNombre, type: 'text', ph: 'Nombre completo' },
              { label: 'Teléfono', value: telefono, set: setTelefono, type: 'tel', ph: '3001234567' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">¿Cómo quieres pagar?</label>
            {opcionesPago.map(op => (
              <button key={op.id} type="button" onClick={() => setModoPago(op.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${modoPago === op.id ? 'border-[#1B4332] bg-[#F0FDF4]' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${modoPago === op.id ? 'border-[#1B4332]' : 'border-gray-300'}`}>
                    {modoPago === op.id && <div className="w-2 h-2 rounded-full bg-[#1B4332]" />}
                  </div>
                  <span className="text-lg">{op.icon}</span>
                  <div>
                    <p className={`font-bold text-sm ${modoPago === op.id ? 'text-[#1B4332]' : 'text-gray-800'}`}>{op.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{op.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Política de cancelación */}
          {hotel.politicaCancelacion && (
            <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Política de cancelación</p>
                <p className="text-xs text-amber-700 leading-relaxed">{hotel.politicaCancelacion}</p>
                {modoPago !== 'efectivo' && (
                  <p className="text-xs text-amber-800 font-semibold mt-2">Si cancelas tras pagar, el hotel gestionará el reembolso según esta política.</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notas especiales (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Llegada tarde, cama adicional, necesidades especiales…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] resize-none" />
          </div>

          {/* Cupón de descuento */}
          <div className="mt-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cupón de descuento</label>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={codigoCupon}
                onChange={e => { setCodigoCupon(e.target.value.toUpperCase()); setCuponAplicado(null); setCuponError('') }}
                placeholder="Ej: AFRO20"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 uppercase"
                disabled={!!cuponAplicado}
              />
              {cuponAplicado ? (
                <button type="button" onClick={() => { setCuponAplicado(null); setCodigoCupon('') }}
                  className="px-3 py-2 text-xs font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50">
                  Quitar
                </button>
              ) : (
                <button type="button" onClick={aplicarCupon} disabled={!codigoCupon.trim() || aplicandoCupon}
                  className="px-3 py-2 text-xs font-medium bg-[#2D6A4F] text-white rounded-xl disabled:opacity-50 hover:bg-[#1B4332] transition-colors">
                  {aplicandoCupon ? '...' : 'Aplicar'}
                </button>
              )}
            </div>
            {cuponError && <p className="text-xs text-red-500 mt-1">{cuponError}</p>}
            {cuponAplicado && (
              <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-emerald-700">
                  ✓ Cupón {cuponAplicado.cupon.codigo} aplicado — descuento {formatearPrecio(cuponAplicado.descuento)}
                </p>
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

          <button onClick={reservar}
            disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles <= 0)}
            className="w-full bg-[#1B4332] text-white font-bold py-4 rounded-xl text-base hover:bg-[#15362A] transition-colors disabled:opacity-50 active:scale-[0.98] shadow-md">
            {textoBoton}
          </button>

          {!hotel.confirmacionAuto && modoPago === 'efectivo' && (
            <p className="text-xs text-center text-gray-400">El hotel confirmará en máx. {hotel.horasLimiteConfirm} horas</p>
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
  const { autenticado, usuario } = useAuth()

  const [hotel, setHotel]         = useState<ConfigHotel | null>(null)
  const [esFav, setEsFav]         = useState(false)
  const [toggling, setToggling]   = useState(false)
  const [cargando, setCargando]   = useState(true)
  const [habSelec, setHabSelec]   = useState<HabitacionTipo | null>(null)
  const [reservaOk, setReservaOk] = useState<ReservaHotel | null>(null)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const [lightbox, setLightbox]   = useState<{ fotos: string[]; idx: number } | null>(null)
  const [similares, setSimilares] = useState<ConfigHotel[]>([])
  const [widgetHabIdx, setWidgetHabIdx] = useState(0)
  const [fechaEntrada, setFechaEntrada] = useState(new Date().toISOString().split('T')[0])
  const [fechaSalida,  setFechaSalida]  = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0])
  const { mostrar: mostrarToast, toastProps } = useToast()

  function abrirReserva(h: HabitacionTipo) {
    if (!autenticado) { router.push('/ingresar'); return }
    const idx = hotel?.habitaciones.findIndex(x => x.id === h.id) ?? 0
    if (idx >= 0) setWidgetHabIdx(idx)
    setHabSelec(h)
  }

  function seleccionarHabYScroll(h: HabitacionTipo) {
    if (!autenticado) { router.push('/ingresar'); return }
    const idx = hotel?.habitaciones.findIndex(x => x.id === h.id) ?? 0
    if (idx >= 0) setWidgetHabIdx(idx)
    const widget = document.querySelector('[data-widget]')
    if (widget) {
      // Desktop: scroll al widget para que el usuario confirme fechas ahí
      widget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      widget.classList.add('ring-2', 'ring-[#1B4332]', 'ring-offset-2')
      setTimeout(() => widget.classList.remove('ring-2', 'ring-[#1B4332]', 'ring-offset-2'), 1500)
    } else {
      // Mobile: no hay widget, abrir formulario directamente
      setHabSelec(h)
    }
  }

  useEffect(() => {
    obtenerHotel(Number(id))
      .then(d => {
        setHotel(d)
        setCargando(false)
        if (usuario) {
          esFavoritoHotel(d.id).then(r => setEsFav(r.favorito)).catch(() => {})
        }
      })
      .catch(() => setCargando(false))
  }, [id, usuario])

  async function toggleFav() {
    if (!usuario) { router.push('/ingresar'); return }
    setToggling(true)
    try {
      const r = await toggleFavoritoHotel(hotel!.id)
      setEsFav(r.favorito)
    } catch {}
    setToggling(false)
  }

  useEffect(() => {
    if (!hotel) return
    listarHoteles({ municipio: hotel.comercio.municipio })
      .then(lista => setSimilares(lista.filter(h => h.id !== hotel.id).slice(0, 3)))
      .catch(() => {})
  }, [hotel])

  useEffect(() => {
    if (!autenticado || !hotel) return
    misReservasHotel().then(rs => {
      const elegible = rs.find(r => r.configHotelId === hotel.id && r.estado === 'CHECKOUT' && !r.review)
      setReservaElegibleId(elegible?.id)
    }).catch(() => {})
  }, [autenticado, hotel])

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#1B4332] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    </div>
  )

  if (!hotel) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400 bg-white">
      <span className="text-6xl">🏨</span>
      <p className="font-medium">Hotel no encontrado</p>
      <Link href="/hoteles" className="text-[#1B4332] text-sm underline">Volver al listado</Link>
    </div>
  )

  const todasFotos  = hotel.habitaciones.flatMap(h => h.fotos)
  const precioDesde = hotel.habitaciones.length > 0
    ? Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche))) : null

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: hotel!.comercio.nombre, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
  }

  return (
    <div className="min-h-screen bg-white">
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* NAV */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/hoteles" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Hoteles
          </Link>
          <div className="flex items-center gap-3">
            {autenticado && (
              <Link href="/hoteles/mis-reservas" className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors">Mis reservas</Link>
            )}
            <button onClick={handleShare}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5 hover:border-gray-300 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Compartir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* GALERÍA */}
        <GaleriaHero fotos={todasFotos} nombre={hotel.comercio.nombre} onOpen={i => setLightbox({ fotos: todasFotos, idx: i })} />

        {/* ACCESO RÁPIDO A HABITACIONES */}
        {hotel.habitaciones.length > 0 && (
          <button
            onClick={() => document.querySelector('[data-rooms]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-4 w-full flex items-center justify-between bg-[#F0FDF4] border border-[#BBF7D0] hover:border-[#1B4332] rounded-2xl px-5 py-4 transition-all group">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛏️</span>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">
                  {hotel.habitaciones.length === 1 ? '1 tipo de habitación disponible' : `${hotel.habitaciones.length} tipos de habitación disponibles`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Desde {formatearPrecio(Math.min(...hotel.habitaciones.map(h => Number(h.precioPorNoche))))} / noche
                  {hotel.habitaciones.some(h => h.videoUrl) && <span className="ml-2 text-[#1B4332] font-medium">· Incluye video</span>}
                </p>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[#1B4332] group-hover:translate-y-1 transition-transform"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </button>
        )}

        {/* LAYOUT 2 COL */}
        <div className="flex gap-12 mt-8">
          {/* Columna principal */}
          <div className="flex-1 min-w-0">

            {/* Título */}
            <div className="pb-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl lg:text-4xl font-black text-gray-900">{hotel.comercio.nombre}</h1>
                  {hotel.rntVerificado && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full mt-2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      RNT verificado
                    </span>
                  )}
                </div>
                <button onClick={toggleFav} disabled={toggling}
                  className={`flex-shrink-0 p-2 rounded-full transition-colors ${esFav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'}`}
                  title={esFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}>
                  <svg className="w-5 h-5" fill={esFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-5 flex-wrap text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}
                </span>
                {Number(hotel.comercio.totalReviews) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <strong>{Number(hotel.comercio.calificacion).toFixed(1)}</strong>
                    <span className="text-gray-400">({hotel.comercio.totalReviews} reseñas)</span>
                  </span>
                )}
              </div>
              {hotel.comercio.descripcion && (
                <p className="text-gray-600 leading-relaxed mt-4 text-base max-w-2xl">{hotel.comercio.descripcion}</p>
              )}
            </div>

            {/* HORARIOS */}
            <div className="py-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Horarios de llegada y salida</h2>
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-xl">🌅</div>
                  <div>
                    <p className="text-[10px] font-bold text-[#1B4332] uppercase tracking-wider">Check-in</p>
                    <p className="text-xl font-black text-gray-900">{hotel.checkInHora}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-xl">🌇</div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Check-out</p>
                    <p className="text-xl font-black text-gray-900">{hotel.checkOutHora}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* SERVICIOS */}
            {hotel.servicios.length > 0 && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Lo que incluye este alojamiento</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {hotel.servicios.map(s => {
                    const info = SERVICIOS_ICONS[s]
                    return (
                      <div key={s} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors bg-white">
                        <span className="text-xl w-8 text-center flex-shrink-0">{info?.icon ?? '✓'}</span>
                        <span className="text-sm font-medium text-gray-700">{info?.label ?? s}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* HABITACIONES */}
            <div data-rooms className="py-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Habitaciones disponibles
              </h2>
              <p className="text-sm text-gray-400 mb-5">{hotel.habitaciones.length} tipo{hotel.habitaciones.length !== 1 ? 's' : ''} de habitación</p>
              {hotel.habitaciones.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-10 text-center text-gray-400">
                  <p className="text-5xl mb-3">🛏️</p>
                  <p>Sin habitaciones publicadas</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {hotel.habitaciones.map(hab => (
                    <TarjetaHabitacion key={hab.id} hab={hab}
                      onReservar={seleccionarHabYScroll}
                      onVerFotos={(f, i) => setLightbox({ fotos: f, idx: i })}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* POLÍTICA */}
            {hotel.politicaCancelacion && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Política de cancelación</h2>
                <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-sm text-amber-800 leading-relaxed">{hotel.politicaCancelacion}</p>
                </div>
              </div>
            )}

            {/* MAPA */}
            {hotel.comercio.latitud && hotel.comercio.longitud && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Ubicación</h2>
                <div className="rounded-2xl overflow-hidden">
                  <MapaHoteles hoteles={[hotel]} userLat={null} userLon={null} />
                </div>
              </div>
            )}

            {/* RESEÑAS */}
            <div className="py-6">
              <SeccionReviewsHotel configHotelId={hotel.id} reservaElegibleId={reservaElegibleId} />
            </div>

            {/* HOTELES SIMILARES */}
            {similares.length > 0 && (
              <div className="py-6 border-t border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-5">
                  Más alojamientos en {hotel.comercio.municipio}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {similares.map(h => {
                    const desde = h.habitaciones.length > 0
                      ? Math.min(...h.habitaciones.map(hab => Number(hab.precioPorNoche)))
                      : null
                    const foto = h.habitaciones[0]?.fotos[0]
                    return (
                      <Link key={h.id} href={`/hoteles/${h.id}`}
                        className="block rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-all">
                        <div className="h-36 bg-gradient-to-br from-[#1B4332] to-[#40916C] relative">
                          {foto
                            ? <img src={foto} alt={h.comercio.nombre} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🏨</div>}
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-sm text-gray-900 truncate">{h.comercio.nombre}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{h.comercio.municipio}</p>
                          {desde && <p className="text-sm font-black text-[#1B4332] mt-2">{formatearPrecio(desde)}<span className="text-xs font-normal text-gray-400">/noche</span></p>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* WHATSAPP mobile */}
            {hotel.comercio.whatsapp && (
              <div className="lg:hidden pb-28">
                <a href={waUrl(hotel.comercio.whatsapp)} target="_blank" rel="noopener"
                  className="flex items-center gap-3 justify-center w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Hablar con el hotel por WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Widget lateral SOLO desktop */}
          {hotel.habitaciones.length > 0 && (
            <div className="hidden lg:block w-[360px] flex-shrink-0" data-widget>
              <WidgetReserva hotel={hotel} habitaciones={hotel.habitaciones}
                habIdx={widgetHabIdx} fechaEntrada={fechaEntrada} fechaSalida={fechaSalida}
                onFechaEntrada={setFechaEntrada} onFechaSalida={setFechaSalida} onHabIdx={setWidgetHabIdx}
                onReservar={abrirReserva} autenticado={autenticado} router={router} />
            </div>
          )}
        </div>
      </div>

      {/* BARRA FLOTANTE MOBILE */}
      {precioDesde && (
        <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200 px-5 py-3.5 flex items-center gap-4 shadow-2xl">
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-gray-900">{formatearPrecio(precioDesde)}</span>
              <span className="text-gray-400 text-sm">/ noche</span>
            </div>
            {Number(hotel.comercio.totalReviews) > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                ★ {Number(hotel.comercio.calificacion).toFixed(1)} · {hotel.comercio.totalReviews} reseñas
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (!autenticado) { router.push('/ingresar'); return }
              if (hotel.habitaciones.length === 1) { setHabSelec(hotel.habitaciones[0]); return }
              document.querySelector('[data-rooms]')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="bg-[#1B4332] text-white font-bold px-7 py-3.5 rounded-xl text-sm hover:bg-[#15362A] transition-colors active:scale-[0.97] shadow-md">
            Reservar
          </button>
        </div>
      )}

      {/* MODAL */}
      {habSelec && !reservaOk && (
        <FormReserva hotel={hotel} habitacion={habSelec}
          fechaEntradaInicial={fechaEntrada} fechaSalidaInicial={fechaSalida}
          onClose={() => setHabSelec(null)}
          onSuccess={(r) => { setHabSelec(null); setReservaOk(r) }}
        />
      )}

      {/* CONFIRMACIÓN */}
      {reservaOk && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="font-black text-2xl text-gray-900 mb-1">¡Reserva enviada!</h3>
            <p className="text-sm text-gray-500 mb-5">
              {hotel.confirmacionAuto
                ? 'Tu reserva fue confirmada exitosamente. ¡Te esperamos!'
                : `El hotel revisará tu solicitud y te confirmará en máx. ${hotel.horasLimiteConfirm} horas.`}
            </p>

            {/* Código de reserva prominente */}
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tu código de reserva</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-black tracking-widest text-gray-900 bg-gray-100 px-5 py-3 rounded-xl border border-gray-200">
                  {reservaOk.codigo}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(reservaOk!.codigo).then(() => mostrarToast('¡Código copiado!')).catch(() => {})}
                  title="Copiar código"
                  className="w-11 h-11 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 font-medium">
                Guarda este código — lo necesitarás al hacer check-in
              </p>
            </div>

            {/* Resumen */}
            {reservaOk.habitacionTipo && (
              <p className="text-sm text-gray-500 mb-5">
                {reservaOk.habitacionTipo.nombre} ·{' '}
                {Math.ceil((new Date(reservaOk.fechaSalida).getTime() - new Date(reservaOk.fechaEntrada).getTime()) / 86400000)} noche{Math.ceil((new Date(reservaOk.fechaSalida).getTime() - new Date(reservaOk.fechaEntrada).getTime()) / 86400000) !== 1 ? 's' : ''} ·{' '}
                <span className="font-bold text-gray-900">{formatearPrecio(Number(reservaOk.total))}</span>
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setReservaOk(null)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Seguir viendo
              </button>
              <Link href="/hoteles/mis-reservas"
                className="flex-1 bg-[#1B4332] text-white rounded-xl py-3 text-sm font-bold text-center hover:bg-[#15362A] transition-colors">
                Ver mis reservas
              </Link>
            </div>
          </div>
        </div>
      )}

      <Toast {...toastProps} />
    </div>
  )
}
