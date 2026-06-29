'use client'

import { useEffect, useState } from 'react'
import { reviewsHotel, crearReviewHotel, type ReviewHotel } from '@/lib/api/review'
import EstrellaRating from '@/components/ui/EstrellaRating'
import { useAuth } from '@/context/AuthContext'

interface Props {
  configHotelId: number
  /** ID de reserva en estado CHECKOUT que tiene el usuario actual (si existe) */
  reservaElegibleId?: number
}

export default function SeccionReviewsHotel({ configHotelId, reservaElegibleId }: Props) {
  const { usuario } = useAuth()
  const [reviews, setReviews] = useState<ReviewHotel[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [calificacion, setCalificacion] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    reviewsHotel(configHotelId).then(r => { setReviews(r); setCargando(false) })
  }, [configHotelId])

  const promedio = reviews.length > 0 ? reviews.reduce((s, r) => s + r.calificacion, 0) / reviews.length : 0
  const yaDejóReview = reviews.some(r => String(r.clienteId) === String(usuario?.id))

  async function enviarReview() {
    if (!reservaElegibleId) return
    setEnviando(true); setError('')
    try {
      const nueva = await crearReviewHotel(reservaElegibleId, calificacion, comentario || undefined)
      setReviews(prev => [nueva, ...prev])
      setMostrarForm(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-[#1A1A1A]">Reseñas de huéspedes</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <EstrellaRating valor={Math.round(promedio)} tamaño="sm" readonly />
              <span className="text-sm font-bold">{promedio.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({reviews.length} reseña{reviews.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
        {reservaElegibleId && !yaDejóReview && usuario && (
          <button onClick={() => setMostrarForm(v => !v)}
            className="text-xs bg-[#2D6A4F] text-white px-3 py-1.5 rounded-xl hover:bg-[#40916C] transition-colors">
            + Dejar reseña
          </button>
        )}
      </div>

      {mostrarForm && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tu calificación</label>
            <EstrellaRating valor={calificacion} onChange={setCalificacion} tamaño="lg" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Comentario (opcional)</label>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
              placeholder="¿Cómo fue tu estadía?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setMostrarForm(false)}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm">Cancelar</button>
            <button onClick={enviarReview} disabled={enviando}
              className="flex-1 bg-[#2D6A4F] text-white py-2 rounded-xl text-sm font-bold disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin reseñas todavía. ¡Sé el primero!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-[#2D6A4F]/20 flex items-center justify-center text-xs font-bold text-[#2D6A4F]">
                  {r.cliente?.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]">{r.cliente?.nombre ?? 'Huésped'}</p>
                  <EstrellaRating valor={r.calificacion} tamaño="sm" readonly />
                </div>
                <span className="ml-auto text-[10px] text-gray-400">
                  {new Date(r.creadoAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {r.comentario && <p className="text-sm text-gray-600 ml-9">{r.comentario}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
