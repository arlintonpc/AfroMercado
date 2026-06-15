'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Contador regresivo hasta `expiresAt` (ISO). Muestra mm:ss restante.
 * Cuando expira llama opcionalmente onExpirar y muestra "Tiempo agotado".
 *
 * El valor mostrado se deriva de `ahora` (timestamp actual), que solo se
 * actualiza dentro del callback del intervalo — evitamos llamar setState de
 * forma síncrona en el cuerpo del efecto.
 */
export function Contador({
  expiresAt,
  onExpirar,
  className = '',
}: {
  expiresAt?: string | null
  onExpirar?: () => void
  className?: string
}) {
  const objetivo = expiresAt ? new Date(expiresAt).getTime() : null
  const [ahora, setAhora] = useState<number>(() => Date.now())
  const expiradoRef = useRef(false)

  useEffect(() => {
    if (!objetivo) return
    expiradoRef.current = false

    const id = setInterval(() => {
      const t = Date.now()
      setAhora(t)
      if (t >= objetivo && !expiradoRef.current) {
        expiradoRef.current = true
        clearInterval(id)
        onExpirar?.()
      }
    }, 1000)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])

  if (objetivo === null) return null

  const restante = Math.max(0, objetivo - ahora)
  const totalSeg = Math.floor(restante / 1000)
  const min = Math.floor(totalSeg / 60)
  const seg = totalSeg % 60
  const expirado = restante <= 0

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 tabular-nums font-semibold',
        expirado ? 'text-[#C0392B]' : 'text-[#1A1A1A]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {expirado ? 'Tiempo agotado' : `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`}
    </span>
  )
}

export default Contador
