'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'

interface TarjetaProductoProps {
  producto: Producto
}

export default function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const [imgCargando, setImgCargando] = useState(true)
  const [imgError, setImgError]       = useState(false)
  const [hover, setHover]             = useState(false)

  const mostrarPlaceholder = !producto.fotoUrl || imgError

  return (
    <article
      className="group bg-white rounded-3xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(45,106,79,0.15)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Imagen / Placeholder */}
      <div className="relative w-full aspect-[3/4] overflow-hidden">
        {mostrarPlaceholder ? (
          /* Placeholder editorial — beige cálido con nombre del producto */
          <div className="absolute inset-0 bg-[#F0EBE3] flex flex-col items-center justify-center px-4 text-center">
            {/* Nombre del producto — tipografía editorial */}
            <p
              className={`text-[#2D6A4F] text-2xl leading-tight font-normal transition-opacity duration-300 ${hover ? 'opacity-100' : 'opacity-80'}`}
              style={{ fontFamily: 'var(--font-dm-serif)' }}
            >
              {producto.nombre}
            </p>
            <p className="text-[#2D6A4F]/50 text-xs mt-2 tracking-wide uppercase">
              {producto.comercio.municipio}
            </p>
          </div>
        ) : (
          <>
            {imgCargando && (
              <div className="absolute inset-0 bg-[#F0EBE3] animate-pulse" />
            )}
            <Image
              src={producto.fotoUrl!}
              alt={producto.nombre}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-all duration-500 ${imgCargando ? 'opacity-0' : 'opacity-100'} ${hover ? 'scale-[1.02]' : 'scale-100'}`}
              onLoad={() => setImgCargando(false)}
              onError={() => { setImgCargando(false); setImgError(true) }}
            />
          </>
        )}

        {/* Badge Nacional — esquina superior derecha */}
        {(producto.alcance === 'NACIONAL' || producto.alcance === 'AMBOS') && (
          <span className="absolute top-3 right-3 bg-white/80 backdrop-blur text-[#1A1A1A] text-[10px] font-semibold px-2.5 py-1 rounded-full leading-none">
            📦 Nacional
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4">

        {/* Fila superior: comercio + verificado */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-[#52B788] text-[10px] font-semibold tracking-widest uppercase truncate mr-2">
            {producto.comercio.nombre}
          </p>
          {producto.comercio.verificado && (
            <span
              className="flex-shrink-0 w-4 h-4 rounded-full bg-[#52B788] flex items-center justify-center text-white text-[9px] font-bold leading-none"
              title="Comercio verificado"
            >
              ✓
            </span>
          )}
        </div>

        {/* Nombre del producto */}
        <h3
          className="text-[#1A1A1A] leading-snug line-clamp-2 mb-1"
          style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '17px' }}
        >
          {producto.nombre}
        </h3>

        {/* Fila info: municipio · tiempo alistamiento */}
        <p className="text-[#1A1A1A]/40 text-xs">
          📍 {producto.comercio.municipio} · Listo en {producto.diasAlistamientoMin}–{producto.diasAlistamientoMax} días
        </p>

        {/* Spacer */}
        <div className="flex-1 min-h-[8px]" />

        {/* Precio + botón agregar */}
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-xl font-bold text-[#1A1A1A]">{formatearPrecio(producto.precio)}</span>
            <span className="text-xs text-[#1A1A1A]/50 ml-1">/ {producto.unidad.toLowerCase()}</span>
          </div>

          <Link
            href={`/producto/${producto.id}`}
            aria-label={`Ver ${producto.nombre}`}
            className="w-10 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#D4A017] transition-colors duration-200 flex items-center justify-center text-white shadow-sm flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}
