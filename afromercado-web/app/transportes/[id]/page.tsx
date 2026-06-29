'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { obtenerTransporte, verificarDisponibilidadTransporte, crearReservaTransporte, type ConfigTransporte, type RutaTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'

const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju',
  viernes: 'Vi', sabado: 'Sá', domingo: 'Do',
}

function FormReservaTransporte({ transporte, ruta, onClose, onSuccess }: {
  transporte: ConfigTransporte; ruta: RutaTransporte; onClose: () => void; onSuccess: () => void
}) {
  const { usuario } = useAuth()
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fecha, setFecha] = useState(manana)
  const [asientos, setAsientos] = useState(1)
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [notas, setNotas] = useState('')
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [telefono, setTelefono] = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setDisponibilidad] = useState<{ disponibles: number; capacidad: number } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const total = Number(ruta.precioAsiento) * asientos

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTransporte(ruta.id, fecha).then(setDisponibilidad).catch(() => setDisponibilidad(null))
  }, [fecha, ruta.id])

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    setError(''); setCargando(true)
    try {
      await crearReservaTransporte({ rutaTransporteId: ruta.id, fechaViaje: fecha, asientos, metodoPago, notasCliente: notas || undefined, nombreContacto: nombre.trim(), telefonoContacto: telefono.trim() })
      onSuccess()
    } catch (e: any) { setError(e.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#1A1A1A]">{ruta.origen} → {ruta.destino}</h3>
              <p className="text-xs text-gray-400">🕐 {ruta.horario}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 text-xl">×</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha del viaje</label>
              <input type="date" min={manana} value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
            </div>

            {disponibilidad !== null && (
              <div className={`rounded-xl p-3 text-sm ${disponibilidad.disponibles > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {disponibilidad.disponibles > 0
                  ? `✓ ${disponibilidad.disponibles} asiento${disponibilidad.disponibles !== 1 ? 's' : ''} disponible${disponibilidad.disponibles !== 1 ? 's' : ''}`
                  : '✗ Sin asientos disponibles para esta fecha'}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asientos (máx. {ruta.capacidad})</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setAsientos(a => Math.max(1, a - 1))}
                  className="w-9 h-9 rounded-xl border border-gray-200 text-lg font-bold flex items-center justify-center hover:bg-gray-50">−</button>
                <span className="text-lg font-bold text-center w-8">{asientos}</span>
                <button onClick={() => setAsientos(a => Math.min(ruta.capacidad, disponibilidad?.disponibles ?? ruta.capacidad, a + 1))}
                  className="w-9 h-9 rounded-xl border border-gray-200 text-lg font-bold flex items-center justify-center hover:bg-gray-50">+</button>
              </div>
            </div>

            <div className="bg-[#023E8A]/5 rounded-xl p-3 flex justify-between">
              <span className="text-sm text-gray-600">{asientos} × {formatearPrecio(Number(ruta.precioAsiento))}</span>
              <span className="font-bold text-[#023E8A]">{formatearPrecio(total)}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 3001234567"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]">
                <option value="EFECTIVO">Efectivo al abordar</option>
                <option value="NEQUI">Nequi</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} resize-none
                placeholder="Equipaje especial, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A] resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={handleReservar}
              disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles < asientos)}
              className="w-full bg-[#023E8A] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#0077B6] disabled:opacity-50">
              {cargando ? 'Procesando…' : '🛥️ Reservar asientos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TransporteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const [transporte, setTransporte] = useState<ConfigTransporte | null>(null)
  const [cargando, setCargando] = useState(true)
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaTransporte | null>(null)
  const [reservado, setReservado] = useState(false)
  const [fotoActual, setFotoActual] = useState(0)

  useEffect(() => {
    obtenerTransporte(Number(id)).then(d => { setTransporte(d); setCargando(false) }).catch(() => setCargando(false))
  }, [id])

  if (cargando) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#023E8A] border-t-transparent rounded-full animate-spin" /></div>
  if (!transporte) return <div className="min-h-screen flex items-center justify-center text-gray-400">No encontrado</div>

  const rutas = transporte.rutas.filter(r => r.activo)

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="relative h-56 bg-gradient-to-br from-[#023E8A] to-[#0077B6] flex items-center justify-center">
        {transporte.fotos.length > 0 ? (
          <>
            <img src={transporte.fotos[fotoActual]} alt={transporte.nombre} className="w-full h-full object-cover" />
            {transporte.fotos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {transporte.fotos.map((_, i) => (
                  <button key={i} onClick={() => setFotoActual(i)}
                    className={`w-1.5 h-1.5 rounded-full ${i === fotoActual ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <span className="text-6xl">{TIPO_ICONO[transporte.tipo] ?? '🛥️'}</span>
        )}
        <Link href="/transportes" className="absolute top-4 left-4 bg-black/40 rounded-full p-2 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-10">
        <h1 className="text-xl font-bold text-[#1A1A1A] mb-1">{transporte.nombre}</h1>
        <p className="text-sm text-gray-500 mb-1">🏢 {transporte.comercio.nombre} · 📍 {transporte.comercio.municipio}</p>
        <p className="text-xs text-gray-400 mb-4">{TIPO_ICONO[transporte.tipo]} {transporte.tipo}</p>

        {transporte.descripcion && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <p className="text-sm text-gray-600 leading-relaxed">{transporte.descripcion}</p>
          </div>
        )}

        {/* Rutas */}
        <h2 className="font-semibold text-[#1A1A1A] mb-3">Rutas disponibles</h2>
        {rutas.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border p-4">Sin rutas activas.</p>
        ) : (
          <div className="space-y-3">
            {rutas.map(ruta => (
              <div key={ruta.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold text-[#1A1A1A]">
                      <span className="truncate">{ruta.origen}</span>
                      <span className="text-gray-400 flex-shrink-0">→</span>
                      <span className="truncate">{ruta.destino}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>🕐 {ruta.horario}</span>
                      <span>👥 cap. {ruta.capacidad}</span>
                    </div>
                    {ruta.diasSemana.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {ruta.diasSemana.map(d => (
                          <span key={d} className="text-[10px] bg-[#023E8A]/10 text-[#023E8A] px-1.5 py-0.5 rounded font-medium">
                            {DIAS_LABEL[d] ?? d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#023E8A]">{formatearPrecio(Number(ruta.precioAsiento))}</p>
                    <p className="text-[10px] text-gray-400">/asiento</p>
                    <button onClick={() => { if (!usuario) { window.location.href = '/ingresar'; return } setRutaSeleccionada(ruta) }}
                      className="mt-2 text-xs bg-[#023E8A] text-white px-3 py-1.5 rounded-xl hover:bg-[#0077B6] transition-colors">
                      Reservar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {reservado && (
          <div className="mt-4 bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <p className="text-green-700 font-bold">✅ Reserva enviada</p>
            <Link href="/transportes/mis-reservas" className="text-xs text-[#023E8A] underline mt-1 block">Ver mis reservas</Link>
          </div>
        )}
      </div>

      {rutaSeleccionada && (
        <FormReservaTransporte
          transporte={transporte}
          ruta={rutaSeleccionada}
          onClose={() => setRutaSeleccionada(null)}
          onSuccess={() => { setRutaSeleccionada(null); setReservado(true) }}
        />
      )}
    </div>
  )
}
