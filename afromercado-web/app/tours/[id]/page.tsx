'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { obtenerTour, verificarDisponibilidadTour, crearReservaTour, misReservasTour, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import SeccionReviewsTour from '@/components/tours/SeccionReviewsTour'
import { Toast, useToast } from '@/components/ui/Toast'

const SERVICIOS_LABELS: Record<string, { icon: string; label: string }> = {
  transporte:  { icon: '🚐', label: 'Transporte incluido' },
  almuerzo:    { icon: '🍱', label: 'Almuerzo incluido' },
  guia:        { icon: '🧭', label: 'Guía certificado' },
  equipo:      { icon: '🎒', label: 'Equipo incluido' },
  foto:        { icon: '📸', label: 'Fotografía' },
  seguro:      { icon: '🛡️', label: 'Seguro de viaje' },
  snacks:      { icon: '🍎', label: 'Snacks' },
  audio:       { icon: '🎧', label: 'Audioguía' },
}

/* ── Lightbox ──────────────────────────────────────────── */
function Lightbox({ fotos, inicial, onClose }: { fotos: string[]; inicial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(inicial)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + fotos.length) % fotos.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % fotos.length)
      if (e.key === 'Escape')     onClose()
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
        <img src={fotos[idx]} alt="" className="max-h-[75vh] max-w-full object-contain rounded-xl" />
        <button onClick={() => setIdx(i => (i + 1) % fotos.length)}
          className="absolute right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="flex gap-2 px-6 pb-6 pt-3 overflow-x-auto flex-shrink-0 justify-center" onClick={e => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
        {fotos.map((f, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 ${i === idx ? 'ring-2 ring-white opacity-100' : 'opacity-35 hover:opacity-60'}`}>
            <img src={f} alt="" className="w-full h-full object-cover" />
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
        <span className="text-8xl opacity-30">🗺️</span>
      </div>
    )
  }
  if (fotos.length === 1) {
    return (
      <div className="relative h-64 lg:h-[460px] cursor-pointer overflow-hidden rounded-2xl" onClick={() => onOpen(0)}>
        <img src={fotos[0]} alt={nombre} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
        <button className="absolute bottom-4 right-4 bg-white text-gray-800 font-semibold text-sm px-4 py-2 rounded-xl shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200">
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

/* ── Widget reserva lateral (desktop) ──────────────────── */
function WidgetReservaTour({ tour, onReservar, autenticado, router }: {
  tour: ConfigTour
  onReservar: () => void
  autenticado: boolean
  router: any
}) {
  const [fecha, setFecha]       = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0])
  const [participantes, setP]   = useState(1)
  const [disponibilidad, setD]  = useState<{ disponibles: number; maxParticipantes: number } | null>(null)

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTour(tour.id, fecha).then(setD).catch(() => setD(null))
  }, [fecha, tour.id])

  const total = Number(tour.precioPersona) * participantes

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sticky top-20">
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-3xl font-black text-gray-900">{formatearPrecio(Number(tour.precioPersona))}</span>
        <span className="text-gray-500 text-sm">/ persona</span>
      </div>

      <div className="mb-4">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Fecha del tour</label>
        <input type="date" min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
          value={fecha} onChange={e => setFecha(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1B4332] bg-white" />
      </div>

      {disponibilidad !== null && (
        <div className={`rounded-xl px-3 py-2 text-xs font-medium mb-4 ${disponibilidad.disponibles > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {disponibilidad.disponibles > 0
            ? `✓ ${disponibilidad.disponibles} cupo${disponibilidad.disponibles !== 1 ? 's' : ''} disponible${disponibilidad.disponibles !== 1 ? 's' : ''}`
            : '✗ Sin cupos para esta fecha'}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Participantes</label>
        <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-2.5">
          <button onClick={() => setP(p => Math.max(1, p - 1))}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors text-lg">−</button>
          <span className="flex-1 text-center font-bold text-base">{participantes}</span>
          <button onClick={() => setP(p => Math.min(tour.maxParticipantes, disponibilidad?.disponibles ?? tour.maxParticipantes, p + 1))}
            className="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center font-bold text-[#16A34A] hover:bg-[#D1FAE5] transition-colors text-lg">+</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Máx. {tour.maxParticipantes} personas</p>
      </div>

      <button
        onClick={() => { if (!autenticado) { router.push('/login'); return }; onReservar() }}
        className="w-full bg-[#1B4332] hover:bg-[#15362A] text-white font-bold py-4 rounded-xl text-base transition-all active:scale-[0.98] shadow-md mb-4">
        Reservar cupo
      </button>

      <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
        <div className="flex justify-between">
          <span className="underline decoration-dotted">{formatearPrecio(Number(tour.precioPersona))} × {participantes} pers.</span>
          <span>{formatearPrecio(total)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
          <span>Total</span>
          <span>{formatearPrecio(total)}</span>
        </div>
      </div>

      {tour.comercio.whatsapp && (
        <a href={`https://wa.me/57${tour.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el tour "${tour.nombre}". ¿Tienen disponibilidad?`)}`}
          target="_blank" rel="noopener"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[#128C7E] font-semibold text-sm border border-[#25D366]/40 hover:bg-[#F0FDF4] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Consultar por WhatsApp
        </a>
      )}

      <p className="text-xs text-center text-gray-400 mt-3">Sin cobros ocultos · Pago en el lugar</p>
    </div>
  )
}

/* ── Form reserva modal ─────────────────────────────────── */
function FormReservaTour({ tour, onClose, onSuccess }: { tour: ConfigTour; onClose: () => void; onSuccess: () => void }) {
  const { usuario } = useAuth()
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fecha, setFecha]           = useState(manana)
  const [participantes, setP]       = useState(1)
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [notas, setNotas]           = useState('')
  const [nombre, setNombre]         = useState(usuario?.nombre ?? '')
  const [telefono, setTelefono]     = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setD]      = useState<{ disponibles: number; maxParticipantes: number } | null>(null)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState('')

  const total = Number(tour.precioPersona) * participantes

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTour(tour.id, fecha).then(setD).catch(() => setD(null))
  }, [fecha, tour.id])

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    setError(''); setCargando(true)
    try {
      await crearReservaTour({ configTourId: tour.id, fechaTour: fecha, participantes, metodoPago, notasCliente: notas || undefined, nombreContacto: nombre.trim(), telefonoContacto: telefono.trim() })
      onSuccess()
    } catch (e: any) { setError(e.message) } finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg max-h-[93vh] overflow-y-auto rounded-t-3xl lg:rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center py-3 lg:hidden"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xl text-gray-900">{tour.nombre}</h3>
            <p className="text-sm text-[#1B4332] font-semibold mt-0.5">{formatearPrecio(Number(tour.precioPersona))}<span className="text-gray-400 font-normal"> / persona</span></p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-xl leading-none font-bold">×</button>
        </div>

        <div className="px-6 pt-5 pb-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Fecha del tour</label>
            <input type="date" min={manana} value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10" />
          </div>

          {disponibilidad !== null && (
            <div className={`rounded-xl p-4 flex items-center justify-between border ${
              disponibilidad.disponibles > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-sm font-semibold ${disponibilidad.disponibles > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {disponibilidad.disponibles > 0
                  ? `✓ ${disponibilidad.disponibles} cupo${disponibilidad.disponibles !== 1 ? 's' : ''} disponible${disponibilidad.disponibles !== 1 ? 's' : ''}`
                  : '✗ Sin cupos para esta fecha'}
              </p>
              <p className="font-black text-2xl text-gray-900">{formatearPrecio(total)}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Participantes (máx. {tour.maxParticipantes})</label>
            <div className="flex items-center gap-4 border border-gray-200 rounded-xl px-4 py-3">
              <button onClick={() => setP(p => Math.max(1, p - 1))} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">−</button>
              <span className="flex-1 text-center font-bold text-lg">{participantes}</span>
              <button onClick={() => setP(p => Math.min(tour.maxParticipantes, disponibilidad?.disponibles ?? tour.maxParticipantes, p + 1))} className="w-9 h-9 rounded-full bg-[#ECFDF5] flex items-center justify-center font-bold text-[#16A34A] hover:bg-[#D1FAE5] transition-colors">+</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Nombre de contacto', value: nombre, set: setNombre, type: 'text', ph: 'Nombre completo' },
              { label: 'Teléfono', value: telefono, set: setTelefono, type: 'tel', ph: '3001234567' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Método de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] bg-white">
              <option value="EFECTIVO">💵  Efectivo al llegar</option>
              <option value="NEQUI">📱  Nequi</option>
              <option value="TRANSFERENCIA">🏦  Transferencia bancaria</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notas especiales (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Alergias, necesidades especiales, requisitos…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] resize-none" />
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

          <button onClick={handleReservar}
            disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles < participantes)}
            className="w-full bg-[#1B4332] text-white font-bold py-4 rounded-xl text-base hover:bg-[#15362A] transition-colors disabled:opacity-50 active:scale-[0.98] shadow-md">
            {cargando ? 'Procesando…' : tour.confirmacionAuto ? 'Confirmar reserva' : 'Solicitar reserva'}
          </button>

          {!tour.confirmacionAuto && (
            <p className="text-xs text-center text-gray-400">El operador confirmará en máx. {tour.horasLimiteConfirm} horas</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── PÁGINA PRINCIPAL ───────────────────────────────────── */
export default function TourDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { autenticado, usuario } = useAuth()

  const [tour, setTour]               = useState<ConfigTour | null>(null)
  const [cargando, setCargando]       = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [reservado, setReservado]     = useState(false)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const [lightbox, setLightbox]       = useState<{ fotos: string[]; idx: number } | null>(null)
  const { mostrar: mostrarToast, toastProps } = useToast()

  useEffect(() => {
    obtenerTour(Number(id)).then(d => { setTour(d); setCargando(false) }).catch(() => setCargando(false))
  }, [id])

  useEffect(() => {
    if (!usuario || !tour) return
    misReservasTour().then(rs => {
      const elegible = rs.find(r => r.configTourId === tour.id && r.estado === 'COMPLETADA' && !r.review)
      setReservaElegibleId(elegible?.id)
    }).catch(() => {})
  }, [usuario, tour])

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#1B4332] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    </div>
  )

  if (!tour) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400 bg-white">
      <span className="text-6xl">🗺️</span>
      <p className="font-medium">Tour no encontrado</p>
      <Link href="/tours" className="text-[#1B4332] text-sm underline">Volver al listado</Link>
    </div>
  )

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: tour!.nombre, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
  }

  return (
    <div className="min-h-screen bg-white">
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* NAV */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/tours" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Tours
          </Link>
          <div className="flex items-center gap-3">
            {autenticado && (
              <Link href="/tours/mis-reservas" className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors">Mis reservas</Link>
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
        <GaleriaHero fotos={tour.fotos} nombre={tour.nombre} onOpen={i => setLightbox({ fotos: tour.fotos, idx: i })} />

        {/* LAYOUT 2 COL */}
        <div className="flex gap-12 mt-8">
          {/* Columna principal */}
          <div className="flex-1 min-w-0">

            {/* Título */}
            <div className="pb-6 border-b border-gray-100">
              <h1 className="text-3xl lg:text-4xl font-black text-gray-900 mb-3">{tour.nombre}</h1>
              <div className="flex items-center gap-5 flex-wrap text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  {tour.comercio.municipio}{tour.comercio.departamento ? `, ${tour.comercio.departamento}` : ''}
                </span>
                {Number(tour.comercio.totalReviews) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <strong>{Number(tour.comercio.calificacion).toFixed(1)}</strong>
                    <span className="text-gray-400">({tour.comercio.totalReviews} reseñas)</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {tour.duracionHoras}h de duración
                </span>
              </div>
              {tour.comercio.descripcion && (
                <p className="text-gray-600 leading-relaxed mt-4 text-base max-w-2xl">{tour.comercio.descripcion}</p>
              )}
            </div>

            {/* DATOS CLAVE */}
            <div className="py-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Detalles del tour</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { emoji: '⏱️', label: 'Duración', val: `${tour.duracionHoras} horas` },
                  { emoji: '👥', label: 'Capacidad máx.', val: `${tour.maxParticipantes} personas` },
                  { emoji: '🗣️', label: 'Idiomas', val: tour.idiomas.length > 0 ? tour.idiomas.join(', ') : 'Español' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-xl flex-shrink-0">{item.emoji}</div>
                    <div>
                      <p className="text-[10px] font-bold text-[#1B4332] uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DESCRIPCIÓN */}
            {tour.descripcion && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Descripción</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{tour.descripcion}</p>
              </div>
            )}

            {/* INCLUYE */}
            {tour.servicios.length > 0 && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Lo que incluye este tour</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {tour.servicios.map(s => {
                    const info = SERVICIOS_LABELS[s]
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

            {/* PUNTO DE ENCUENTRO */}
            {tour.puntoEncuentro && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Punto de encuentro</h2>
                <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444" stroke="none" className="mt-0.5 flex-shrink-0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  <p className="text-gray-700 font-medium">{tour.puntoEncuentro}</p>
                </div>
              </div>
            )}

            {/* POLÍTICA */}
            {tour.politicaCancelacion && (
              <div className="py-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Política de cancelación</h2>
                <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-sm text-amber-800 leading-relaxed">{tour.politicaCancelacion}</p>
                </div>
              </div>
            )}

            {/* RESEÑAS */}
            <div className="py-6">
              <SeccionReviewsTour configTourId={tour.id} reservaElegibleId={reservaElegibleId} />
            </div>

            {/* WhatsApp mobile */}
            {tour.comercio.whatsapp && (
              <div className="lg:hidden pb-28">
                <a href={`https://wa.me/57${tour.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el tour "${tour.nombre}". ¿Tienen disponibilidad?`)}`}
                  target="_blank" rel="noopener"
                  className="flex items-center gap-3 justify-center w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Hablar con el operador por WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Widget lateral SOLO desktop */}
          <div className="hidden lg:block w-[360px] flex-shrink-0">
            <WidgetReservaTour tour={tour} onReservar={() => setMostrarForm(true)} autenticado={autenticado} router={router} />
          </div>
        </div>
      </div>

      {/* BARRA FLOTANTE MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200 px-5 py-3.5 flex items-center gap-4 shadow-2xl">
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-gray-900">{formatearPrecio(Number(tour.precioPersona))}</span>
            <span className="text-gray-400 text-sm">/ persona</span>
          </div>
          {Number(tour.comercio.totalReviews) > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              ★ {Number(tour.comercio.calificacion).toFixed(1)} · {tour.comercio.totalReviews} reseñas
            </p>
          )}
        </div>
        {reservado ? (
          <Link href="/tours/mis-reservas" className="bg-[#1B4332] text-white font-bold px-5 py-3.5 rounded-xl text-sm">
            Ver reserva
          </Link>
        ) : (
          <button
            onClick={() => { if (!autenticado) { router.push('/login'); return }; setMostrarForm(true) }}
            className="bg-[#1B4332] text-white font-bold px-7 py-3.5 rounded-xl text-sm hover:bg-[#15362A] transition-colors active:scale-[0.97] shadow-md">
            Reservar cupo
          </button>
        )}
      </div>

      {/* MODAL */}
      {mostrarForm && !reservado && (
        <FormReservaTour tour={tour} onClose={() => setMostrarForm(false)} onSuccess={() => { setMostrarForm(false); setReservado(true) }} />
      )}

      {/* CONFIRMACIÓN */}
      {reservado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="font-black text-2xl text-gray-900 mb-2">¡Reserva enviada!</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              {tour.confirmacionAuto
                ? 'Tu reserva fue confirmada exitosamente. ¡Disfruta el tour!'
                : `El operador revisará tu solicitud y te confirmará en máx. ${tour.horasLimiteConfirm} horas.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReservado(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Seguir viendo
              </button>
              <Link href="/tours/mis-reservas"
                className="flex-1 bg-[#1B4332] text-white rounded-xl py-3 text-sm font-bold text-center hover:bg-[#15362A] transition-colors">
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
