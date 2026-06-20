'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl mb-4">⚠️</p>
      <h2
        className="text-2xl text-[#1A1A1A]"
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        Algo salió mal
      </h2>
      <p className="text-sm text-[#1A1A1A]/55 mt-2 max-w-sm">
        Ocurrió un error inesperado. Puedes intentarlo de nuevo o volver al inicio.
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={reset}
          className="rounded-xl bg-[#2D6A4F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="rounded-xl border border-[#1A1A1A]/15 px-5 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
