'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/context/AuthContext'

// ── Tipos ─────────────────────────────────────────────────────

interface Review {
  id: number
  calificacion: number
  comentario: string | null
  createdAt: string
  comprador: { nombre: string }
}

interface DatosReviews {
  reviews: Review[]
  promedio: number | null
  total: number
}

// ── Estrellas ─────────────────────────────────────────────────

function Estrellas({ valor, max = 5, size = 16 }: { valor: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < Math.round(valor) ? '#D4A017' : 'none'}
          stroke="#D4A017" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

function EstrellasSelectorInteractivo({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
          aria-label={`${i} estrella${i > 1 ? 's' : ''}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24"
            fill={i <= (hover || valor) ? '#D4A017' : 'none'}
            stroke="#D4A017" strokeWidth="1.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </span>
  )
}

// ── Formulario ────────────────────────────────────────────────

function FormularioResena({ productoId, onEnviado }: { productoId: number; onEnviado: () => void }) {
  const [calificacion, setCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (calificacion === 0) { setError('Selecciona una calificación'); return }
    setEnviando(true)
    setError(null)
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: { productoId, calificacion, comentario: comentario.trim() || undefined },
      })
      onEnviado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la reseña')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#F8F5F0] rounded-2xl p-5 border border-[#1A1A1A]/5">
      <h3 className="font-semibold text-[#1A1A1A] mb-3">Deja tu calificación</h3>

      <div className="mb-4">
        <EstrellasSelectorInteractivo valor={calificacion} onChange={setCalificacion} />
        {calificacion > 0 && (
          <p className="text-xs text-[#1A1A1A]/50 mt-1">
            {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][calificacion]}
          </p>
        )}
      </div>

      <textarea
        value={comentario}
        onChange={e => setComentario(e.target.value)}
        placeholder="Cuéntanos tu experiencia con este producto (opcional)"
        maxLength={500}
        rows={3}
        className="w-full px-3 py-2.5 text-sm border border-[#1A1A1A]/15 rounded-xl resize-none focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 bg-white"
      />

      {error && <p className="text-xs text-[#C0392B] mt-2">{error}</p>}

      <button
        type="submit"
        disabled={enviando || calificacion === 0}
        className="mt-3 h-10 px-5 bg-[#2D6A4F] text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-[#245a42] transition-colors"
      >
        {enviando ? 'Enviando…' : 'Publicar reseña'}
      </button>
    </form>
  )
}

// ── Tarjeta de reseña ─────────────────────────────────────────

function TarjetaResena({ review }: { review: Review }) {
  const fecha = new Date(review.createdAt).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const iniciales = review.comprador.nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="py-4 border-b border-[#1A1A1A]/5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center text-xs font-bold text-[#2D6A4F] shrink-0">
          {iniciales}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#1A1A1A]">{review.comprador.nombre}</p>
            <p className="text-xs text-[#1A1A1A]/40">{fecha}</p>
          </div>
          <Estrellas valor={review.calificacion} size={14} />
          {review.comentario && (
            <p className="text-sm text-[#1A1A1A]/70 mt-1.5 leading-relaxed">{review.comentario}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sección principal ─────────────────────────────────────────

export function SeccionResenas({ productoId }: { productoId: number }) {
  const { autenticado } = useAuth()
  const [datos, setDatos] = useState<DatosReviews | null>(null)
  const [puedeCalificar, setPuedeCalificar] = useState(false)
  const [yaCalifico, setYaCalifico] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const raw = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/productos/${productoId}/reviews`
      )
      const json = await raw.json()
      setDatos(json.data)
    } catch { /* silencioso */ } finally {
      setCargando(false)
    }
  }, [productoId])

  const cargarPermiso = useCallback(async () => {
    if (!autenticado) return
    try {
      const res = await apiFetch<{ ok: boolean; data: { puede: boolean; yaCalifico: boolean } }>(
        `/reviews/puede-calificar/${productoId}`
      )
      setPuedeCalificar(res.data.puede)
      setYaCalifico(res.data.yaCalifico)
    } catch { /* silencioso */ }
  }, [productoId, autenticado])

  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { void cargarPermiso() }, [cargarPermiso])

  const promedio = datos?.promedio ?? null
  const total = datos?.total ?? 0
  const reviews = datos?.reviews ?? []

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-5">
        <h2
          className="text-xl text-[#1A1A1A]"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Reseñas
        </h2>
        {promedio !== null && (
          <div className="flex items-center gap-1.5">
            <Estrellas valor={promedio} size={15} />
            <span className="text-sm font-semibold text-[#1A1A1A]">{promedio}</span>
            <span className="text-sm text-[#1A1A1A]/40">({total})</span>
          </div>
        )}
      </div>

      {/* Formulario */}
      {autenticado && puedeCalificar && (
        <div className="mb-6">
          <FormularioResena
            productoId={productoId}
            onEnviado={() => { void cargar(); void cargarPermiso() }}
          />
        </div>
      )}

      {autenticado && yaCalifico && (
        <p className="text-sm text-[#2D6A4F] bg-[#52B788]/10 rounded-xl px-4 py-3 mb-5 border border-[#52B788]/20">
          Ya calificaste este producto. ¡Gracias por tu reseña!
        </p>
      )}

      {/* Lista */}
      {cargando ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="py-4 border-b border-[#1A1A1A]/5">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1A1A1A]/8 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[#1A1A1A]/8 rounded w-28 animate-pulse" />
                  <div className="h-3 bg-[#1A1A1A]/8 rounded w-20 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[#1A1A1A]/40 italic py-2">
          {autenticado && !puedeCalificar && !yaCalifico
            ? 'Sé el primero en calificar este producto después de recibirlo.'
            : 'Aún no hay reseñas para este producto.'}
        </p>
      ) : (
        <div>
          {reviews.map(r => <TarjetaResena key={r.id} review={r} />)}
        </div>
      )}
    </section>
  )
}
