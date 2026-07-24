'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  toggleLikePublicacion,
  toggleFavoritoPublicacionCultural,
  registrarVistaPublicacion,
  registrarCompartidoPublicacion,
  type PublicacionCultural,
} from '@/lib/api/cultura'
import ModalComentarios from './ModalComentarios'
import { ModalCompartir } from './ModalCompartir'
import InsigniasTerritoriales from '@/components/ui/InsigniasTerritoriales'
import { formatearPrecio } from '@/lib/formatearPrecio'

function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000)
  if (minutos < 60) return 'Hace un momento'
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Hace ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `Hace ${dias}d`
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface TerritoryPostCardProps {
  publicacion: PublicacionCultural
  onAbrirVideoReels?: (publicacionId: number) => void
  onAbrirFoto?: (publicacion: PublicacionCultural, indiceInicial?: number) => void
  onDenunciar?: (publicacionId: number) => void
}

export default function TerritoryPostCard({
  publicacion,
  onAbrirVideoReels,
  onAbrirFoto,
  onDenunciar,
}: TerritoryPostCardProps) {
  const { usuario } = useAuth()
  const router = useRouter()

  const [likes, setLikes] = useState(publicacion.totalLikes ?? 0)
  const [meGusta, setMeGusta] = useState(publicacion.meGusta ?? false)
  const [esFavorito, setEsFavorito] = useState(publicacion.esFavorito ?? false)
  const [siguiendo, setSiguiendo] = useState(publicacion.comercio?.siguiendo ?? false)
  const [textoExpandido, setTextoExpandido] = useState(false)
  const [modalComentarios, setModalComentarios] = useState(false)
  const [modalCompartir, setModalCompartir] = useState(false)

  const tieneVideo = !!publicacion.videoUrl
  const videoSrc = publicacion.videoUrl
  const fotoPrincipal = publicacion.fotoUrls?.[0]
  const municipioNombre = publicacion.municipio || 'Chocó'
  const departamentoNombre = publicacion.departamento || 'Chocó'

  // Origen territorial explicado (ejemplo: Nuquí, El Carmen de Atrato, Quibdó)
  const origenExplicado = publicacion.producto
    ? `Producido en ${municipioNombre}, ${departamentoNombre}`
    : `Experiencia de ${municipioNombre}`

  // Estado operativo simulado ("Disponible ahora")
  const disponibleAhora = publicacion.producto
    ? `🟢 Disponible • Entrega en ${municipioNombre}`
    : `🟢 Abierto hoy en ${municipioNombre}`

  async function handleToggleLike() {
    if (!usuario) {
      router.push('/ingresar')
      return
    }
    const estadoPrev = meGusta
    setMeGusta(!estadoPrev)
    setLikes((l) => (estadoPrev ? l - 1 : l + 1))
    try {
      await toggleLikePublicacion(publicacion.id)
    } catch {
      setMeGusta(estadoPrev)
      setLikes((l) => (estadoPrev ? l + 1 : l - 1))
    }
  }

  async function handleToggleFavorito() {
    if (!usuario) {
      router.push('/ingresar')
      return
    }
    const estadoPrev = esFavorito
    setEsFavorito(!estadoPrev)
    try {
      await toggleFavoritoPublicacionCultural(publicacion.id)
    } catch {
      setEsFavorito(estadoPrev)
    }
  }

  return (
    <article className="bg-white rounded-3xl border border-[#1A1A1A]/8 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
      {/* 1. Header estilo Facebook / Teravia */}
      <div className="p-4 md:p-5 flex items-center justify-between gap-3 border-b border-gray-100/60">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={publicacion.comercio ? `/comercio/${publicacion.comercio.id}` : '#'}
            className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-[#1B4332] border-2 border-[#D4A017] flex items-center justify-center font-bold text-white shadow-sm"
          >
            {publicacion.comercio?.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={publicacion.comercio.logoUrl}
                alt={publicacion.comercio.nombre}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{publicacion.comercio?.nombre?.[0] || publicacion.autor?.nombre?.[0] || 'T'}</span>
            )}
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={publicacion.comercio ? `/comercio/${publicacion.comercio.id}` : '#'}
                className="font-bold text-sm text-[#1A1A1A] hover:text-[#2D6A4F] truncate"
              >
                {publicacion.comercio?.nombre || publicacion.autor?.nombre || 'Emprendimiento Territorial'}
              </Link>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span>📍 {municipioNombre}, {departamentoNombre}</span>
              <span>•</span>
              <span>{fechaCorta(publicacion.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Menú derecho */}
        <div className="flex items-center gap-2">
          {onDenunciar && (
            <button
              type="button"
              onClick={() => onDenunciar(publicacion.id)}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title="Reportar publicación"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 2. Badge de Oportunidad "Disponible Ahora" & Origen Explicado */}
      <div className="px-4 md:px-5 py-2 bg-gradient-to-r from-emerald-50/80 to-amber-50/50 border-b border-emerald-100/50 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
          {disponibleAhora}
        </span>
        <span className="font-medium text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-md">
          {origenExplicado}
        </span>
      </div>

      {/* 3. Contenido de Texto */}
      {publicacion.descripcion && (
        <div className="px-4 md:px-5 py-3 text-sm text-gray-800 leading-relaxed">
          <p className={!textoExpandido && publicacion.descripcion.length > 180 ? 'line-clamp-3' : ''}>
            {publicacion.descripcion}
          </p>
          {publicacion.descripcion.length > 180 && (
            <button
              onClick={() => setTextoExpandido(!textoExpandido)}
              className="text-xs font-bold text-[#2D6A4F] hover:underline mt-1 block"
            >
              {textoExpandido ? 'Ver menos' : 'Ver más...'}
            </button>
          )}
        </div>
      )}

      {/* 4. Área Multimedia (Video o Fotos) */}
      <div className="relative bg-black aspect-video overflow-hidden flex items-center justify-center">
        {tieneVideo && videoSrc ? (
          <div className="relative w-full h-full group cursor-pointer" onClick={() => onAbrirVideoReels?.(publicacion.id)}>
            <video
              src={videoSrc}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 flex items-center justify-center transition-all">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <span className="absolute bottom-3 right-3 text-[10px] font-bold text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full">
              🎬 Ver en Reels
            </span>
          </div>
        ) : fotoPrincipal ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={fotoPrincipal}
            alt={publicacion.titulo || 'Publicación territorial'}
            className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => onAbrirFoto?.(publicacion, 0)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex items-center justify-center p-6 text-center">
            <p className="text-lg font-serif text-amber-200 italic">{publicacion.titulo || 'Territorio Vivo'}</p>
          </div>
        )}
      </div>

      {/* 5. Tarjeta de Conversión Comercial (Sleek Shoppable Strip con Imagen Destacada) */}
      {publicacion.producto && (
        <div className="bg-[#FAF8F5] border-t border-b border-[#EBE5DA] p-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {publicacion.producto.fotoUrl ? (
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white shadow-md group-hover:scale-105 transition-transform bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicacion.producto.fotoUrl}
                  alt={publicacion.producto.nombre}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#1B4332] text-amber-300 flex items-center justify-center font-bold text-2xl flex-shrink-0 shadow-md">
                🛒
              </div>
            )}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-extrabold tracking-wider text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-md uppercase">
                  Producto del Territorio
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-[#1A1A1A] truncate tracking-tight">{publicacion.producto.nombre}</h4>
              <p className="text-base font-black text-[#2D6A4F] mt-1">
                {formatearPrecio(Number(publicacion.producto.precio))}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push(`/producto/${publicacion.producto!.id}`)}
            className="flex-shrink-0 bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-extrabold px-4.5 py-2.5 rounded-full shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>🛒</span>
            <span>Ver producto</span>
          </button>
        </div>
      )}

      {/* 6. Barra Inferior de Confianza e Interacción */}
      <div className="p-3 md:px-5 md:py-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs font-semibold text-gray-600 bg-gray-50/50">
        <button
          type="button"
          onClick={handleToggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            meGusta ? 'text-rose-600 bg-rose-50' : 'hover:bg-gray-200/60'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={meGusta ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{likes}</span>
        </button>

        <button
          type="button"
          onClick={() => setModalComentarios(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-gray-200/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span>{publicacion.totalComentarios || 0}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleFavorito}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            esFavorito ? 'text-amber-600 bg-amber-50' : 'hover:bg-gray-200/60'
          }`}
          title="Guardar en deseos"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={esFavorito ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>{esFavorito ? 'Guardado' : 'Guardar'}</span>
        </button>

        <button
          type="button"
          onClick={() => setModalCompartir(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-gray-200/60 transition-colors text-[#2D6A4F]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>Compartir</span>
        </button>
      </div>

      {modalComentarios && (
        <ModalComentarios
          publicacionId={publicacion.id}
          onClose={() => setModalComentarios(false)}
        />
      )}

      {modalCompartir && (
        <ModalCompartir
          abierto={modalCompartir}
          onClose={() => setModalCompartir(false)}
          url={typeof window !== 'undefined' ? `${window.location.origin}/vitrina?video=${publicacion.id}` : ''}
          titulo={publicacion.titulo || publicacion.descripcion || 'Teravia'}
          onCompartir={() => registrarCompartidoPublicacion(publicacion.id)}
        />
      )}
    </article>
  )
}
