'use client'

import { useState } from 'react'

interface Props {
  valor: number
  onChange?: (v: number) => void
  tamaño?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}

const TAMAÑO = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl' }

export default function EstrellaRating({ valor, onChange, tamaño = 'md', readonly = false }: Props) {
  const [hover, setHover] = useState(0)
  const activo = hover || valor

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => setHover(0)}
          className={`${TAMAÑO[tamaño]} leading-none transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <span className={i <= activo ? 'text-yellow-400' : 'text-gray-200'}>★</span>
        </button>
      ))}
    </div>
  )
}
