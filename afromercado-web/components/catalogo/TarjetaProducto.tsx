'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Producto } from '@/types/producto'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useFavoritos } from '@/context/FavoritoContext'
import { useAuth } from '@/context/AuthContext'
import { registrarEventoPatrocinado } from '@/lib/publicidadTracking'
import BadgeVendedorVerificado from '@/components/ui/BadgeVendedorVerificado'

interface TarjetaProductoProps {
  producto: Producto
  esDestacado?: boolean
  etiquetaDestacado?: string
  /** Muestra la insignia "Vendedor verificado" (usado en la pestaña Tienda Local del buscador). */
  mostrarBadgeVerificado?: boolean
}

export default function TarjetaProducto({ producto, esDestacado = false, etiquetaDestacado, mostrarBadgeVerificado = false }: TarjetaProductoProps) {
  const selloTexto = etiquetaDestacado?.trim() || 'Patrocinado'
  const { toggle: toggleFav, esFavorito } = useFavoritos()
  const { autenticado } = useAuth()
  const [imgCargando, setImgCargando] = useState(true)
  const [imgError, setImgError]       = useState(false)
  const [hover, setHover]             = useState(false)

  // Los hooks de arriba deben correr siempre, en el mismo orden, en cada
  // render (regla de React) — por eso este early-return va DESPUÉS de ellos,
  // no antes. BannerDisplay inyecta ítems marcados así en la misma lista de
  // productos; esta tarjeta los ignora y BannerDisplay los renderiza aparte.
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
  const stockBajo  = !agotado && disponible <= 5
  const tieneVideo = Boolean(producto.videoUrl || producto.comercio?.videoUrl)
  const mostrarNacional = !agotado && (producto.alcance === 'NACIONAL' || producto.alcance === 'AMBOS')

  const mostrarPlaceholder = !producto.fotoUrl || imgError
  const href = `/producto/${producto.id}`

  function registrarPatrocinado(evento: 'clic' | 'carrito') {
    if (!esDestacado) return
    registrarEventoPatrocinado(producto.id, evento)
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
        className="relative block w-full aspect-square overflow-hidden"
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
              {producto.comercio?.municipio}
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
        {mostrarNacional && (
          <span className="absolute top-3 right-3 bg-white/70 backdrop-blur-md text-[#1A1A1A] text-[10px] font-bold px-2.5 py-1 rounded-full leading-none shadow-sm border border-white/40">
            📦 Nacional
          </span>
        )}

        {/* Badge stock bajo */}
        {stockBajo && !esDestacado && !producto.oferta && (
          <span className="absolute top-3 left-3 bg-[#B7800A]/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none shadow-sm border border-white/20">
            Últimas {disponible}
          </span>
        )}

        {/* Badge oferta — % descuento */}
        {producto.oferta && !agotado && !esDestacado && (
          <span className="absolute top-3 left-3 bg-[#2D6A4F]/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none shadow-sm border border-white/20">
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
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#D4A017]/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white shadow-sm border border-white/20">
            ⚡ {producto.tiempoEntregaMin ? `${producto.tiempoEntregaMin} min` : 'Express'}
          </span>
        )}

        {/* Badge contacto directo — el vendedor aún no tiene RUT/cuenta
            verificada, se compra coordinando con él directamente. */}
        {!producto.esExpress && producto.comercio?.comprableEnPlataforma === false && !agotado && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            🤝 Contacto directo
          </span>
        )}

        {tieneVideo && (
          <span className={`absolute ${producto.esExpress && !agotado ? 'bottom-3 right-3' : 'bottom-3 right-3'} inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md shadow-sm border border-white/20`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Video
          </span>
        )}

        {/* Botón favorito — se desplaza debajo del badge Nacional cuando
            ambos coinciden en la esquina superior derecha, para que no se
            superpongan. */}
        {autenticado && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); toggleFav(Number(producto.id)) }}
            aria-label={esFavorito(Number(producto.id)) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            className={`absolute right-2.5 ${mostrarNacional ? 'top-11' : 'top-2.5'} w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm hover:bg-white transition-colors z-10`}
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
        <p className="truncate text-[#1A1A1A]/50 font-medium" style={{ fontSize: 11, lineHeight: '14px', marginBottom: 3 }}>
          {/* El check ✓ se omite cuando ya se muestra el badge "Vendedor verificado"
              completo debajo (mismo dato, ya comunicado) — evita repetirlo dos veces. */}
          {producto.comercioId
            ? <Link href={`/comercio/${producto.comercioId}`} onClick={e => e.stopPropagation()} className="hover:underline">
                {producto.comercio?.nombre}
                {producto.comercio?.verificado && !mostrarBadgeVerificado && <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#52B788] text-white text-[7px] font-bold ml-1 align-middle">✓</span>}
              </Link>
            : <>{producto.comercio?.nombre}{producto.comercio?.verificado && !mostrarBadgeVerificado && <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#52B788] text-white text-[7px] font-bold ml-1 align-middle">✓</span>}</>
          }
        </p>

        {mostrarBadgeVerificado && (
          <div className="mb-1.5">
            <BadgeVendedorVerificado verificado={producto.comercio?.verificado} size="sm" mostrarTooltip={false} />
          </div>
        )}

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
          <span className="truncate">{producto.comercio?.municipio}</span>
        </p>

        {/* Etiqueta de la oferta */}
        {producto.oferta?.etiqueta && (
          <p className="text-[10px] text-[#2D6A4F] font-semibold truncate mb-1" style={{ lineHeight: '12px' }}>
            {producto.oferta.etiqueta}
          </p>
        )}

        {/* Precio — sin botón junto a él: la tarjeta completa ya es tappable
            (imagen/nombre) para ir a la ficha y agregar ahí. Esto le da al
            precio todo el ancho disponible, siempre visible sin recortes. */}
        <div style={{ lineHeight: 1 }}>
          {producto.oferta ? (
            <>
              <span className="text-xs text-[#1A1A1A]/40 line-through block" style={{ lineHeight: '14px' }}>
                {formatearPrecio(producto.precio)}
              </span>
              <span className="text-xl font-bold text-[#2D6A4F] block truncate">{formatearPrecio(producto.oferta.precioFinal)}</span>
              <span className="text-[10px] text-[#1A1A1A]/50 block truncate" style={{ marginTop: 2 }}>/ {producto.unidad.toLowerCase()}</span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold text-[#1A1A1A] block truncate">{formatearPrecio(producto.precio)}</span>
              <span className="text-[10px] text-[#1A1A1A]/50 block truncate" style={{ marginTop: 2 }}>/ {producto.unidad.toLowerCase()}</span>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
