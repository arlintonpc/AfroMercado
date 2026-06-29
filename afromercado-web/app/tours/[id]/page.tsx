'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { obtenerTour, verificarDisponibilidadTour, crearReservaTour, misReservasTour, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import SeccionReviewsTour from '@/components/tours/SeccionReviewsTour'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Toast, useToast } from '@/components/ui/Toast'

const SERVICIOS_LABELS: Record<string, string> = {
  transporte: '🚐 Transporte incluido', almuerzo: '🍱 Almuerzo incluido',
  guia: '🧭 Guía certificado', equipo: '🎒 Equipo incluido',
  foto: '📸 Fotografía', seguro: '🛡️ Seguro de viaje',
  snacks: '🍎 Snacks', audio: '🎧 Audioguía',
}

function FormReservaTour({ tour, onClose, onSuccess }: { tour: ConfigTour; onClose: () => void; onSuccess: () => void }) {
  const { usuario } = useAuth()
  const hoy = new Date().toISOString().split('T')[0]
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fecha, setFecha] = useState(manana)
  const [participantes, setParticipantes] = useState(1)
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [notas, setNotas] = useState('')
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [telefono, setTelefono] = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setDisponibilidad] = useState<{ disponibles: number; maxParticipantes: number } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const total = Number(tour.precioPersona) * participantes

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTour(tour.id, fecha).then(setDisponibilidad).catch(() => setDisponibilidad(null))
  }, [fecha, tour.id])

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    setError(''); setCargando(true)
    try {
      await crearReservaTour({ configTourId: tour.id, fechaTour: fecha, participantes, metodoPago, notasCliente: notas || undefined, nombreContacto: nombre.trim(), telefonoContacto: telefono.trim() })
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1A1A1A]">Reservar: {tour.nombre}</h3>
            <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha del tour</label>
              <input type="date" min={manana} value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>

            {disponibilidad !== null && (
              <div className={`rounded-xl p-3 text-sm ${disponibilidad.disponibles > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {disponibilidad.disponibles > 0
                  ? <span className="text-green-700">✓ {disponibilidad.disponibles} cupo{disponibilidad.disponibles !== 1 ? 's' : ''} disponible{disponibilidad.disponibles !== 1 ? 's' : ''}</span>
                  : <span className="text-red-600">✗ Sin cupos para esta fecha</span>}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Participantes (máx. {tour.maxParticipantes})</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setParticipantes(p => Math.max(1, p - 1))}
                  className="w-9 h-9 rounded-xl border border-gray-200 text-lg font-bold flex items-center justify-center hover:bg-gray-50">−</button>
                <span className="text-lg font-bold text-[#1A1A1A] w-8 text-center">{participantes}</span>
                <button onClick={() => setParticipantes(p => Math.min(tour.maxParticipantes, disponibilidad?.disponibles ?? tour.maxParticipantes, p + 1))}
                  className="w-9 h-9 rounded-xl border border-gray-200 text-lg font-bold flex items-center justify-center hover:bg-gray-50">+</button>
              </div>
            </div>

            <div className="bg-[#2D6A4F]/5 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">{participantes} × {formatearPrecio(Number(tour.precioPersona))}</span>
              <span className="font-bold text-[#2D6A4F]">{formatearPrecio(total)}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de contacto</label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Requisitos especiales, alergias, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <button onClick={handleReservar}
              disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles < participantes)}
              className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] disabled:opacity-50">
              {cargando ? 'Procesando…' : tour.confirmacionAuto ? '✅ Confirmar reserva' : '📩 Solicitar reserva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TourDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const [tour, setTour] = useState<ConfigTour | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fotoActual, setFotoActual] = useState(0)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [reservado, setReservado] = useState(false)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
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
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!tour) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-gray-400">Tour no encontrado</div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Fotos */}
      <div className="relative h-64 bg-gradient-to-br from-[#40916C] to-[#74C69D] flex items-center justify-center">
        {tour.fotos.length > 0 ? (
          <>
            <img src={tour.fotos[fotoActual]} alt={tour.nombre} className="w-full h-full object-cover" />
            {tour.fotos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {tour.fotos.map((_, i) => (
                  <button key={i} onClick={() => setFotoActual(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === fotoActual ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <span className="text-6xl">🗺️</span>
        )}
        <Link href="/tours" className="absolute top-4 left-4 bg-black/40 rounded-full p-2 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <button onClick={async () => {
          const url = window.location.href
          if (navigator.share) { try { await navigator.share({ title: tour.nombre, url }) } catch {} }
          else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
        }} className="absolute top-4 right-4 bg-black/40 rounded-full p-2 text-white hover:bg-black/60">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>

      <Breadcrumbs items={[
        { label: 'Inicio', href: '/' },
        { label: 'Tours', href: '/tours' },
        { label: tour.nombre },
      ]} />

      <div className="max-w-2xl mx-auto px-4 py-5 pb-28">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-bold text-[#1A1A1A]">{tour.nombre}</h1>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-[#2D6A4F]">{formatearPrecio(Number(tour.precioPersona))}</p>
            <p className="text-xs text-gray-400">por persona</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          🏢 {tour.comercio.nombre} · 📍 {tour.comercio.municipio}{tour.comercio.departamento ? `, ${tour.comercio.departamento}` : ''}
        </p>

        {/* Info rápida */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: '⏱️', label: 'Duración', val: `${tour.duracionHoras}h` },
            { icon: '👥', label: 'Máx.', val: `${tour.maxParticipantes} pers.` },
            { icon: '🗣️', label: 'Idiomas', val: tour.idiomas.length > 0 ? tour.idiomas.join(', ') : 'Español' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl mb-1">{item.icon}</p>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-xs font-semibold text-[#1A1A1A] mt-0.5">{item.val}</p>
            </div>
          ))}
        </div>

        {tour.descripcion && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <h2 className="font-semibold text-[#1A1A1A] mb-2">Descripción</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{tour.descripcion}</p>
          </div>
        )}

        {tour.servicios.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <h2 className="font-semibold text-[#1A1A1A] mb-3">Incluye</h2>
            <div className="grid grid-cols-2 gap-2">
              {tour.servicios.map(s => (
                <div key={s} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-base">{SERVICIOS_LABELS[s]?.split(' ')[0] ?? '✓'}</span>
                  <span>{SERVICIOS_LABELS[s]?.substring(2) ?? s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tour.puntoEncuentro && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <h2 className="font-semibold text-[#1A1A1A] mb-1">Punto de encuentro</h2>
            <p className="text-sm text-gray-600">📍 {tour.puntoEncuentro}</p>
          </div>
        )}

        <SeccionReviewsTour configTourId={tour.id} reservaElegibleId={reservaElegibleId} />

        {tour.politicaCancelacion && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 mb-4">
            <h2 className="font-semibold text-amber-800 mb-1">Política de cancelación</h2>
            <p className="text-sm text-amber-700 leading-relaxed">{tour.politicaCancelacion}</p>
          </div>
        )}

        {tour.comercio.whatsapp && (
          <a href={`https://wa.me/57${tour.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el tour "${tour.nombre}". ¿Tienen disponibilidad?`)}`}
            target="_blank" rel="noopener"
            className="flex items-center gap-2 justify-center w-full border border-green-300 text-green-700 font-medium py-3 rounded-2xl text-sm hover:bg-green-50 transition-colors mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.854L.057 23.428a.5.5 0 0 0 .617.601l5.7-1.498A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.956 0-3.789-.574-5.33-1.56l-.382-.232-3.384.889.903-3.295-.249-.399A9.935 9.935 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Consultar por WhatsApp
          </a>
        )}
      </div>

      {/* CTA fijo */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 p-4 max-w-2xl mx-auto">
        {reservado ? (
          <div className="text-center">
            <p className="text-green-700 font-bold text-sm">✅ Reserva enviada correctamente</p>
            <Link href="/tours/mis-reservas" className="text-xs text-[#2D6A4F] underline mt-1 block">Ver mis reservas</Link>
          </div>
        ) : (
          <button onClick={() => { if (!usuario) { window.location.href = '/ingresar'; return } setMostrarForm(true) }}
            className="w-full bg-[#2D6A4F] text-white font-bold py-3.5 rounded-2xl hover:bg-[#40916C] transition-colors">
            🗺️ Reservar este tour
          </button>
        )}
      </div>

      {mostrarForm && tour && (
        <FormReservaTour tour={tour} onClose={() => setMostrarForm(false)} onSuccess={() => { setMostrarForm(false); setReservado(true) }} />
      )}
      <Toast {...toastProps} />
    </div>
  )
}
