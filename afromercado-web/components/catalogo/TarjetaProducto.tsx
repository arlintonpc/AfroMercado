'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { registrarEventoPatrocinado } from '@/lib/publicidadTracking'

interface TarjetaProductoProps {
  producto: Producto
  esDestacado?: boolean
  etiquetaDestacado?: string
  mostrarBadgeVerificado?: boolean
}

export default function TarjetaProducto({ producto, esDestacado = false, etiquetaDestacado }: TarjetaProductoProps) {
  const [imgCargando, setImgCargando] = useState(true)
  const [imgError, setImgError]       = useState(false)
  const [hover, setHover]             = useState(false)

  if ((producto as { esBannerDisplay?: boolean }).esBannerDisplay) {
    return null
  }

  const disponible = Math.max(0, producto.stock - (producto.stockReservado ?? 0))
  const descuentoPct = producto.oferta
    ? producto.oferta.tipo === 'PORCENTAJE'
      ? Math.round(producto.oferta.valor)
      : Math.round(((producto.precio - producto.oferta.precioFinal) / producto.precio) * 100)
    : 0
  const agotado    = disponible === 0
  const mostrarNacional = !agotado && (producto.alcance === 'NACIONAL' || producto.alcance === 'AMBOS')
  const mostrarPlaceholder = !producto.fotoUrl || imgError
  const href = `/producto/${producto.id}`

  function registrarPatrocinado(evento: 'clic' | 'carrito') {
    if (!esDestacado) return
    registrarEventoPatrocinado(producto.id, evento)
  }

  return (
    <article
      className={`group bg-white dark:bg-[#151D18] rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ${
        esDestacado
          ? 'shadow-md ring-2 ring-[#2D6A4F]/35'
          : 'shadow-sm border border-gray-100 dark:border-white/10'
      } ${
        agotado
          ? 'opacity-70'
          : 'hover:-translate-y-0.5 hover:shadow-md'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Imagen Limpia — Sin saturación de íconos o botones encima (Estilo MercadoLibre) */}
      <Link
        href={href}
        aria-label={`Ver ${producto.nombre}`}
        onClick={() => registrarPatrocinado('clic')}
        className="relative block w-full aspect-[4/5] overflow-hidden bg-gray-100 dark:bg-white/5"
      >
        {mostrarPlaceholder ? (
          <div className="absolute inset-0 bg-[#F0EBE3] dark:bg-white/5 flex flex-col items-center justify-center px-4 text-center">
            <p
              className="text-[#2D6A4F] dark:text-[#52B788] text-xl leading-tight font-normal"
              style={{ fontFamily: 'var(--font-dm-serif)' }}
            >
              {producto.nombre}
            </p>
          </div>
        ) : (
          <>
            {imgCargando && (
              <div className="absolute inset-0 bg-[#F0EBE3] dark:bg-white/5 animate-pulse" />
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

        {/* Únicamente insignias esenciales súper limpias */}
        {producto.oferta && !agotado && (
          <span className="absolute top-2.5 left-2.5 bg-[#2D6A4F] text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
            -{descuentoPct}%
          </span>
        )}

        {mostrarNacional && (
          <span className="absolute top-2.5 right-2.5 bg-white/90 dark:bg-black/70 backdrop-blur-md text-gray-800 dark:text-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-white/40">
            📦 Nacional
          </span>
        )}

        {agotado && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow">
              Agotado
            </span>
          </div>
        )}
      </Link>

      {/* Contenido Limpio y Apretado sin justify-between que separe el texto */}
      <div className="p-3 flex flex-col gap-1 bg-white dark:bg-[#151D18] transition-colors">
        <div>
          {/* Comercio */}
          <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight mb-0.5">
            {producto.comercio?.nombre || 'Teravia'}
          </p>

          {/* Nombre del Producto */}
          <Link
            href={href}
            onClick={() => registrarPatrocinado('clic')}
            className="block text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 hover:text-[#2D6A4F] transition-colors"
          >
            {producto.nombre}
          </Link>

          {/* Ubicación pegada inmediatamente debajo del nombre */}
          <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400 mt-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-3 w-3 flex-shrink-0 text-[#52B788]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate">{producto.comercio?.municipio}</span>
          </p>
        </div>

        {/* Sección de Precio estilo e-commerce */}
        <div className="pt-1">
          {producto.oferta ? (
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-base sm:text-lg font-black text-[#2D6A4F] dark:text-[#52B788]">
                  {formatearPrecio(producto.oferta.precioFinal)}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatearPrecio(producto.precio)}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                / {producto.unidad.toLowerCase()}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                {formatearPrecio(producto.precio)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-1">
                / {producto.unidad.toLowerCase()}
              </span>
            </div>
          )}

          {/* Etiqueta de Oferta */}
          {producto.oferta?.etiqueta && (
            <p className="text-xs font-semibold text-[#2D6A4F] dark:text-[#52B788] mt-1">
              {producto.oferta.etiqueta}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
