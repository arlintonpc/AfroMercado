'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { urlComoLlegar } from '@/lib/comoLlegar'
import { obtenerComercioDirectorio, type ComercioDirectorioDetalle } from '@/lib/api/directorio'

const ETIQUETA_TIPO: Record<string, string> = {
  CONSEJO_COMUNITARIO: 'Consejo Comunitario',
  RESGUARDO_INDIGENA: 'Resguardo Indígena',
  ZONA_RESERVA_CAMPESINA: 'Zona de Reserva Campesina',
  OTRA: 'Otra organización territorial',
}

export default function DetalleComercioDirectorioPage() {
  const params = useParams()
  const id = Number(params.id)
  const [comercio, setComercio] = useState<ComercioDirectorioDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCargando(true)
    obtenerComercioDirectorio(id)
      .then(setComercio)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No pudimos cargar este comercio.'))
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#F7F5F2] flex items-center justify-center py-24">
          <p className="text-sm text-gray-400">Cargando...</p>
        </main>
        <Footer />
      </>
    )
  }

  if (error || !comercio) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#F7F5F2] flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-sm text-gray-500">{error ?? 'Comercio no encontrado.'}</p>
          <Link href="/directorio" className="text-sm font-semibold text-[#2D6A4F] hover:underline">← Volver al directorio</Link>
        </main>
        <Footer />
      </>
    )
  }

  const rating = Number(comercio.calificacion)
  const categorias = Array.from(new Set(comercio.productos.map(p => p.categoria?.nombre).filter(Boolean)))
  const direccionTexto = `${comercio.municipio}${comercio.departamento ? `, ${comercio.departamento}` : ''}, Colombia`

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F7F5F2]">
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white">
          <div className="max-w-4xl mx-auto px-4 py-10">
            <Link href="/directorio" className="text-white/70 text-sm hover:text-white transition-colors">← Directorio</Link>
            <div className="flex items-start gap-4 mt-4">
              {comercio.logoUrl ? (
                <img src={comercio.logoUrl} alt={comercio.nombre} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 border-2 border-white/20" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-bold flex-shrink-0">
                  {comercio.nombre.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-dm-serif)' }}>{comercio.nombre}</h1>
                <p className="text-white/70 text-sm mt-1">
                  {comercio.vereda ? `${comercio.vereda}, ` : ''}{comercio.municipio}{comercio.departamento ? `, ${comercio.departamento}` : ''}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {rating > 0 && (
                    <span className="text-[#D4A017] text-sm font-semibold">★ {rating.toFixed(1)} <span className="text-white/60 font-normal">({comercio.totalReviews} reseñas)</span></span>
                  )}
                  {comercio.verificadoEtnico && (
                    <span className="rounded-full bg-[#FDF6E3] border border-[#F4C842] text-[#854D0E] text-[11px] font-semibold px-2.5 py-1">
                      Comunidad étnica verificada
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="grid gap-6 md:grid-cols-[1fr_280px]">
            <div className="space-y-6">
              {comercio.organizacionTerritorialTipo && (
                <div className="bg-[#FDF6E3] border border-[#F4C842] rounded-xl px-4 py-3 text-sm text-[#854D0E]">
                  {ETIQUETA_TIPO[comercio.organizacionTerritorialTipo] ?? comercio.organizacionTerritorialTipo}
                </div>
              )}

              {comercio.descripcion && (
                <div>
                  <h2 className="font-bold text-[#1A1A1A] mb-2">Sobre este comercio</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{comercio.descripcion}</p>
                </div>
              )}

              {comercio.historia && (
                <div>
                  <h2 className="font-bold text-[#1A1A1A] mb-2">Historia</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{comercio.historia}</p>
                </div>
              )}

              {categorias.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categorias.map((cat) => (
                    <span key={cat} className="text-xs bg-[#F7F5F2] text-gray-600 rounded-full px-3 py-1">{cat}</span>
                  ))}
                </div>
              )}

              {comercio.productos.length > 0 && (
                <div>
                  <h2 className="font-bold text-[#1A1A1A] mb-3">Productos destacados</h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {comercio.productos.map((p) => (
                      <div key={p.id} className="bg-white rounded-xl border border-[#E8DCC8] overflow-hidden">
                        {p.fotoUrl ? (
                          <img src={p.fotoUrl} alt={p.nombre} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-[#F0EBE3] flex items-center justify-center text-2xl">📦</div>
                        )}
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-[#1A1A1A] truncate">{p.nombre}</p>
                          <p className="text-xs text-[#2D6A4F] font-bold mt-0.5">{formatearPrecio(Number(p.precio))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <a
                href={urlComoLlegar(comercio.latitud, comercio.longitud, direccionTexto)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-white border border-[#E8DCC8] text-[#1B4332] font-semibold text-sm px-4 py-3 rounded-xl hover:bg-[#F7F5F2] transition-colors"
              >
                📍 Cómo llegar
              </a>
              {comercio.whatsappVisible && comercio.whatsapp && (
                <a
                  href={`https://wa.me/57${comercio.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#2D6A4F] text-white font-semibold text-sm px-4 py-3 rounded-xl hover:bg-[#1B4332] transition-colors"
                >
                  Contactar por WhatsApp
                </a>
              )}
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
