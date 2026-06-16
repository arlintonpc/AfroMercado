'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { obtenerMiComercio } from '@/components/comerciante/api'

export default function ComerciantePage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activo = true
    setError(null)

    obtenerMiComercio()
      .then((comercio) => {
        if (!activo) return
        router.replace(comercio ? '/comerciante/dashboard' : '/comerciante/registro-comercio')
      })
      .catch((err) => {
        if (!activo) return
        setError(
          err instanceof Error
            ? err.message
            : 'No pudimos revisar el estado de tu tienda.',
        )
      })

    return () => {
      activo = false
    }
  }, [router, intento])

  if (error) {
    return (
      <div className="mx-auto flex min-h-[48vh] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-2xl border border-[#C0392B]/20 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#C0392B]/10 text-[#C0392B]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 8v5M12 17h.01M10.3 4.5 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.5a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1
            className="mt-4 text-2xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            No pudimos abrir tu tienda
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">{error}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => setIntento((n) => n + 1)}>Intentar de nuevo</Button>
            <Button variant="secondary" onClick={() => router.replace('/comerciante/dashboard')}>
              Ir al panel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[48vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <svg
          className="animate-spin text-[#2D6A4F]"
          width="36"
          height="36"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div>
          <p className="text-base font-semibold text-[#1A1A1A]">Revisando tu tienda</p>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            Te llevaremos al lugar correcto para continuar.
          </p>
        </div>
      </div>
    </div>
  )
}
