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

export default function TarjetaProducto({ producto, esDestacado = false, etiquetaDestacado: _etiquetaDestacado }: TarjetaProductoProps) {
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
      className={`group relative h-[286px] bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-300 sm:h-auto ${
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
        className="relative block h-[70%] w-full shrink-0 overflow-hidden bg-gray-100 sm:h-auto sm:aspect-[4/3]"
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
      </Link>

      {/* Contenido Elegante sobre Blanco Puro */}
      <div className="h-[30%] overflow-hidden p-3 pt-2.5 pr-12 flex flex-col justify-start gap-1 bg-white sm:h-auto sm:min-h-[150px] sm:p-3.5">
        <div className="shrink-0">
          {/* Comercio */}
          {/* Nombre del Producto */}
          <Link
            href={href}
            onClick={() => registrarPatrocinado('clic')}
            className="block text-[12px] font-bold text-gray-900 leading-[15px] line-clamp-2 hover:text-[#2D6A4F] transition-colors sm:text-sm sm:leading-snug"
          >
            {producto.nombre}
          </Link>

          {/* Ubicación pegada al nombre */}
        </div>

        {/* Sección de Precio en Verde Marca de Elegancia */}
        <div className="shrink-0 pt-0.5">
          {producto.oferta ? (
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[17px] font-extrabold text-[#1B4332] sm:text-lg">
                  {formatearPrecio(producto.oferta.precioFinal)}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatearPrecio(producto.precio)}
                </span>
              </div>
              <p className="hidden text-xs text-gray-500 font-medium sm:block">
                / {producto.unidad.toLowerCase()}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-[17px] font-extrabold text-[#1B4332] sm:text-lg">
                {formatearPrecio(producto.precio)}
              </span>
              <span className="text-xs text-gray-500 font-medium ml-1">
                / {producto.unidad.toLowerCase()}
              </span>
            </div>
          )}

          {/* Etiqueta de Oferta */}
          {producto.oferta?.etiqueta && (
            <p className="hidden text-xs font-semibold text-[#2D6A4F] mt-1 sm:block">
              {producto.oferta.etiqueta}
            </p>
          )}
        </div>
      </div>
      {!agotado && (
        <button type="button" onClick={handleAgregarRapido} title="Agregar al carrito" aria-label={`Agregar ${producto.nombre} al carrito`} className={`absolute right-2.5 top-[calc(70%-18px)] z-10 flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 shadow-md transition-all sm:top-[calc(50%-18px)] ${agregadoAnim ? 'bg-[#2D6A4F] text-white scale-110' : 'bg-white text-[#2D6A4F] hover:bg-[#2D6A4F] hover:text-white hover:scale-105'}`}>
          {agregadoAnim ? <span className="text-xs font-bold">✓</span> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /><path d="M12 9v6M9 12h6" /></svg>}
        </button>
      )}
    </article>
  )
}
