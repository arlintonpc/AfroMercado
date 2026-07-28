'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { registrarEventoPatrocinado } from '@/lib/publicidadTracking'
import { useCarrito } from '@/context/CarritoContext'

interface TarjetaProductoProps {
  producto: Producto
  esDestacado?: boolean
  etiquetaDestacado?: string
  mostrarBadgeVerificado?: boolean
}

export default function TarjetaProducto({ producto, esDestacado = false, etiquetaDestacado }: TarjetaProductoProps) {
  const { agregar } = useCarrito()
  const [imgCargando, setImgCargando] = useState(true)
  const [imgError, setImgError]       = useState(false)
  const [hover, setHover]             = useState(false)
  const [agregadoAnim, setAgregadoAnim] = useState(false)

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

  function handleAgregarRapido(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (agotado) return
    agregar(producto, 1)
    registrarPatrocinado('carrito')
    setAgregadoAnim(true)
    setTimeout(() => setAgregadoAnim(false), 1500)
  }

  return (
    <article
      className={`group bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ${
        esDestacado
          ? 'shadow-md ring-2 ring-[#2D6A4F]/35'
          : 'shadow-sm border border-gray-100 hover:border-gray-200'
      } ${
        agotado
          ? 'opacity-70'
          : 'hover:-translate-y-0.5 hover:shadow-md'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Fotografía de Producto Completa (object-cover) — Sin franjas grises ni vacíos */}
      <Link
        href={href}
        aria-label={`Ver ${producto.nombre}`}
        onClick={() => registrarPatrocinado('clic')}
        className="relative block w-full aspect-[4/3] overflow-hidden bg-gray-100"
      >
        {mostrarPlaceholder ? (
          <div className="absolute inset-0 bg-[#F5F2EC] flex flex-col items-center justify-center px-4 text-center">
            <p
              className="text-[#2D6A4F] text-xl leading-tight font-normal"
              style={{ fontFamily: 'var(--font-dm-serif)' }}
            >
              {producto.nombre}
            </p>
          </div>
        ) : (
          <>
            {imgCargando && (
              <div className="absolute inset-0 bg-gray-100 animate-pulse" />
            )}
            <Image
              src={producto.fotoUrl!}
              alt={producto.nombre}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover w-full h-full transition-transform duration-500 ${imgCargando ? 'opacity-0' : 'opacity-100'} ${hover && !agotado ? 'scale-[1.04]' : 'scale-100'}`}
              onLoad={() => setImgCargando(false)}
              onError={() => { setImgCargando(false); setImgError(true) }}
            />
          </>
        )}

        {/* Insignia de oferta limpia */}
        {producto.oferta && !agotado && (
          <span className="absolute top-2.5 left-2.5 bg-[#2D6A4F] text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
            -{descuentoPct}%
          </span>
        )}

        {/* Insignia Nacional */}
        {mostrarNacional && (
          <span className="absolute top-2.5 right-2.5 bg-white/90 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-gray-200">
            📦 Nacional
          </span>
        )}

        {/* Insignia Agotado */}
        {agotado && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow">
              Agotado
            </span>
          </div>
        )}

        {/* Botón flotante de compra rápida estilo MercadoLibre */}
        {!agotado && (
          <button
            type="button"
            onClick={handleAgregarRapido}
            title="Agregar al carrito"
            aria-label="Agregar al carrito"
            className={`absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full shadow-md border border-gray-100 flex items-center justify-center transition-all z-10 ${
              agregadoAnim
                ? 'bg-[#2D6A4F] text-white scale-110'
                : 'bg-white text-[#2D6A4F] hover:bg-[#2D6A4F] hover:text-white hover:scale-105'
            }`}
          >
            {agregadoAnim ? (
              <span className="text-xs font-bold">✓</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                <path d="M12 9v6M9 12h6" />
              </svg>
            )}
          </button>
        )}
      </Link>

      {/* Contenido Elegante sobre Blanco Puro */}
      <div className="p-3.5 flex flex-col gap-1 bg-white">
        <div>
          {/* Comercio */}
          <p className="truncate text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
            {producto.comercio?.nombre || 'Teravia'}
          </p>

          {/* Nombre del Producto */}
          <Link
            href={href}
            onClick={() => registrarPatrocinado('clic')}
            className="block text-sm font-bold text-gray-900 leading-snug line-clamp-2 hover:text-[#2D6A4F] transition-colors"
          >
            {producto.nombre}
          </Link>

          {/* Ubicación pegada al nombre */}
          <p className="flex items-center gap-1 truncate text-xs text-gray-500 mt-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-3 w-3 flex-shrink-0 text-[#2D6A4F]"
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

        {/* Sección de Precio en Verde Marca de Elegancia */}
        <div className="pt-1">
          {producto.oferta ? (
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-extrabold text-[#1B4332]">
                  {formatearPrecio(producto.oferta.precioFinal)}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatearPrecio(producto.precio)}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                / {producto.unidad.toLowerCase()}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-lg font-extrabold text-[#1B4332]">
                {formatearPrecio(producto.precio)}
              </span>
              <span className="text-xs text-gray-500 font-medium ml-1">
                / {producto.unidad.toLowerCase()}
              </span>
            </div>
          )}

          {/* Etiqueta de Oferta */}
          {producto.oferta?.etiqueta && (
            <p className="text-xs font-semibold text-[#2D6A4F] mt-1">
              {producto.oferta.etiqueta}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
