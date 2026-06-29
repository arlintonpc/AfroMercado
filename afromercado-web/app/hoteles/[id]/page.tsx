'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { obtenerHotel, verificarDisponibilidad, crearReserva, type ConfigHotel, type HabitacionTipo } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'

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
      await crearReserva({
        habitacionTipoId: habitacion.id,
        fechaEntrada, fechaSalida,
        huespedes, metodoPago,
        notasCliente: notas || undefined,
        nombreHuesped: nombre.trim(),
        telefonoHuesped: telefono.trim(),
      })
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
            <h3 className="font-bold text-[#1A1A1A]">Reservar: {habitacion.nombre}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          <div className="space-y-4">
            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check-in</label>
                <input type="date" min={hoy} value={fechaEntrada} onChange={e => setFechaEntrada(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                <p className="text-[10px] text-gray-400 mt-0.5">Desde las {hotel.checkInHora}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check-out</label>
                <input type="date" min={fechaEntrada || hoy} value={fechaSalida} onChange={e => setFechaSalida(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                <p className="text-[10px] text-gray-400 mt-0.5">Hasta las {hotel.checkOutHora}</p>
              </div>
            </div>

            {/* Resumen noches + disponibilidad */}
            <div className={`rounded-xl p-3 text-sm flex items-center justify-between ${
              disponibilidad === null ? 'bg-gray-50' : disponibilidad.disponibles > 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
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

            {/* Huéspedes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Huéspedes (máx. {habitacion.capacidad})</label>
              <input type="number" min={1} max={habitacion.capacidad} value={huespedes} onChange={e => setHuespedes(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>

            {/* Datos del huésped */}
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

            {/* Pago */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]">
                <option value="EFECTIVO">Efectivo al llegar</option>
                <option value="NEQUI">Nequi</option>
                <option value="TRANSFERENCIA">Transferencia bancaria</option>
              </select>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas especiales (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Llegada tarde, cama adicional, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <button
              onClick={handleReservar}
              disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles <= 0)}
              className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] transition-colors disabled:opacity-50"
            >
              {cargando ? 'Procesando…' : hotel.confirmacionAuto ? '✅ Confirmar reserva' : '📩 Solicitar reserva'}
            </button>

            {!hotel.confirmacionAuto && (
              <p className="text-xs text-center text-gray-400">
                El hotel confirmará tu reserva en las próximas {hotel.horasLimiteConfirm}h
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HotelDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const { autenticado } = useAuth()
  const [hotel, setHotel] = useState<ConfigHotel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [habitacionSelec, setHabitacionSelec] = useState<HabitacionTipo | null>(null)
  const [reservaOk, setReservaOk] = useState(false)
  const [fotoActiva, setFotoActiva] = useState<Record<number, number>>({})

  useEffect(() => {
    obtenerHotel(Number(id)).then(data => { setHotel(data); setCargando(false) }).catch(() => setCargando(false))
  }, [id])

  if (cargando) return <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" /></div>
  if (!hotel) return <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-gray-400"><p>Hotel no encontrado</p></div>

  function handleReservar(hab: HabitacionTipo) {
    if (!autenticado) { router.push('/login'); return }
    setHabitacionSelec(hab)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <Link href="/hoteles" className="text-[#2D6A4F] p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="min-w-0">
          <h1 className="font-bold text-[#1A1A1A] truncate">{hotel.comercio.nombre}</h1>
          <p className="text-xs text-gray-500">📍 {hotel.comercio.municipio}{hotel.comercio.departamento ? `, ${hotel.comercio.departamento}` : ''}</p>
        </div>
        {autenticado && (
          <Link href="/hoteles/mis-reservas" className="ml-auto text-xs text-[#2D6A4F] font-medium whitespace-nowrap">Mis reservas</Link>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-16 space-y-6">
        {/* Info hotel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            {hotel.comercio.logoUrl && (
              <img src={hotel.comercio.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-[#1A1A1A]">{hotel.comercio.nombre}</h2>
              {Number(hotel.comercio.totalReviews) > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-yellow-400 text-sm">★</span>
                  <span className="text-sm font-semibold">{Number(hotel.comercio.calificacion).toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({hotel.comercio.totalReviews} reseñas)</span>
                </div>
              )}
            </div>
          </div>

          {hotel.comercio.descripcion && (
            <p className="text-sm text-gray-600 mb-4">{hotel.comercio.descripcion}</p>
          )}

          {/* Check-in / Check-out */}
          <div className="flex gap-4 text-sm mb-4">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Check-in</p>
              <p className="font-bold text-[#1A1A1A]">{hotel.checkInHora}</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Check-out</p>
              <p className="font-bold text-[#1A1A1A]">{hotel.checkOutHora}</p>
            </div>
          </div>

          {/* Servicios */}
          {hotel.servicios.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Servicios incluidos</p>
              <div className="flex flex-wrap gap-2">
                {hotel.servicios.map(s => (
                  <span key={s} className="text-xs bg-[#E8F4F0] text-[#2D6A4F] px-2.5 py-1 rounded-full font-medium">
                    {SERVICIOS_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Política de cancelación */}
          {hotel.politicaCancelacion && (
            <div className="mt-4 bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Política de cancelación</p>
              <p className="text-xs text-amber-800">{hotel.politicaCancelacion}</p>
            </div>
          )}

          {/* Mapa de ubicación */}
          {hotel.comercio.latitud && hotel.comercio.longitud && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ubicación</p>
              <MapaHoteles hoteles={[hotel]} userLat={null} userLon={null} />
            </div>
          )}

          {/* WhatsApp */}
          {hotel.comercio.whatsapp && (
            <a href={`https://wa.me/57${hotel.comercio.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              className="mt-4 flex items-center gap-2 justify-center w-full border border-green-300 text-green-700 font-medium py-2.5 rounded-xl text-sm hover:bg-green-50 transition-colors">
              <span>💬</span> Contactar por WhatsApp
            </a>
          )}
        </div>

        {/* Habitaciones */}
        <div>
          <h2 className="font-bold text-[#1A1A1A] text-lg mb-3">Habitaciones disponibles</h2>
          {hotel.habitaciones.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <p className="text-3xl mb-2">🛏️</p>
              <p>Este hotel aún no tiene habitaciones publicadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hotel.habitaciones.map(hab => {
                const fotoIdx = fotoActiva[hab.id] ?? 0
                return (
                  <div key={hab.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Fotos */}
                    {hab.fotos.length > 0 ? (
                      <div className="relative h-48 bg-gray-100">
                        <img src={hab.fotos[fotoIdx]} alt={hab.nombre} className="w-full h-full object-cover" />
                        {hab.fotos.length > 1 && (
                          <div className="absolute bottom-2 right-2 flex gap-1">
                            {hab.fotos.map((_, i) => (
                              <button key={i} onClick={() => setFotoActiva(p => ({ ...p, [hab.id]: i }))}
                                className={`w-2 h-2 rounded-full transition-colors ${i === fotoIdx ? 'bg-white' : 'bg-white/50'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-32 bg-gradient-to-br from-[#E8F4F0] to-[#B7E4C7] flex items-center justify-center text-4xl">🛏️</div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-bold text-[#1A1A1A]">{hab.nombre}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">👤 hasta {hab.capacidad} persona{hab.capacidad !== 1 ? 's' : ''} · {hab.cantidad} habitación{hab.cantidad !== 1 ? 'es' : ''}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-[#2D6A4F]">{formatearPrecio(Number(hab.precioPorNoche))}</p>
                          <p className="text-xs text-gray-400">por noche</p>
                        </div>
                      </div>

                      {hab.descripcion && <p className="text-sm text-gray-600 mb-3">{hab.descripcion}</p>}

                      {hab.serviciosExtra.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {hab.serviciosExtra.map(s => (
                            <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      )}

                      <button onClick={() => handleReservar(hab)}
                        className="w-full bg-[#2D6A4F] text-white font-bold py-2.5 rounded-xl text-sm hover:bg-[#40916C] transition-colors">
                        Reservar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal reserva */}
      {habitacionSelec && !reservaOk && (
        <FormReserva
          hotel={hotel}
          habitacion={habitacionSelec}
          onClose={() => setHabitacionSelec(null)}
          onSuccess={() => { setHabitacionSelec(null); setReservaOk(true) }}
        />
      )}

      {/* Confirmación */}
      {reservaOk && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
            <p className="text-5xl mb-3">🎉</p>
            <h3 className="font-bold text-xl text-[#1A1A1A] mb-2">¡Reserva enviada!</h3>
            <p className="text-sm text-gray-500 mb-6">
              {hotel.confirmacionAuto ? 'Tu reserva fue confirmada automáticamente.' : `El hotel revisará tu solicitud y confirmará en las próximas ${hotel.horasLimiteConfirm}h.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReservaOk(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600">
                Seguir viendo
              </button>
              <Link href="/hoteles/mis-reservas" className="flex-1 bg-[#2D6A4F] text-white rounded-xl py-2.5 text-sm font-bold text-center">
                Mis reservas
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
