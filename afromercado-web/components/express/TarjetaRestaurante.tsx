'use client'

import Link from 'next/link'
import { type ComercioExpress } from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { optimizarImagenPequena } from '@/lib/cloudinary'

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatearDistancia(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export default function TarjetaRestaurante({
  cfg, userLat, userLon, onQuitarFavorito,
}: {
  cfg: ComercioExpress
  userLat?: number | null
  userLon?: number | null
  /** Si se pasa, muestra un corazón para quitar de favoritos en vez de solo navegar. */
  onQuitarFavorito?: (id: number) => void
}) {
  const dist = userLat && userLon && cfg.comercio.latitud && cfg.comercio.longitud
    ? distanciaKm(userLat, userLon, cfg.comercio.latitud, cfg.comercio.longitud)
    : null
  const inicial = cfg.comercio.nombre.charAt(0).toUpperCase()
  // Una foto real de plato vende antojo; el logo del comercio es un respaldo
  // razonable, y si no hay ninguna de las dos, queda el gradiente de marca.
  const foto = cfg.fotoPlato
    ? optimizarImagenPequena(cfg.fotoPlato)
    : (cfg.comercio.logoUrl ? optimizarImagenPequena(cfg.comercio.logoUrl) : null)
  const esNuevo = !cfg.comercio.totalReviews || cfg.comercio.totalReviews === 0

  return (
    <Link href={`/express/${cfg.comercio.id}`}
      className="group block rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white border border-gray-100/80 shadow-sm">

      {/* Imagen hero */}
      <div className="relative h-48 overflow-hidden bg-[#1B4332]">
        {foto ? (
          <img src={foto} alt={cfg.comercio.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#52B788] flex items-center justify-center">
            <span className="text-7xl opacity-20">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Badge abierto/cerrado + cupón */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${
            cfg.abierto
              ? 'bg-emerald-500/90 text-white'
              : 'bg-black/50 text-white/80'
          }`}>
            {cfg.abierto ? '● Abierto' : '○ Cerrado'}
          </span>
          {cfg.tieneCupon && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm bg-[#D4A017]/90 text-white">
              🏷️ Cupón
            </span>
          )}
        </div>

        {/* Quitar de favoritos, o tiempo de entrega */}
        {onQuitarFavorito ? (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onQuitarFavorito(cfg.id) }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-500 hover:bg-white transition-colors"
            title="Quitar de favoritos"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        ) : (
          <div className="absolute top-3 right-3">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
              <p className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">entrega</p>
              <p className="text-[#1B4332] font-black text-sm leading-none">~{cfg.tiempoPrepMinutos} min</p>
            </div>
          </div>
        )}

        {/* Nombre + ubicación */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base leading-snug line-clamp-1">{cfg.comercio.nombre}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="opacity-70 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="text-white/75 text-xs">{cfg.comercio.municipio}</span>
              </div>
            </div>
            {dist !== null && (
              <span className="text-white/65 text-[10px] flex-shrink-0 bg-black/20 px-2 py-0.5 rounded-full">
                {formatearDistancia(dist)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2D6A4F] to-[#1B4332] flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">{inicial}</span>
        </div>

        <div className="min-w-0 flex-1">
          {cfg.comercio.calificacion > 0 ? (
            <div className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-xs font-semibold text-gray-800">{Number(cfg.comercio.calificacion).toFixed(1)}</span>
            </div>
          ) : esNuevo && (
            <span className="text-[10px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-1.5 py-0.5 rounded">✨ Nuevo</span>
          )}
          <div className="flex gap-2 mt-0.5">
            {cfg.modalidades.includes('DOMICILIO') && (
              <span className="text-[11px] text-gray-500">🛵 {formatearPrecio(Number(cfg.costoEnvioBase))}</span>
            )}
            {cfg.modalidades.includes('RECOGER') && (
              <span className="text-[11px] text-gray-500">🏃 Recoger</span>
            )}
          </div>
        </div>

        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-[#2D6A4F] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
