'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { obtenerTour, verificarDisponibilidadTour, crearReservaTour, misReservasTour, type ConfigTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import SeccionReviewsTour from '@/components/tours/SeccionReviewsTour'

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
      </div>

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
    </div>
  )
}
