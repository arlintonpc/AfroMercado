'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { obtenerTour, verificarDisponibilidadTour, crearReservaTour, misReservasTour, validarCuponTour, toggleFavoritoTour, esFavoritoTour, type ConfigTour, type ValidacionCuponTour, type TourLugar } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import SeccionReviewsTour from '@/components/tours/SeccionReviewsTour'
import { Toast, useToast } from '@/components/ui/Toast'
import ReproductorVideo from '@/components/comerciante/ReproductorVideo'

const SERVICIOS_LABELS: Record<string, { icon: string; label: string }> = {
  transporte:  { icon: '🚐', label: 'Transporte incluido' },
  almuerzo:    { icon: '🍱', label: 'Almuerzo incluido' },
  guia:        { icon: '🧭', label: 'Guía certificado' },
  equipo:      { icon: '🎒', label: 'Equipo incluido' },
  foto:        { icon: '📸', label: 'Fotografía' },
  seguro:      { icon: '🛡️', label: 'Seguro de viaje' },
  snacks:      { icon: '🍎', label: 'Snacks' },
  audio:       { icon: '🎧', label: 'Audioguía' },
}

/* ── Lightbox ──────────────────────────────────────────── */
function Lightbox({ fotos, inicial, onClose }: { fotos: string[]; inicial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(inicial)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + fotos.length) % fotos.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % fotos.length)
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fotos.length, onClose])

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors flex items-center gap-2 text-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          Cerrar
        </button>
        <span className="text-white/50 text-sm font-medium">{idx + 1} / {fotos.length}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative px-16" onClick={e => e.stopPropagation()}>
        <button onClick={() => setIdx(i => (i - 1 + fotos.length) % fotos.length)}
          className="absolute left-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <img src={fotos[idx]} alt="" className="max-h-[75vh] max-w-full object-contain rounded-xl" />
        <button onClick={() => setIdx(i => (i + 1) % fotos.length)}
          className="absolute right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="flex gap-2 px-6 pb-6 pt-3 overflow-x-auto flex-shrink-0 justify-center" onClick={e => e.stopPropagation()} style={{ scrollbarWidth: 'none' }}>
        {fotos.map((f, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 ${i === idx ? 'ring-2 ring-white opacity-100' : 'opacity-35 hover:opacity-60'}`}>
            <img src={f} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Hero carrusel ──────────────────────────────────────── */
function HeroCarrusel({ fotos, nombre, comercio, municipio, confirmacionAuto, esFavorito, autenticado, onFavorito, onShare, onOpenLightbox }: {
  fotos: string[]; nombre: string; comercio: string; municipio: string
  confirmacionAuto: boolean; esFavorito: boolean; autenticado: boolean
  onFavorito: () => void; onShare: () => void; onOpenLightbox: (idx: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const total = fotos.length

  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % total), 4500)
    return () => clearInterval(t)
  }, [total])

  const prev = () => setIdx(i => (i - 1 + total) % total)
  const next = () => setIdx(i => (i + 1) % total)

  const fondo = fotos[idx] ?? null

  return (
    <div className="relative h-[42vh] min-h-[280px] max-h-[440px] overflow-hidden bg-[#1B4332]">
      {/* Slides */}
      {fotos.length === 0 ? (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#52B788]" />
      ) : fotos.map((f, i) => (
        <img key={i} src={f} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0 }} />
      ))}

      {/* Gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/75" />

      {/* Nav superior */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
        <Link href="/tours"
          className="bg-black/30 backdrop-blur-md border border-white/15 text-white rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-1.5 hover:bg-black/50 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Tours
        </Link>
        <div className="flex items-center gap-2">
          {autenticado && (
            <button onClick={onFavorito}
              className="bg-black/30 backdrop-blur-md border border-white/15 text-white w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/50 transition-colors">
              <svg width="17" height="17" viewBox="0 0 24 24" fill={esFavorito ? '#E53E3E' : 'none'} stroke={esFavorito ? '#E53E3E' : 'white'} strokeWidth="2" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          )}
          <button onClick={onShare}
            className="bg-black/30 backdrop-blur-md border border-white/15 text-white w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/50 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>

      {/* Flechas de navegación (solo si hay más de 1 foto) */}
      {total > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm border border-white/15 text-white flex items-center justify-center hover:bg-black/55 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm border border-white/15 text-white flex items-center justify-center hover:bg-black/55 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </>
      )}

      {/* Info inferior */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10">
        {total > 1 && (
          <div className="flex gap-1.5 mb-3">
            {fotos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'bg-white w-6' : 'bg-white/40 w-1.5'}`} />
            ))}
          </div>
        )}
        <div className="flex items-end justify-between gap-3">
          <div>
            {confirmacionAuto && (
              <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full tracking-wide mb-2">
                ✓ CONFIRMACIÓN INMEDIATA
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-lg">{nombre}</h1>
            <p className="text-white/70 text-xs mt-1">{comercio} · {municipio}</p>
          </div>
          {total > 0 && (
            <button onClick={() => onOpenLightbox(idx)}
              className="flex-shrink-0 bg-black/30 backdrop-blur-sm border border-white/20 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/50 transition-colors whitespace-nowrap">
              🖼 {total} {total === 1 ? 'foto' : 'fotos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Parada individual ──────────────────────────────────── */
function TarjetaParada({ lugar, numero, onOpenFotos }: {
  lugar: TourLugar
  numero: number
  onOpenFotos: (fotos: string[], idx: number) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const fotos  = (lugar.media ?? []).filter(m => m.tipo === 'FOTO')
  const video  = (lugar.media ?? []).find(m => m.tipo === 'VIDEO')
  const links  = (lugar.media ?? []).filter(m => m.tipo === 'VIDEO_LINK')
  const portada = fotos[0]?.url ?? video?.posterUrl ?? null

  return (
    <div className="group">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full text-left"
      >
        <div className="flex gap-4 items-start">
          {/* Número + línea vertical */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-md transition-colors ${abierto ? 'bg-[#D4A017] text-white' : 'bg-[#1B4332] text-white'}`}>
              {numero}
            </div>
          </div>

          {/* Contenido principal */}
          <div className={`flex-1 pb-6 border-b border-gray-100 transition-all`}>
            <div className="flex items-start gap-3">
              {/* Miniatura */}
              {portada && (
                <div className="flex-shrink-0 w-20 h-16 rounded-xl overflow-hidden bg-gray-100">
                  <img src={portada} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {lugar.tipo && <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4A017]">{lugar.tipo}</span>}
                      {lugar.destacado && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">★ Destacado</span>}
                    </div>
                    <h4 className="font-black text-gray-900 text-base leading-tight">{lugar.titulo}</h4>
                    {!abierto && lugar.descripcion && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-1">{lugar.descripcion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lugar.duracionMinutos && (
                      <span className="text-xs text-gray-400 hidden sm:block">{lugar.duracionMinutos} min</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* Chips de media */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {fotos.length > 0 && <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{fotos.length} fotos</span>}
                  {video && <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">▶ video</span>}
                  {links.length > 0 && <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">🔗 {links.length}</span>}
                </div>
              </div>
            </div>

            {/* Contenido expandido */}
            {abierto && (
              <div className="mt-4 space-y-4">
                {lugar.descripcion && (
                  <p className="text-sm text-gray-600 leading-relaxed">{lugar.descripcion}</p>
                )}
                {lugar.recomendaciones && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-600 mb-1">Recomendación</p>
                    <p className="text-sm text-amber-900 leading-relaxed">{lugar.recomendaciones}</p>
                  </div>
                )}
                {fotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {fotos.slice(0, 8).map((foto, idx) => (
                      <button key={foto.id} type="button" onClick={() => onOpenFotos(fotos.map(f => f.url), idx)}
                        className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img src={foto.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                {video && (
                  <div className="overflow-hidden rounded-2xl bg-black">
                    <ReproductorVideo url={video.url} />
                  </div>
                )}
                {links.map(link => {
                  const embeddable = /youtube\.com|youtu\.be|vimeo\.com/.test(link.url)
                  if (embeddable) return (
                    <div key={link.id} className="overflow-hidden rounded-2xl bg-black">
                      <ReproductorVideo url={link.url} />
                    </div>
                  )
                  return (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#2D6A4F] text-sm font-semibold underline">
                      Ver en {link.plataforma || 'video'} →
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}

/* ── Sección de rutas ───────────────────────────────────── */
function SeccionRutas({ lugares, onOpenFotos }: { lugares: TourLugar[]; onOpenFotos: (fotos: string[], idx: number) => void }) {
  const activos = lugares.filter(l => l.activo !== false).sort((a, b) => a.orden - b.orden)
  if (!activos.length) return null

  const tieneRutas = activos.some(l => l.rutaNombre)
  const grupos: { rutaNombre: string | null; lugares: TourLugar[] }[] = []
  for (const lugar of activos) {
    const clave = lugar.rutaNombre ?? null
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.rutaNombre === clave) ultimo.lugares.push(lugar)
    else grupos.push({ rutaNombre: clave, lugares: [lugar] })
  }

  let contadorGlobal = 0

  return (
    <section>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-black tracking-[0.2em] uppercase text-[#D4A017] mb-1">Itinerario</p>
          <h2 className="text-2xl font-black text-gray-900">Paradas del recorrido</h2>
        </div>
        <span className="text-sm text-gray-400 font-medium">{activos.length} paradas</span>
      </div>

      <div className="space-y-0">
        {grupos.map((grupo, gIdx) => (
          <div key={grupo.rutaNombre ?? '__sin_ruta__'}>
            {tieneRutas && (
              <div className={`flex items-center gap-3 mb-4 ${gIdx > 0 ? 'mt-8 pt-6 border-t border-dashed border-[#E8DCC8]' : ''}`}>
                <div className="h-px flex-1 bg-[#E8DCC8]" />
                <span className="text-xs font-black uppercase tracking-widest text-[#B7791F] px-2">
                  {grupo.rutaNombre ?? 'Paradas generales'}
                </span>
                <div className="h-px flex-1 bg-[#E8DCC8]" />
              </div>
            )}
            {grupo.lugares.map(lugar => {
              contadorGlobal++
              return (
                <TarjetaParada
                  key={lugar.id}
                  lugar={lugar}
                  numero={contadorGlobal}
                  onOpenFotos={onOpenFotos}
                />
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Widget reserva lateral ─────────────────────────────── */
function WidgetReservaTour({ tour, onReservar, autenticado, router }: {
  tour: ConfigTour; onReservar: () => void; autenticado: boolean; router: any
}) {
  const [fecha, setFecha]      = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0])
  const [participantes, setP]  = useState(1)
  const [disponibilidad, setD] = useState<{ disponibles: number; maxParticipantes: number } | null>(null)

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTour(tour.id, fecha).then(setD).catch(() => setD(null))
  }, [fecha, tour.id])

  const total = Number(tour.precioPersona) * participantes

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/60 p-6 sticky top-24">
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-3xl font-black text-gray-900">{formatearPrecio(Number(tour.precioPersona))}</span>
        <span className="text-gray-400 text-sm">/ persona</span>
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Fecha</label>
        <input type="date" min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
          value={fecha} onChange={e => setFecha(e.target.value)}
          className="w-full border border-gray-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1B4332] bg-white" />
      </div>

      {disponibilidad !== null && (
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold mb-3 ${disponibilidad.disponibles > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {disponibilidad.disponibles > 0
            ? `✓ ${disponibilidad.disponibles} cupos disponibles`
            : '✗ Sin cupos para esta fecha'}
        </div>
      )}

      <div className="mb-5">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Participantes</label>
        <div className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-2.5">
          <button onClick={() => setP(p => Math.max(1, p - 1))}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors text-lg">−</button>
          <span className="flex-1 text-center font-bold text-base">{participantes}</span>
          <button onClick={() => setP(p => Math.min(tour.maxParticipantes, disponibilidad?.disponibles ?? tour.maxParticipantes, p + 1))}
            className="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center font-bold text-[#16A34A] hover:bg-[#D1FAE5] transition-colors text-lg">+</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Máx. {tour.maxParticipantes} personas</p>
      </div>

      <button onClick={() => { if (!autenticado) { router.push('/ingresar'); return }; onReservar() }}
        className="w-full bg-[#1B4332] hover:bg-[#15362A] text-white font-bold py-4 rounded-2xl text-base transition-all active:scale-[0.98] shadow-md mb-4">
        Reservar cupo
      </button>

      <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4 mb-4">
        <div className="flex justify-between">
          <span>{formatearPrecio(Number(tour.precioPersona))} × {participantes}</span>
          <span>{formatearPrecio(total)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 text-base">
          <span>Total</span>
          <span>{formatearPrecio(total)}</span>
        </div>
      </div>

      {tour.comercio.whatsapp && (
        <a href={`https://wa.me/57${tour.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el tour "${tour.nombre}". ¿Tienen disponibilidad?`)}`}
          target="_blank" rel="noopener"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[#128C7E] font-semibold text-sm border border-[#25D366]/30 hover:bg-[#F0FDF4] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Consultar por WhatsApp
        </a>
      )}
      <p className="text-[10px] text-center text-gray-400 mt-3">Sin cobros ocultos · Pago en el lugar</p>
    </div>
  )
}

/* ── Modal de reserva ───────────────────────────────────── */
function FormReservaTour({ tour, onClose, onSuccess }: { tour: ConfigTour; onClose: () => void; onSuccess: () => void }) {
  const { usuario } = useAuth()
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [fecha, setFecha]           = useState(manana)
  const [participantes, setP]       = useState(1)
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [notas, setNotas]           = useState('')
  const [nombre, setNombre]         = useState(usuario?.nombre ?? '')
  const [telefono, setTelefono]     = useState(usuario?.telefono?.replace(/\D/g, '').replace(/^57/, '') ?? '')
  const [disponibilidad, setD]      = useState<{ disponibles: number; maxParticipantes: number } | null>(null)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState('')
  const [codigoCupon, setCodigoCupon]       = useState('')
  const [cuponAplicado, setCuponAplicado]   = useState<ValidacionCuponTour | null>(null)
  const [validandoCupon, setValidandoCupon] = useState(false)
  const [errorCupon, setErrorCupon]         = useState<string | null>(null)
  const [mostrarCupon, setMostrarCupon]     = useState(false)

  const subtotal = Number(tour.precioPersona) * participantes
  const total = cuponAplicado ? cuponAplicado.subtotalConDescuento : subtotal

  async function aplicarCupon() {
    if (!codigoCupon.trim()) return
    setValidandoCupon(true); setErrorCupon(null)
    try {
      const v = await validarCuponTour(codigoCupon.trim(), tour.id, participantes)
      setCuponAplicado(v)
    } catch (e: any) {
      setErrorCupon(e?.message ?? 'Cupón inválido'); setCuponAplicado(null)
    } finally { setValidandoCupon(false) }
  }

  useEffect(() => {
    if (!fecha) return
    verificarDisponibilidadTour(tour.id, fecha).then(setD).catch(() => setD(null))
  }, [fecha, tour.id])

  async function handleReservar() {
    if (!nombre.trim() || !telefono.trim()) { setError('Completa nombre y teléfono'); return }
    setError(''); setCargando(true)
    try {
      await crearReservaTour({ configTourId: tour.id, fechaTour: fecha, participantes, metodoPago, notasCliente: notas || undefined, nombreContacto: nombre.trim(), telefonoContacto: telefono.trim(), codigoCupon: cuponAplicado ? codigoCupon.trim() : undefined })
      onSuccess()
    } catch (e: any) { setError(e.message) } finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6" onClick={onClose}>
      <div className="bg-white w-full lg:max-w-lg max-h-[93vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center py-3 lg:hidden"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xl text-gray-900">{tour.nombre}</h3>
            <p className="text-sm text-[#1B4332] font-semibold mt-0.5">{formatearPrecio(Number(tour.precioPersona))}<span className="text-gray-400 font-normal"> / persona</span></p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-xl font-bold">×</button>
        </div>
        <div className="px-6 pt-5 pb-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Fecha del tour</label>
            <input type="date" min={manana} value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332]" />
          </div>
          {disponibilidad !== null && (
            <div className={`rounded-xl p-4 flex items-center justify-between border ${disponibilidad.disponibles > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-sm font-semibold ${disponibilidad.disponibles > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {disponibilidad.disponibles > 0 ? `✓ ${disponibilidad.disponibles} cupos disponibles` : '✗ Sin cupos para esta fecha'}
              </p>
              <p className="font-black text-2xl text-gray-900">{formatearPrecio(total)}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Participantes (máx. {tour.maxParticipantes})</label>
            <div className="flex items-center gap-4 border border-gray-200 rounded-2xl px-4 py-3">
              <button onClick={() => setP(p => Math.max(1, p - 1))} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">−</button>
              <span className="flex-1 text-center font-bold text-lg">{participantes}</span>
              <button onClick={() => setP(p => Math.min(tour.maxParticipantes, disponibilidad?.disponibles ?? tour.maxParticipantes, p + 1))} className="w-9 h-9 rounded-full bg-[#ECFDF5] flex items-center justify-center font-bold text-[#16A34A] hover:bg-[#D1FAE5] transition-colors">+</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nombre de contacto</label>
              <input type="text" autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo"
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Teléfono</label>
              <input type="tel" autoComplete="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="3001234567"
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Método de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] bg-white">
              <option value="EFECTIVO">💵  Efectivo al llegar</option>
              <option value="NEQUI">📱  Nequi</option>
              <option value="TRANSFERENCIA">🏦  Transferencia bancaria</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notas especiales (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Alergias, necesidades especiales…"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B4332] resize-none" />
          </div>
          <div>
            {cuponAplicado ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm font-bold text-green-700">✅ {cuponAplicado.cupon.codigo}</p>
                  <p className="text-xs text-green-600">-{formatearPrecio(cuponAplicado.descuento)}{cuponAplicado.cupon.tipo === 'PORCENTAJE' ? ` (${Number(cuponAplicado.cupon.valor)}%)` : ''}</p>
                </div>
                <button onClick={() => { setCuponAplicado(null); setCodigoCupon(''); setMostrarCupon(false) }} className="text-xs text-red-500">Quitar</button>
              </div>
            ) : !mostrarCupon ? (
              <button onClick={() => setMostrarCupon(true)} className="text-xs text-[#2D6A4F] underline hover:text-[#1B4332]">
                ¿Tienes un código de descuento?
              </button>
            ) : (
              <div className="flex gap-2">
                <input value={codigoCupon} onChange={e => setCodigoCupon(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && aplicarCupon()}
                  placeholder="Código de descuento" autoFocus
                  className="flex-1 border border-[#E8DCC8] rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#2D6A4F]" />
                <button onClick={aplicarCupon} disabled={validandoCupon || !codigoCupon.trim()}
                  className="px-3 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-sm font-semibold disabled:opacity-50">
                  {validandoCupon ? '...' : 'Aplicar'}
                </button>
              </div>
            )}
            {errorCupon && <p className="text-xs text-red-600 mt-1">{errorCupon}</p>}
          </div>
          <div className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>{formatearPrecio(Number(tour.precioPersona))} × {participantes} pers.</span>
              <span>{formatearPrecio(subtotal)}</span>
            </div>
            {cuponAplicado && (
              <>
                <div className="flex justify-between text-green-700 mt-1">
                  <span>Descuento ({cuponAplicado.cupon.codigo})</span>
                  <span>-{formatearPrecio(cuponAplicado.descuento)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 mt-1 pt-1 border-t border-gray-200">
                  <span>Total</span><span>{formatearPrecio(cuponAplicado.subtotalConDescuento)}</span>
                </div>
              </>
            )}
          </div>
          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
          <button onClick={handleReservar} disabled={cargando || (disponibilidad !== null && disponibilidad.disponibles < participantes)}
            className="w-full bg-[#1B4332] text-white font-bold py-4 rounded-2xl text-base hover:bg-[#15362A] transition-colors disabled:opacity-50 active:scale-[0.98] shadow-md">
            {cargando ? 'Procesando…' : tour.confirmacionAuto ? 'Confirmar reserva' : 'Solicitar reserva'}
          </button>
          {!tour.confirmacionAuto && (
            <p className="text-xs text-center text-gray-400">El operador confirmará en máx. {tour.horasLimiteConfirm} horas</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── PÁGINA PRINCIPAL ───────────────────────────────────── */
export default function TourDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { autenticado, usuario } = useAuth()

  const [tour, setTour]               = useState<ConfigTour | null>(null)
  const [cargando, setCargando]       = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [reservado, setReservado]     = useState(false)
  const [reservaElegibleId, setReservaElegibleId] = useState<number | undefined>()
  const [lightbox, setLightbox]       = useState<{ fotos: string[]; idx: number } | null>(null)
  const [esFavorito, setEsFavorito]   = useState(false)
  const { mostrar: mostrarToast, toastProps } = useToast()

  useEffect(() => {
    obtenerTour(Number(id)).then(d => { setTour(d); setCargando(false) }).catch(() => setCargando(false))
    if (autenticado) esFavoritoTour(Number(id)).then(setEsFavorito).catch(() => {})
  }, [id, autenticado])

  useEffect(() => {
    if (tour?.nombre) document.title = `${tour.nombre} — Tours AfroMercado`
    return () => { document.title = 'AfroMercado' }
  }, [tour?.nombre])

  useEffect(() => {
    if (!usuario || !tour) return
    misReservasTour().then(rs => {
      const elegible = rs.find(r => r.configTourId === tour.id && r.estado === 'COMPLETADA' && !r.review)
      setReservaElegibleId(elegible?.id)
    }).catch(() => {})
  }, [usuario, tour])

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: tour!.nombre, url }) } catch {} }
    else { navigator.clipboard.writeText(url).catch(() => {}); mostrarToast('¡Enlace copiado!') }
  }

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#1B4332] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    </div>
  )

  if (!tour) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FAF8F5]">
      <div className="w-20 h-20 rounded-full bg-[#E8DCC8] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
      </div>
      <p className="font-bold text-gray-600">Tour no encontrado</p>
      <Link href="/tours" className="text-[#1B4332] text-sm underline">Volver al listado</Link>
    </div>
  )

  const tieneVideo = !!(tour as any).videoUrl
  const lugares = tour.lugares ?? []

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {lightbox && <Lightbox fotos={lightbox.fotos} inicial={lightbox.idx} onClose={() => setLightbox(null)} />}

      {/* ── HERO CARRUSEL ───────────────────────────────────── */}
      <HeroCarrusel
        fotos={tour.fotos}
        nombre={tour.nombre}
        comercio={tour.comercio.nombre}
        municipio={tour.comercio.municipio}
        confirmacionAuto={tour.confirmacionAuto}
        esFavorito={esFavorito}
        autenticado={autenticado}
        onFavorito={async () => { try { const r = await toggleFavoritoTour(Number(id)); setEsFavorito(r.esFavorito) } catch {} }}
        onShare={handleShare}
        onOpenLightbox={(idx) => setLightbox({ fotos: tour.fotos, idx })}
      />

      {/* ── BARRA DE STATS ────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#F0F7F3] flex items-center justify-center text-[#1B4332]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Duración</p>
              <p className="text-sm font-black text-gray-900">{tour.duracionHoras}h</p>
            </div>
          </div>
          <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#F0F7F3] flex items-center justify-center text-[#1B4332]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Grupo</p>
              <p className="text-sm font-black text-gray-900">Máx. {tour.maxParticipantes}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#FEF9EC] flex items-center justify-center text-[#D4A017]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Precio</p>
              <p className="text-sm font-black text-[#D4A017]">{formatearPrecio(Number(tour.precioPersona))}/pers.</p>
            </div>
          </div>
          {Number(tour.comercio.totalReviews) > 0 && (
            <>
              <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Calificación</p>
                  <p className="text-sm font-black text-gray-900">{Number(tour.comercio.calificacion).toFixed(1)} <span className="text-gray-400 font-normal text-[11px]">({tour.comercio.totalReviews})</span></p>
                </div>
              </div>
            </>
          )}
          {tour.idiomas.length > 0 && (
            <>
              <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-[#F0F7F3] flex items-center justify-center text-[#1B4332] text-sm">💬</div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Idioma</p>
                  <p className="text-sm font-black text-gray-900">{tour.idiomas[0]}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL ────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 py-8 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start">

        {/* Columna izquierda */}
        <div className="space-y-10">

          {/* Descripción */}
          {tour.descripcion && (
            <section>
              <p className="text-gray-600 text-base leading-relaxed">{tour.descripcion}</p>
            </section>
          )}

          {/* Operador */}
          <section className="flex items-center gap-4 bg-white rounded-3xl p-5 border border-gray-100">
            {tour.comercio.logoUrl ? (
              <img src={tour.comercio.logoUrl} alt={tour.comercio.nombre} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 bg-gray-100" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-xl">{tour.comercio.nombre.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Operado por</p>
              <p className="font-black text-gray-900 text-base">{tour.comercio.nombre}</p>
              <p className="text-sm text-gray-500">{tour.comercio.municipio}{tour.comercio.departamento ? `, ${tour.comercio.departamento}` : ''}</p>
            </div>
            {tour.comercio.whatsapp && (
              <a href={`https://wa.me/57${tour.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el tour "${tour.nombre}"`)}`}
                target="_blank" rel="noopener"
                className="flex-shrink-0 bg-[#25D366] text-white rounded-2xl px-4 py-2.5 text-sm font-bold hover:bg-[#20b858] transition-colors">
                WhatsApp
              </a>
            )}
          </section>

          {/* Video del tour */}
          {tieneVideo && (
            <section>
              <p className="text-xs font-black tracking-[0.2em] uppercase text-[#D4A017] mb-3">Video del tour</p>
              <div className="overflow-hidden rounded-3xl bg-black shadow-xl">
                <ReproductorVideo url={(tour as any).videoUrl} />
              </div>
            </section>
          )}

          {/* Fotos adicionales */}
          {tour.fotos.length > 1 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black tracking-[0.2em] uppercase text-[#D4A017]">Galería</p>
                <button onClick={() => setLightbox({ fotos: tour.fotos, idx: 0 })} className="text-xs text-[#2D6A4F] font-semibold hover:underline">
                  Ver todas ({tour.fotos.length})
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {tour.fotos.slice(1, 7).map((foto, i) => (
                  <button key={i} onClick={() => setLightbox({ fotos: tour.fotos, idx: i + 1 })}
                    className="aspect-square rounded-2xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                    <img src={foto} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Lo que incluye */}
          {tour.servicios.length > 0 && (
            <section>
              <p className="text-xs font-black tracking-[0.2em] uppercase text-[#D4A017] mb-4">Lo que incluye</p>
              <div className="grid grid-cols-2 gap-3">
                {tour.servicios.map(s => {
                  const info = SERVICIOS_LABELS[s]
                  return (
                    <div key={s} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100">
                      <span className="text-xl w-7 text-center flex-shrink-0">{info?.icon ?? '✓'}</span>
                      <span className="text-sm font-medium text-gray-700">{info?.label ?? s}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Punto de encuentro */}
          {tour.puntoEncuentro && (
            <section className="bg-white rounded-3xl p-5 border border-gray-100">
              <p className="text-xs font-black tracking-[0.2em] uppercase text-[#D4A017] mb-3">Punto de encuentro</p>
              <div className="flex items-start gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="none" className="mt-0.5 flex-shrink-0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                <p className="text-gray-700 font-medium text-sm">{tour.puntoEncuentro}</p>
              </div>
            </section>
          )}

          {/* Política de cancelación */}
          {tour.politicaCancelacion && (
            <section className="bg-amber-50 border border-amber-100 rounded-3xl p-5">
              <p className="text-xs font-black tracking-[0.2em] uppercase text-amber-600 mb-2">Cancelación</p>
              <p className="text-sm text-amber-900 leading-relaxed">{tour.politicaCancelacion}</p>
            </section>
          )}

          {/* Paradas / Rutas */}
          {lugares.length > 0 && (
            <section className="bg-white rounded-3xl p-6 border border-gray-100">
              <SeccionRutas lugares={lugares} onOpenFotos={(fotos, idx) => setLightbox({ fotos, idx })} />
            </section>
          )}

          {/* Reseñas */}
          <section>
            <SeccionReviewsTour configTourId={tour.id} reservaElegibleId={reservaElegibleId} />
          </section>

          {/* WhatsApp mobile */}
          {tour.comercio.whatsapp && (
            <div className="lg:hidden pb-28">
              <a href={`https://wa.me/57${tour.comercio.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el tour "${tour.nombre}". ¿Tienen disponibilidad?`)}`}
                target="_blank" rel="noopener"
                className="flex items-center gap-3 justify-center w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Hablar con el operador por WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Columna derecha — widget reserva */}
        <div className="hidden lg:block">
          <WidgetReservaTour tour={tour} onReservar={() => setMostrarForm(true)} autenticado={autenticado} router={router} />
        </div>
      </div>

      {/* ── BARRA FLOTANTE MOBILE ────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 px-5 py-3 flex items-center gap-4 shadow-2xl">
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-gray-900">{formatearPrecio(Number(tour.precioPersona))}</span>
            <span className="text-gray-400 text-sm">/ persona</span>
          </div>
          {Number(tour.comercio.totalReviews) > 0 && (
            <p className="text-xs text-gray-400">★ {Number(tour.comercio.calificacion).toFixed(1)} · {tour.comercio.totalReviews} reseñas</p>
          )}
        </div>
        {reservado ? (
          <Link href="/tours/mis-reservas" className="bg-[#1B4332] text-white font-bold px-5 py-3.5 rounded-2xl text-sm">Ver reserva</Link>
        ) : (
          <button onClick={() => { if (!autenticado) { router.push('/ingresar'); return }; setMostrarForm(true) }}
            className="bg-[#1B4332] text-white font-bold px-7 py-3.5 rounded-2xl text-sm hover:bg-[#15362A] transition-colors active:scale-[0.97] shadow-md">
            Reservar cupo
          </button>
        )}
      </div>

      {/* Modal de reserva */}
      {mostrarForm && !reservado && (
        <FormReservaTour tour={tour} onClose={() => setMostrarForm(false)} onSuccess={() => { setMostrarForm(false); setReservado(true) }} />
      )}

      {/* Confirmación */}
      {reservado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="font-black text-2xl text-gray-900 mb-2">¡Reserva enviada!</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              {tour.confirmacionAuto ? 'Tu reserva fue confirmada. ¡Disfruta el tour!' : `El operador te confirmará en máx. ${tour.horasLimiteConfirm} horas.`}
            </p>
            <div className="flex flex-col gap-3">
              <a href={`https://wa.me/?text=${encodeURIComponent(`¡Reservé en AfroMercado! 🎉\n${tour.nombre}`)}`} target="_blank" rel="noopener"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-2xl font-semibold text-sm hover:bg-[#20b858] transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Compartir por WhatsApp
              </a>
              <div className="flex gap-3">
                <button onClick={() => setReservado(false)} className="flex-1 border border-gray-200 rounded-2xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Seguir viendo</button>
                <Link href="/tours/mis-reservas" className="flex-1 bg-[#1B4332] text-white rounded-2xl py-3 text-sm font-bold text-center hover:bg-[#15362A] transition-colors">Ver reserva</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast {...toastProps} />
    </div>
  )
}
