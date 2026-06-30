'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { verCheckinPublico, realizarCheckin, type ReservaHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'

const DOC_TIPOS = [
  { value: 'CC',        label: 'Cédula de ciudadanía' },
  { value: 'TI',        label: 'Tarjeta de identidad' },
  { value: 'CE',        label: 'Cédula de extranjería' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'PEP',       label: 'PEP' },
]

export default function CheckinOnlinePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [reserva, setReserva]   = useState<ReservaHotel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo]       = useState(false)

  // Formulario
  const [docTipo,     setDocTipo]     = useState('CC')
  const [docNumero,   setDocNumero]   = useState('')
  const [horaLlegada, setHoraLlegada] = useState('')
  const [solicitudes, setSolicitudes] = useState('')

  useEffect(() => {
    verCheckinPublico(token)
      .then(r => { setReserva(r); if (r.checkinOnlineAt) setListo(true) })
      .catch(() => setError('Este enlace de check-in no es válido o ya expiró.'))
      .finally(() => setCargando(false))
  }, [token])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!docNumero.trim()) return
    setEnviando(true)
    try {
      await realizarCheckin(token, { docTipo, docNumero, horaEstimadaLlegada: horaLlegada || undefined, solicitudesEspeciales: solicitudes || undefined })
      setListo(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el check-in')
    }
    setEnviando(false)
  }

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error && !reserva) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔗</p>
        <h1 className="font-bold text-gray-900 mb-2">Enlace no válido</h1>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  )

  const hotel = reserva?.configHotel?.comercio
  const hab   = reserva?.habitacionTipo
  const entrada = reserva ? new Date(reserva.fechaEntrada).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : ''

  if (listo) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h1 className="font-bold text-xl text-gray-900 mb-2">Check-in completado</h1>
        <p className="text-sm text-gray-500 mb-4">Todo listo para tu llegada a <strong>{hotel?.nombre}</strong></p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1 mb-6">
          <p><span className="text-gray-400">Habitación:</span> <span className="font-medium">{hab?.nombre}</span></p>
          <p><span className="text-gray-400">Entrada:</span> <span className="font-medium">{entrada}</span></p>
          <p><span className="text-gray-400">Check-in:</span> <span className="font-medium">{reserva?.configHotel?.checkInHora}</span></p>
          <p><span className="text-gray-400">Código:</span> <span className="font-mono font-semibold text-[#1B4332]">{reserva?.codigo}</span></p>
        </div>
        <button onClick={() => router.push('/hoteles/mis-reservas')}
          className="w-full py-3 text-sm font-medium bg-[#1B4332] text-white rounded-xl hover:bg-[#2D6A4F] transition-colors">
          Ver mis reservas
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs text-[#2D6A4F] font-medium uppercase tracking-wide mb-1">Check-in online</p>
          <h1 className="text-2xl font-bold text-gray-900">{hotel?.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">{hab?.nombre} · Entrada {entrada}</p>
        </div>

        {/* Info reserva */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Código</span>
            <span className="font-mono font-semibold text-[#1B4332]">{reserva?.codigo}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500">Huéspedes</span>
            <span className="font-medium">{reserva?.huespedes}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500">Total</span>
            <span className="font-medium">{formatearPrecio(Number(reserva?.total))}</span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={enviar} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Datos para el check-in</h2>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo de documento</label>
            <select value={docTipo} onChange={e => setDocTipo(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30">
              {DOC_TIPOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Número de documento *</label>
            <input value={docNumero} onChange={e => setDocNumero(e.target.value)} required
              placeholder="123456789"
              className="w-full mt-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hora estimada de llegada</label>
            <input type="time" value={horaLlegada} onChange={e => setHoraLlegada(e.target.value)}
              className="w-full mt-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Solicitudes especiales (opcional)</label>
            <textarea value={solicitudes} onChange={e => setSolicitudes(e.target.value)} rows={3}
              placeholder="Cama extra, llegada temprana, alergias..."
              className="w-full mt-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={enviando || !docNumero.trim()}
            className="w-full py-3 text-sm font-semibold bg-[#1B4332] text-white rounded-xl disabled:opacity-50 hover:bg-[#2D6A4F] transition-colors">
            {enviando ? 'Enviando...' : 'Confirmar check-in'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Al confirmar, el hotel recibirá tus datos de llegada
          </p>
        </form>
      </div>
    </div>
  )
}
