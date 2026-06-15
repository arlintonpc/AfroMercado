'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import {
  subirImagenesProducto,
  quitarImagenProducto,
  fotoPrincipalProducto,
  type ProductoComerciante,
} from './api'

interface SubidorImagenesProps {
  productoId: number
  fotoUrlInicial: string | null
  imagenesIniciales: string[]
}

/**
 * Gestiona las fotos de un producto: subir varias, eliminar y elegir la
 * principal. Cada acción llama a la API y refresca el estado local.
 */
export default function SubidorImagenes({
  productoId,
  fotoUrlInicial,
  imagenesIniciales,
}: SubidorImagenesProps) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(fotoUrlInicial)
  const [imagenes, setImagenes] = useState<string[]>(imagenesIniciales)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Lista única de fotos (la principal primero).
  const fotos = Array.from(
    new Set([fotoUrl, ...imagenes].filter(Boolean) as string[]),
  )

  function aplicar(p: ProductoComerciante) {
    setFotoUrl(p.fotoUrl ?? null)
    setImagenes(p.imagenes ?? [])
  }

  async function onArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setError(null)
    setOcupado(true)
    try {
      aplicar(await subirImagenesProducto(productoId, files))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir las imágenes.')
    } finally {
      setOcupado(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function eliminar(url: string) {
    if (ocupado) return
    setError(null)
    setOcupado(true)
    try {
      aplicar(await quitarImagenProducto(productoId, url))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos quitar la imagen.')
    } finally {
      setOcupado(false)
    }
  }

  async function hacerPrincipal(url: string) {
    if (ocupado || url === fotoUrl) return
    setError(null)
    setOcupado(true)
    try {
      aplicar(await fotoPrincipalProducto(productoId, url))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cambiar la principal.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-base font-semibold text-[#1A1A1A]">Fotos del producto</p>
      <p className="mb-3 text-sm text-[#1A1A1A]/55">
        Sube varias fotos. La marcada como <strong>principal</strong> es la que se ve primero.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {fotos.map((url) => {
          const esPrincipal = url === fotoUrl
          return (
            <div
              key={url}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                esPrincipal ? 'border-[#2D6A4F]' : 'border-[#1A1A1A]/10'
              }`}
            >
              <Image src={url} alt="Foto del producto" fill sizes="120px" className="object-cover" />

              {/* Etiqueta principal */}
              {esPrincipal && (
                <span className="absolute top-1 left-1 bg-[#2D6A4F] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                  Principal
                </span>
              )}

              {/* Acciones */}
              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                {!esPrincipal && (
                  <button
                    type="button"
                    onClick={() => hacerPrincipal(url)}
                    disabled={ocupado}
                    aria-label="Marcar como principal"
                    title="Marcar como principal"
                    className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#2D6A4F] flex items-center justify-center shadow disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => eliminar(url)}
                  disabled={ocupado}
                  aria-label="Eliminar foto"
                  title="Eliminar foto"
                  className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#C0392B] flex items-center justify-center shadow ml-auto disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {/* Tile para subir */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado}
          className="aspect-square rounded-xl border-2 border-dashed border-[#1A1A1A]/20 hover:border-[#2D6A4F]/50 bg-[#F8F5F0] flex flex-col items-center justify-center gap-1 text-[#1A1A1A]/55 transition-colors disabled:opacity-50"
        >
          {ocupado ? (
            <span className="text-xs">Subiendo…</span>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-center px-1">Agregar foto</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onArchivos}
        className="hidden"
        aria-label="Subir fotos del producto"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-[#C0392B]">
          {error}
        </p>
      )}
    </div>
  )
}
