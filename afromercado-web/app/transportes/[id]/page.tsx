'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { obtenerTransporte, verificarDisponibilidadTransporte, crearReservaTransporte, misReservasTransporte, toggleFavoritoTransporte, type ConfigTransporte, type RutaTransporte } from '@/lib/api/transporte'
import { reviewsTransporte, crearReviewTransporte, type ReviewTransporte } from '@/lib/api/review'
import SeccionReviews, { type ReviewItem } from '@/components/ui/SeccionReviews'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import { Toast, useToast } from '@/components/ui/Toast'

const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju',
  viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
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
function GaleriaHero({ fotos, nombre, tipo, videoUrl, onOpen }: { fotos: string[]; nombre: string; tipo: string; videoUrl?: string | null; onOpen: (i: number) => void }) {
  if (fotos.length === 0) {
    return (
      <div className="h-64 lg:h-[460px] bg-gradient-to-br from-[#1B4332] to-[#40916C] flex items-center justify-center rounded-2xl">
        <span className="text-8xl opacity-30">{TIPO_ICONO[tipo] ?? '🛥️'}</span>
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
      {videoUrl && (
        <button onClick={() => document.getElementById('seccion-video')?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm text-white font-semibold text-sm px-3 py-2 rounded-xl shadow-lg hover:bg-black/85 transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Ver video
        </button>
      )}
    </div>
  )
}

/* ── Tarjeta de ruta ─────────────────────────────────────── */
function TarjetaRuta({ ruta, onReservar }: { ruta: RutaTransporte; onReservar: (r: RutaTransporte) => void }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {/* Origen → Destino */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-gray-900 text-lg truncate">{ruta.origen}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <span className="font-bold text-gray-900 text-lg truncate">{ruta.destino}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {ruta.horario}
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Cap. {ruta.capacidad} asientos
            </span>
          </div>
          {ruta.diasSemana.length > 0 && (
            <div className="flex gap-1 mt-2.5">
              {ruta.diasSemana.map(d => (
                <span key={d} className="text-[10px] bg-[#F0FDF4] text-[#1B4332] border border-[#BBF7D0] px-2 py-0.5 rounded-full font-medium">
                  {DIAS_LABEL[d] ?? d}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-black text-[#1B4332]">{formatearPrecio(Number(ruta.precioAsiento))}</div>
          <div className="text-xs text-gray-400 mt-0.5">por asiento</div>
        </div>
      </div>

      <button onClick={() => onReservar(ruta)}
        className="w-full bg-[#1B4332] hover:bg-[#15362A] text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] shadow-sm">
        Reservar asientos
      </button>
    </div>
  )
}

/* ── Widget lateral (desktop) ──────────────────────────── */
function WidgetReservaTransporte({ transporte, rutas, onReservar, autenticado, router }: {
  transporte: ConfigTransporte
  rutas: RutaTransporte[]
  onReservar: (r: RutaTransporte) => void
  autenticado: boolean
  router: any
}) {
  const [rutaIdx, setRutaIdx] = useState(0)
  const ruta = rutas[rutaIdx]

  if (rutas.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sticky top-20 text-center text-gray-400">
      <p className="text-4xl mb-3">🛥️</p>
      <p className="text-sm">Sin rutas activas</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sticky top-20">
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-3xl font-black text-gray-900">{formatearPrecio(Number(ruta.precioAsiento))}</span>
        <span className="text-gray-500 text-sm">/ asiento</span>
      </div>

      {rutas.length > 1 && (
        <div className="mb-4">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Ruta</label>
          <select value={rutaIdx} onChange={e => setRutaIdx(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1B4332] bg-white">
            {rutas.map((r, i) => (
              <option key={r.id} value={i}>{r.origen} → {r.destino} · {r.horario}</option>
            ))}
          </select>
        </div>
      )}

      {/* Info ruta seleccionada */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Horario</span>
          <span className="font-semibold">{ruta.horario}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Capacidad</span>
          <span className="font-semibold">{ruta.capacidad} asientos</span>
        </div>
        {ruta.diasSemana.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Días</span>
            <div className="flex gap-1">
              {ruta.diasSemana.map(d => (
                <span key={d} className="text-[10px] bg-[#F0FDF4] text-[#1B4332] border border-[#BBF7D0] px-1.5 py-0.5 rounded font-medium">
                  {DIAS_LABEL[d] ?? d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => { if (!autenticado) { router.push('/ingresar'); return }; onReservar(ruta) }}
        className="w-full bg-[#1B4332] hover:bg-[#15362A] text-white font-bold py-4 rounded-xl text-base transition-all active:scale-[0.98] shadow-md mb-4">
        Reservar ahora
      </button>

      {transporte.comercio.whatsapp && (
        <a href={`https://wa.me/57${transporte.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el servicio "${transporte.nombre}". ¿Tienen disponibilidad?`)}`}
          target="_blank" rel="noopener"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[#128C7E] font-semibold text-sm border border-[#25D366]/40 hover:bg-[#F0FDF4] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Consultar por WhatsApp
        </a>
      )}

      <p className="text-xs text-center text-gray-400 mt-3">Sin cobros ocultos · Pago al abordar</p>
    </div>
  )
}

/* ── Form reserva modal ─────────────────────────────────── */
function FormReservaTransporte({ transporte, ruta, onClose, onSuccess }: {
  transporte: ConfigTransporte; ruta: RutaTransporte; onClose: () => void; onSuccess: () => void
}) {
  const { usuario } = useAuth()
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fecha, setFecha]           = useState(manana)
  const [asientos, setAsientos]     = useState(1)
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [notas, setNotas]           = useState('')
  const [nombre, setNombre]         = useState(usuario?.nombre ?? '')
  const [telefono, setTelefono]     = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setD]      = useState<{ disponibles: number; capacidad: number } | null>(null)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState('')

  const total = Number(ruta.precioAsiento) * asientos

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTransporte(ruta.id, fecha).then(setD).catch(() => setD(null))
  }, [fecha, ruta.id])

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    setError(''); setCargando(true)
    try {
      await crearReservaTransporte({ rutaTransporteId: ruta.id, fechaViaje: fecha, asientos, metodoPago, notasCliente: notas || undefined, nombreContacto: nombre.trim(), telefonoContacto: telefono.trim() })
      onSuccess()
    } catch (e: any) { setError(e.message) } finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg max-h-[93vh] overflow-y-auto rounded-t-3xl lg:rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center py-3 lg:hidden"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xl text-gray-900">{ruta.origen} → {ruta.destino}</h3>
            <p className="text-sm text-[#1B4332] font-semibold mt-0.5">{ruta.horario} · {formatearPrecio(Number(ruta.precioAsiento))}<span className="text-gray-400 font-normal"> / asiento</span></p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-xl leading-none font-bold">×</button>
        </div>

        <div className="px-6 pt-5 pb-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Fecha del viaje</label>
            <input type="date" min={manana} value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10" />
          </div>

          {disponibilidad !== null && (
            <div className={`rounded-xl p-4 flex items-center justify-between border ${
              disponibilidad.disponibles > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-sm font-semibold ${disponibilidad.disponibles > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {disponibilidad.disponibles > 0
                  ? `✓ ${disponibilidad.disponibles} asiento${disponibilidad.disponibles !== 1 ? 's' : ''} disponible${disponibilidad.disponibles !== 1 ? 's' : ''}`
                  : '✗ Sin asientos disponibles'}
              </p>
              <p className="font-black text-2xl text-gray-900">{formatearPrecio(total)}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Asientos (máx. {ruta.capacidad})</label>
            <div className="flex items-center gap-4 border border-gray-200 rounded-xl px-4 py-3">
              <button onClick={() => setAsientos(a => Math.max(1, a - 1))} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">−</button>
              <span className="flex-1 text-center font-bold text-lg">{asientos}</span>
              <button onClick={() => setAsientos(a => Math.min(ruta.capacidad, disponibilidad?.disponibles ?? ruta.capacidad, a + 1))} className="w-9 h-9 rounded-full bg-[#ECFDF5] flex items-center justify-center font-bold text-[#16A34A] hover:bg-[#D1FAE5] transition-colors">+</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nombre</label>
              <input type="text" autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Teléfono</label>
              <input type="tel" autoComplete="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="3001234567"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Método de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] bg-white">
              <option value="EFECTIVO">💵  Efectivo al abordar</option>
              <option value="NEQUI">📱  Nequi</option>
              <option value="TRANSFERENCIA">🏦  Transferencia bancaria</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Equipaje especial, necesidades…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] resize-none" />
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

          <button onClick={handleReservar}
            disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles < asientos)}
            className="w-full bg-[#1B4332] text-white font-bold py-4 rounded-xl text-base hover:bg-[#15362A] transition-colors disabled:opacity-50 active:scale-[0.98] shadow-md">
            {cargando ? 'Procesando…' : 'Reservar asientos'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── PÁGINA PRINCIPAL ───────────────────────────────────── */
export default function TransporteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { autenticado, usuario } = useAuth()

  const [transporte, setTransporte]       = useState<ConfigTransporte | null>(null)
  const [cargando, setCargando]           = useState(true)
  const [esFavorito, setEsFavorito]       = useState(false)
  const [togglingFav, setTogglingFav]     = useState(false)
  const [rutaSeleccionada, setRutaSel]    = useState<RutaTransporte | null>(null)
  const [reservado, setReservado]         = useState(false)
  const [lightbox, setLightbox]           = useState<{ fotos: string[]; idx: number } | null>(null)
  const [reviews, setReviews]             = useState<ReviewTransporte[]>([])
  const [cargandoReviews, setCargandoRev] = useState(true)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const { mostrar: mostrarToast, toastProps } = useToast()

  useEffect(() => {
    obtenerTransporte(Number(id)).then(d => { setTransporte(d); setCargando(false) }).catch(() => setCargando(false))
    reviewsTransporte(Number(id)).then(r => { setReviews(r); setCargandoRev(false) }).catch(() => setCargandoRev(false))
  }, [id])

  useEffect(() => {
    if (!usuario) return
    misReservasTransporte().then(rs => {
      // Buscar reserva COMPLETADA de este transporte que no tenga review aún
      const comp = rs.find((r: any) =>
        r.estado === 'COMPLETADA' &&
        !r.review &&
        (r.ruta?.configTransporteId === Number(id) || r.ruta?.configTransporte?.id === Number(id))
      )
      setReservaElegibleId(comp?.id)
    }).catch(() => {})
  }, [usuario, id])

  useEffect(() => {
    if (transporte?.nombre) {
      document.title = `${transporte.nombre} — Transporte AfroMercado`
    }
    return () => { document.title = 'AfroMercado' }
  }, [transporte?.nombre])

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#1B4332] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    </div>
  )

  if (!transporte) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400 bg-white">
      <span className="text-6xl">🛥️</span>
      <p className="font-medium">Transporte no encontrado</p>
      <Link href="/transportes" className="text-[#1B4332] text-sm underline">Volver al listado</Link>
    </div>
  )

  const rutas = transporte.rutas.filter(r => r.activo)
  const precioDesde = rutas.length > 0 ? Math.min(...rutas.map(r => Number(r.precioAsiento))) : null

  async function toggleFav() {
    if (!autenticado) { router.push('/ingresar'); return }
    setTogglingFav(true)
    try {
      const r = await toggleFavoritoTransporte(transporte!.id)
      setEsFavorito(r.favorito)
    } finally {
      setTogglingFav(false)
    }
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: transporte!.nombre, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
  }

  return (
    <div className="min-h-screen bg-white">
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* NAV */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/transportes" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Transportes
          </Link>
          <div className="flex items-center gap-3">
            {autenticado && (
              <Link href="/transportes/mis-reservas" className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors">Mis reservas</Link>
            )}
            <button
              onClick={toggleFav}
              disabled={togglingFav}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5 hover:border-gray-300 transition-all disabled:opacity-50"
              title={esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}>
              {esFavorito ? '❤️' : '🤍'}
            </button>
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
        <GaleriaHero fotos={transporte.fotos} nombre={transporte.nombre} tipo={transporte.tipo}
          videoUrl={transporte.videoUrl} onOpen={i => setLightbox({ fotos: transporte.fotos, idx: i })} />

        {/* VIDEO */}
        {transporte.videoUrl && (
          <section id="seccion-video" className="mt-4 pb-4">
            <ReproductorVideo url={transporte.videoUrl} />
          </section>
        )}

        {/* LAYOUT 2 COL */}
        <div className="flex gap-12 mt-8">
          {/* Columna principal */}
          <div className="flex-1 min-w-0">

            {/* Título */}
            <div className="pb-6 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{TIPO_ICONO[transporte.tipo] ?? '🛥️'}</span>
                <h1 className="text-3xl lg:text-4xl font-black text-gray-900">{transporte.nombre}</h1>
              </div>
              <div className="flex items-center gap-5 flex-wrap text-sm text-gray-600">
                <span className="bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  {transporte.tipo}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  {transporte.comercio.municipio}{transporte.comercio.departamento ? `, ${transporte.comercio.departamento}` : ''}
                </span>
                {Number(transporte.comercio.totalReviews) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <strong>{Number(transporte.comercio.calificacion).toFixed(1)}</strong>
                    <span className="text-gray-400">({transporte.comercio.totalReviews} reseñas)</span>
                  </span>
                )}
              </div>
              {transporte.descripcion && (
                <p className="text-gray-600 leading-relaxed mt-4 text-base max-w-2xl">{transporte.descripcion}</p>
              )}
            </div>

            {/* OPERADOR */}
            <div className="py-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Operador</h2>
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
                {transporte.comercio.logoUrl ? (
                  <img src={transporte.comercio.logoUrl} alt={transporte.comercio.nombre}
                    className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#1B4332] flex items-center justify-center flex-shrink-0 text-white text-xl font-black">
                    {transporte.comercio.nombre[0]}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{transporte.comercio.nombre}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{transporte.comercio.municipio}{transporte.comercio.departamento ? `, ${transporte.comercio.departamento}` : ''}</p>
                </div>
              </div>
            </div>

            {/* RUTAS */}
            <div className="py-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Rutas disponibles</h2>
              <p className="text-sm text-gray-400 mb-5">{rutas.length} ruta{rutas.length !== 1 ? 's' : ''} activa{rutas.length !== 1 ? 's' : ''}</p>
              {rutas.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-10 text-center text-gray-400">
                  <p className="text-5xl mb-3">🛥️</p>
                  <p>Sin rutas activas por ahora</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rutas.map(ruta => (
                    <TarjetaRuta key={ruta.id} ruta={ruta}
                      onReservar={r => { if (!autenticado) { router.push('/ingresar'); return }; setRutaSel(r) }} />
                  ))}
                </div>
              )}
            </div>

            {/* RESEÑAS */}
            <div className="py-6">
              <SeccionReviews
                reviews={reviews.map(r => ({ ...r, clienteId: r.clienteId }))}
                cargando={cargandoReviews}
                elegibleId={reservaElegibleId}
                placeholder="¿Cómo fue el viaje?"
                onCrear={async (elegibleId, cal, com) => {
                  const nueva = await crearReviewTransporte(elegibleId, cal, com)
                  return nueva as ReviewItem
                }}
                onNueva={r => setReviews(prev => [r as ReviewTransporte, ...prev])}
              />
            </div>

            {/* WhatsApp mobile */}
            {transporte.comercio.whatsapp && (
              <div className="lg:hidden pb-28 pt-6">
                <a href={`https://wa.me/57${transporte.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el servicio "${transporte.nombre}". ¿Tienen disponibilidad?`)}`}
                  target="_blank" rel="noopener"
                  className="flex items-center gap-3 justify-center w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Consultar por WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Widget lateral SOLO desktop */}
          <div className="hidden lg:block w-[360px] flex-shrink-0">
            <WidgetReservaTransporte
              transporte={transporte}
              rutas={rutas}
              onReservar={r => setRutaSel(r)}
              autenticado={autenticado}
              router={router}
            />
          </div>
        </div>
      </div>

      {/* BARRA FLOTANTE MOBILE */}
      {precioDesde !== null && (
        <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200 px-5 py-3.5 flex items-center gap-4 shadow-2xl">
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-gray-400 mr-0.5">desde</span>
              <span className="text-2xl font-black text-gray-900">{formatearPrecio(precioDesde)}</span>
              <span className="text-gray-400 text-sm">/ asiento</span>
            </div>
            {Number(transporte.comercio.totalReviews) > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                ★ {Number(transporte.comercio.calificacion).toFixed(1)} · {transporte.comercio.totalReviews} reseñas
              </p>
            )}
          </div>
          {reservado ? (
            <Link href="/transportes/mis-reservas" className="bg-[#1B4332] text-white font-bold px-5 py-3.5 rounded-xl text-sm">
              Ver reserva
            </Link>
          ) : (
            <button
              onClick={() => {
                if (!autenticado) { router.push('/ingresar'); return }
                if (rutas.length === 1) { setRutaSel(rutas[0]); return }
                document.querySelector('[data-rutas]')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="bg-[#1B4332] text-white font-bold px-7 py-3.5 rounded-xl text-sm hover:bg-[#15362A] transition-colors active:scale-[0.97] shadow-md">
              Reservar
            </button>
          )}
        </div>
      )}

      {/* MODAL */}
      {rutaSeleccionada && !reservado && (
        <FormReservaTransporte
          transporte={transporte}
          ruta={rutaSeleccionada}
          onClose={() => setRutaSel(null)}
          onSuccess={() => { setRutaSel(null); setReservado(true) }}
        />
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
              Tu reserva fue recibida correctamente. El operador te contactará para confirmar.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`¡Acabo de reservar en AfroMercado! 🎉\n${transporte.nombre}\nhttps://afromercado.co`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl font-semibold text-sm hover:bg-[#20b858] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Compartir por WhatsApp
              </a>
              <div className="flex gap-3">
                <button onClick={() => setReservado(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Seguir viendo
                </button>
                <Link href="/transportes/mis-reservas"
                  className="flex-1 bg-[#1B4332] text-white rounded-xl py-3 text-sm font-bold text-center hover:bg-[#15362A] transition-colors">
                  Ver reserva
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast {...toastProps} />
    </div>
  )
}
