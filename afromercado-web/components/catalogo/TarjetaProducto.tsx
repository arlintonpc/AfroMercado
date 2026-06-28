'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useCarrito } from '@/context/CarritoContext'
import { useFavoritos } from '@/context/FavoritoContext'
import { useAuth } from '@/context/AuthContext'
import { registrarEventoPatrocinado } from '@/lib/publicidadTracking'

interface TarjetaProductoProps {
  producto: Producto
  esDestacado?: boolean
  etiquetaDestacado?: string
}

export default function TarjetaProducto({ producto, esDestacado = false, etiquetaDestacado }: TarjetaProductoProps) {
  const selloTexto = etiquetaDestacado?.trim() || 'Patrocinado'
  const { agregar } = useCarrito()
  const { toggle: toggleFav, esFavorito } = useFavoritos()
  const { autenticado } = useAuth()
  const [imgCargando, setImgCargando] = useState(true)
  const [imgError, setImgError]       = useState(false)
  const [hover, setHover]             = useState(false)
  const [agregado, setAgregado]       = useState(false)
  const [agregando, setAgregando]     = useState(false)

  const disponible = Math.max(0, producto.stock - (producto.stockReservado ?? 0))
  const descuentoPct = producto.oferta
    ? producto.oferta.tipo === 'PORCENTAJE'
      ? Math.round(producto.oferta.valor)
      : Math.round(((producto.precio - producto.oferta.precioFinal) / producto.precio) * 100)
    : 0
  const agotado    = disponible === 0
  const stockBajo  = !agotado && disponible <= 5
  const tieneVideo = Boolean(producto.videoUrl || producto.comercio.videoUrl)

  const mostrarPlaceholder = !producto.fotoUrl || imgError
  const href = `/producto/${producto.id}`

  function registrarPatrocinado(evento: 'clic' | 'carrito') {
    if (!esDestacado) return
    registrarEventoPatrocinado(producto.id, evento)
  }

  async function handleAgregar() {
    if (agregando || agotado) return
    setAgregando(true)
    try {
      await agregar(producto, 1)
      registrarPatrocinado('carrito')
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
      className={`group bg-white rounded-3xl overflow-hidden flex flex-col transition-all duration-300 ${
        esDestacado
          ? 'shadow-[0_4px_20px_rgba(45,106,79,0.18)] ring-2 ring-[#2D6A4F]/35'
          : 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
      } ${
        agotado
          ? 'opacity-70'
          : 'hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(45,106,79,0.15)]'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Banda superior — solo en tarjetas seleccionadas */}
      {esDestacado && (
        <div className="h-[3px] w-full bg-gradient-to-r from-[#2D6A4F] via-[#52B788] to-[#2D6A4F] flex-shrink-0" />
      )}

      {/* Imagen / Placeholder */}
      <Link
        href={href}
        aria-label={`Ver ${producto.nombre}`}
        onClick={() => registrarPatrocinado('clic')}
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
        {stockBajo && !esDestacado && !producto.oferta && (
          <span className="absolute top-3 left-3 bg-[#B7800A] text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none">
            Últimas {disponible}
          </span>
        )}

        {/* Badge oferta — % descuento */}
        {producto.oferta && !agotado && !esDestacado && (
          <span className="absolute top-3 left-3 bg-[#2D6A4F] text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none">
            -{descuentoPct}%
          </span>
        )}
        {/* Badge oferta secundario cuando hay destacado */}
        {producto.oferta && !agotado && esDestacado && (
          <span className="absolute bottom-3 left-3 bg-[#2D6A4F] text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">
            -{descuentoPct}%
          </span>
        )}

        {/* Badge Express */}
        {producto.esExpress && !agotado && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#D4A017] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            ⚡ {producto.tiempoEntregaMin ? `${producto.tiempoEntregaMin} min` : 'Express'}
          </span>
        )}

        {tieneVideo && (
          <span className={`absolute ${producto.esExpress && !agotado ? 'bottom-3 right-3' : 'bottom-3 right-3'} inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Video
          </span>
        )}

        {/* Botón favorito */}
        {autenticado && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); toggleFav(Number(producto.id)) }}
            aria-label={esFavorito(Number(producto.id)) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm hover:bg-white transition-colors z-10"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill={esFavorito(Number(producto.id)) ? '#2D6A4F' : 'none'} stroke={esFavorito(Number(producto.id)) ? '#2D6A4F' : '#1A1A1A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}

        {/* Sello personalizado */}
        {esDestacado && (
          <span className="absolute top-3 left-3 flex items-center gap-1 bg-[#2D6A4F] text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none shadow-sm">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.52 3.23 20.5 4.5 21.5 5.3 20.67 7 18.9 8.91 17.5 11 17c-1 3-4 4-4 4s6 0 9-8c1.5 2 2 3.5 2 5.5 0 0 2-10-1-10.5z"/>
            </svg>
            {selloTexto}
          </span>
        )}
      </Link>

      {/* Contenido */}
      <div className="px-3 py-2">

        {/* Comercio */}
        <p className="truncate text-[#52B788] font-semibold uppercase" style={{ fontSize: 10, lineHeight: '12px', letterSpacing: '0.07em', marginBottom: 2 }}>
          {producto.comercioId
            ? <Link href={`/comercio/${producto.comercioId}`} onClick={e => e.stopPropagation()} className="hover:underline">
                {producto.comercio.nombre}
                {producto.comercio.verificado && <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#52B788] text-white text-[7px] font-bold ml-1 align-middle">✓</span>}
              </Link>
            : <>{producto.comercio.nombre}{producto.comercio.verificado && <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#52B788] text-white text-[7px] font-bold ml-1 align-middle">✓</span>}</>
          }
        </p>

        {/* Nombre */}
        <Link
          href={href}
          onClick={() => registrarPatrocinado('clic')}
          className="block truncate font-semibold text-[#1A1A1A]"
          style={{ fontSize: 15, lineHeight: '17px', marginBottom: 2, minHeight: 0 }}
        >
          {producto.nombre}
        </Link>

        <p className="flex items-center gap-1 truncate text-[#1A1A1A]/55" style={{ fontSize: 11, lineHeight: '13px', marginBottom: 5 }}>
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
          <span className="truncate">{producto.comercio.municipio}</span>
        </p>

        {/* Etiqueta de la oferta */}
        {producto.oferta?.etiqueta && (
          <p className="text-[10px] text-[#2D6A4F] font-semibold truncate mb-1" style={{ lineHeight: '12px' }}>
            {producto.oferta.etiqueta}
          </p>
        )}

        {/* Precio + botones */}
        <div className="flex items-center justify-between gap-2">
          <div style={{ lineHeight: 1 }}>
            {producto.oferta ? (
              <>
                <span className="text-xs text-[#1A1A1A]/40 line-through block" style={{ lineHeight: '14px' }}>
                  {formatearPrecio(producto.precio)}
                </span>
                <span className="text-xl font-bold text-[#2D6A4F]">{formatearPrecio(producto.oferta.precioFinal)}</span>
                <span className="text-xs text-[#1A1A1A]/50 ml-1">/ {producto.unidad.toLowerCase()}</span>
              </>
            ) : (
              <>
                <span className="text-xl font-bold text-[#1A1A1A]">{formatearPrecio(producto.precio)}</span>
                <span className="text-xs text-[#1A1A1A]/50 ml-1">/ {producto.unidad.toLowerCase()}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Botón compartir WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : 'https://afromercado.vercel.app'}/producto/${producto.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Compartir por WhatsApp"
              title="Compartir por WhatsApp"
              style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
              className="rounded-full border border-[#25D366]/30 bg-[#25D366]/8 flex items-center justify-center text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>

            {/* Botón: Express → ir al restaurante / Normal → agregar al carrito */}
            {producto.esExpress ? (
              <Link
                href={`/express/${producto.comercioId}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Pedir Express en ${producto.comercio.nombre}`}
                title="Pedir ahora"
                style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
                className="rounded-full bg-[#D4A017] hover:bg-[#B8891A] transition-colors flex items-center justify-center text-white shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAgregar}
                disabled={agregando || agotado}
                aria-label={agotado ? `${producto.nombre} agotado` : `Agregar ${producto.nombre} al pedido`}
                title={agotado ? 'Sin stock disponible' : undefined}
                style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
                className={`rounded-full transition-colors duration-200 flex items-center justify-center text-white shadow-sm ${
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
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
