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
      className="group block rounded-[2rem] overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white shadow-sm relative h-[22rem] sm:h-96">

      {/* Imagen full */}
      <div className="absolute inset-0 bg-[#1B4332]">
        {foto ? (
          <img src={foto} alt={cfg.comercio.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#52B788] flex items-center justify-center">
            <span className="text-7xl opacity-20">🍽️</span>
          </div>
        )}
      </div>
      
      {/* Overlay gradiente profundo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Badge abierto/cerrado + cupón superiores */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md border border-white/20 shadow-sm ${
          cfg.abierto
            ? 'bg-emerald-500/90 text-white'
            : 'bg-black/60 text-white/90'
        }`}>
          {cfg.abierto ? '● Abierto' : '○ Cerrado'}
        </span>
        {cfg.tieneCupon && (
          <span className="text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md bg-[#D4A017]/90 border border-white/20 text-white shadow-sm">
            🏷️ Cupón
          </span>
        )}
      </div>

      {/* Quitar de favoritos, o tiempo de entrega */}
      {onQuitarFavorito ? (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onQuitarFavorito(cfg.id) }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-red-500 hover:bg-white hover:scale-110 shadow-lg border border-white/40 transition-all"
          title="Quitar de favoritos"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      ) : (
        <div className="absolute top-4 right-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl px-3 py-2 shadow-xl border border-white/40">
            <p className="text-[10px] text-gray-500 font-medium leading-none mb-0.5 text-right">entrega</p>
            <p className="text-[#1A1A1A] font-black text-sm leading-none">~{cfg.tiempoPrepMinutos} min</p>
          </div>
        </div>
      )}

      {/* Info inferior superpuesta */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-end justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-white/80 text-xs font-semibold mb-1.5 uppercase tracking-widest flex items-center gap-1">
              <span>📍 {cfg.comercio.municipio}</span>
            </p>
            <h3 className="text-white font-black text-2xl leading-tight line-clamp-2 drop-shadow-md">{cfg.comercio.nombre}</h3>
          </div>
          {dist !== null && (
            <span className="text-white/90 text-[10px] flex-shrink-0 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full mb-1 border border-white/10">
              {formatearDistancia(dist)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/20 pt-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white text-sm font-bold">{inicial}</span>
            </div>

            <div className="flex flex-col">
              {cfg.comercio.calificacion > 0 ? (
                <>
                  <div className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span className="text-sm font-black text-white">{Number(cfg.comercio.calificacion).toFixed(1)}</span>
                  </div>
                  <span className="text-[10px] text-white/70 font-medium tracking-wide">RESEÑAS</span>
                </>
              ) : esNuevo ? (
                <span className="text-[10px] font-bold text-white bg-emerald-500/80 backdrop-blur-sm px-2 py-0.5 rounded border border-white/20">✨ Nuevo</span>
              ) : (
                <span className="text-[11px] text-white/50 font-medium">Sin reseñas</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {cfg.modalidades.includes('DOMICILIO') && (
              <span className="text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10 flex flex-col items-center leading-tight">
                <span>🛵</span>
                {Number(cfg.costoEnvioBase) === 0 ? 'Gratis' : formatearPrecio(Number(cfg.costoEnvioBase))}
              </span>
            )}
            {cfg.modalidades.includes('RECOGER') && (
              <span className="text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10 flex flex-col items-center leading-tight">
                <span>🏃</span>
                Recoger
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
