'use client'

import { useState } from 'react'
import { calificarEntrega } from '@/lib/api/repartidor'

export default function ModalCalificarRepartidor({
  entregaId,
  onCerrar,
  onCalificado,
}: {
  entregaId: number
  onCerrar: () => void
  onCalificado: () => void
}) {
  const [calificacion, setCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar() {
    if (calificacion < 1) { setError('Selecciona una calificación.'); return }
    setEnviando(true)
    setError(null)
    try {
      await calificarEntrega(entregaId, calificacion, comentario.trim() || undefined)
      onCalificado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la calificación.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1A1A]">¿Cómo estuvo tu entrega?</h2>
        <p className="mt-1 text-sm text-[#1A1A1A]/55">Califica a tu repartidor.</p>

        <div className="mt-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCalificacion(n)}
              className="text-3xl leading-none transition-transform hover:scale-110"
              aria-label={`${n} estrellas`}
            >
              {n <= calificacion ? '⭐' : '☆'}
            </button>
          ))}
        </div>

        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={2}
          placeholder="Comentario (opcional)"
          className="mt-4 w-full resize-none rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
        />

        {error && <p className="mt-2 text-xs text-[#C0392B]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-lg border border-[#1A1A1A]/15 px-4 py-2 text-sm font-medium text-[#1A1A1A]/70 hover:bg-[#F8F5F0]">
            Ahora no
          </button>
          <button
            onClick={enviar}
            disabled={enviando}
            className="rounded-lg bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235540] disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
