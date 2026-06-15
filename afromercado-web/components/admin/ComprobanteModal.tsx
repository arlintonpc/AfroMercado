'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { obtenerComprobanteObjectUrl } from './api'

interface ComprobanteModalProps {
  /** ID del pago cuyo comprobante se mostrará. */
  pagoId: string
  /** Texto descriptivo del pago (ej. "Pedido #1234"). */
  titulo: string
  onCerrar: () => void
}

/**
 * Modal que carga la imagen del comprobante mediante un fetch autenticado
 * (el endpoint exige Authorization, por lo que <img src> directo no sirve).
 * La imagen se obtiene como blob y se muestra vía URL.createObjectURL; el
 * object URL se revoca al desmontar para no filtrar memoria.
 */
export function ComprobanteModal({
  pagoId,
  titulo,
  onCerrar,
}: ComprobanteModalProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    let objectUrl: string | null = null

    setCargando(true)
    setError(null)
    setSrc(null)

    obtenerComprobanteObjectUrl(pagoId)
      .then((url) => {
        if (!activo) {
          // Componente desmontado antes de resolver: liberamos de inmediato.
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setSrc(url)
      })
      .catch((err: unknown) => {
        if (!activo) return
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el comprobante.',
        )
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pagoId])

  // Cerrar con la tecla Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Comprobante de ${titulo}`}
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[#1A1A1A]">
              Comprobante de pago
            </h3>
            <p className="text-sm text-[#1A1A1A]/60">{titulo}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1A1A]/50 transition-colors hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-[#F8F5F0] p-4">
          {cargando && (
            <div className="flex flex-col items-center gap-3 text-[#1A1A1A]/50">
              <svg
                className="animate-spin text-[#2D6A4F]"
                width="28"
                height="28"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="9"
                  cy="9"
                  r="7"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="2"
                />
                <path
                  d="M9 2a7 7 0 0 1 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm">Cargando comprobante…</span>
            </div>
          )}

          {!cargando && error && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-[#C0392B]">{error}</p>
            </div>
          )}

          {!cargando && !error && src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`Comprobante de ${titulo}`}
              className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
            />
          )}
        </div>

        {/* Pie */}
        <div className="flex justify-end border-t border-[#1A1A1A]/8 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ComprobanteModal
