'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useCarrito } from '@/context/CarritoContext'

interface TarjetaProductoProps {
  producto: Producto
}

export default function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const { agregar } = useCarrito()
  const [imgCargando, setImgCargando] = useState(true)
  const [imgError, setImgError]       = useState(false)
  const [hover, setHover]             = useState(false)
  const [agregado, setAgregado]       = useState(false)
  const [agregando, setAgregando]     = useState(false)

  const disponible = Math.max(0, producto.stock - (producto.stockReservado ?? 0))
  const agotado    = disponible === 0
  const stockBajo  = !agotado && disponible <= 5

  const mostrarPlaceholder = !producto.fotoUrl || imgError
  const href = `/producto/${producto.id}`

  async function handleAgregar() {
    if (agregando || agotado) return
    setAgregando(true)
    try {
      await agregar(producto, 1)
      setAgregado(true)
      setTimeout(() => setAgregado(false), 1600)
    } catch {
      // error de red — el carrito ya tiene fallback local
      setAgregado(true)
      setTimeout(() => setAgregado(false), 1600)
    } finally {
      setAgregando(false)
    }
  }

  return (
    <article
      className={`group bg-white rounded-3xl overflow-hidden flex flex-col transition-all duration-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${
        agotado
          ? 'opacity-70'
          : 'hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(45,106,79,0.15)]'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Imagen / Placeholder */}
      <Link
        href={href}
        aria-label={`Ver ${producto.nombre}`}
        className="relative block w-full aspect-[3/4] overflow-hidden"
      >
        {mostrarPlaceholder ? (
          <div className="absolute inset-0 bg-[#F0EBE3] flex flex-col items-center justify-center px-4 text-center">
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
              className={`object-cover transition-all duration-500 ${imgCargando ? 'opacity-0' : 'opacity-100'} ${hover && !agotado ? 'scale-[1.02]' : 'scale-100'}`}
              onLoad={() => setImgCargando(false)}
              onError={() => { setImgCargando(false); setImgError(true) }}
            />
          </>
        )}

        {/* Badge Agotado */}
        {agotado && (
          <div className="absolute inset-0 bg-[#1A1A1A]/30 flex items-center justify-center">
            <span className="bg-white text-[#1A1A1A] text-xs font-bold px-3 py-1.5 rounded-full shadow">
              Agotado
            </span>
          </div>
        )}

        {/* Badge Nacional */}
        {!agotado && (producto.alcance === 'NACIONAL' || producto.alcance === 'AMBOS') && (
          <span className="absolute top-3 right-3 bg-white/80 backdrop-blur text-[#1A1A1A] text-[10px] font-semibold px-2.5 py-1 rounded-full leading-none">
            📦 Nacional
          </span>
        )}

        {/* Badge stock bajo */}
        {stockBajo && (
          <span className="absolute top-3 left-3 bg-[#B7800A] text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none">
            Últimas {disponible}
          </span>
        )}
      </Link>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4">

        {/* Fila superior: comercio + verificado */}
        <div className="flex items-center justify-between mb-1">
          {producto.comercioId
            ? <Link href={`/comercio/${producto.comercioId}`} onClick={e => e.stopPropagation()}
                className="text-[#52B788] text-[10px] font-semibold tracking-widest uppercase truncate mr-2 hover:underline">
                {producto.comercio.nombre}
              </Link>
            : <p className="text-[#52B788] text-[10px] font-semibold tracking-widest uppercase truncate mr-2">
                {producto.comercio.nombre}
              </p>
          }
          {producto.comercio.verificado && (
            <span
              className="flex-shrink-0 w-4 h-4 rounded-full bg-[#52B788] flex items-center justify-center text-white text-[9px] font-bold leading-none"
              title="Comercio verificado"
            >
              ✓
            </span>
          )}
        </div>

        {/* Nombre */}
        <Link href={href}>
          <h3
            className="text-[#1A1A1A] leading-snug line-clamp-2 mb-1 group-hover:text-[#2D6A4F] transition-colors"
            style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '17px' }}
          >
            {producto.nombre}
          </h3>
        </Link>

        {/* Municipio · alistamiento */}
        <p className="text-[#1A1A1A]/40 text-xs">
          📍 {producto.comercio.municipio} · Listo en {producto.diasAlistamientoMin}–{producto.diasAlistamientoMax} días
        </p>

        <div className="flex-1 min-h-[8px]" />

        {/* Precio + botón */}
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-xl font-bold text-[#1A1A1A]">{formatearPrecio(producto.precio)}</span>
            <span className="text-xs text-[#1A1A1A]/50 ml-1">/ {producto.unidad.toLowerCase()}</span>
          </div>

          <button
            type="button"
            onClick={handleAgregar}
            disabled={agregando || agotado}
            aria-label={agotado ? `${producto.nombre} agotado` : `Agregar ${producto.nombre} al pedido`}
            title={agotado ? 'Sin stock disponible' : undefined}
            className={`w-10 h-10 rounded-full transition-colors duration-200 flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
              agotado
                ? 'bg-[#1A1A1A]/20 cursor-not-allowed'
                : agregado
                ? 'bg-[#2D6A4F]'
                : 'bg-[#2D6A4F] hover:bg-[#D4A017] disabled:opacity-70'
            }`}
          >
            {agregado ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : agotado ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
