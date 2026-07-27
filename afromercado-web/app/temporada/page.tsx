'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { EmptyState, SkeletonCard } from '@/components/ui'
import { listarProductos } from '@/lib/api/productos'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'

const RADIO_CERCA_KM = 250

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function PaginaTemporada() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<'MAYOR_DESCUENTO' | 'MENOR_PRECIO' | 'RECIENTES'>('MAYOR_DESCUENTO')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [gpsCiudad, setGpsCiudad] = useState('')
  const [gpsCargando, setGpsCargando] = useState(false)

  async function activarGPS() {
    if (!navigator.geolocation) return
    setGpsCargando(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setUserLat(pos.coords.latitude)
        setUserLon(pos.coords.longitude)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          const j = await res.json()
          const ciudad = (j.address?.city || j.address?.town || j.address?.village || j.address?.county || '').replace(/^(Perímetro Urbano|Municipio de|Corregimiento de)\s+/i, '').trim()
          setGpsCiudad(ciudad)
        } catch {}
        setGpsCargando(false)
      },
      () => setGpsCargando(false)
    )
  }

  function limpiarGPS() {
    setUserLat(null)
    setUserLon(null)
    setGpsCiudad('')
  }

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    listarProductos({ enOferta: true, q: busqueda.trim() || undefined, porPagina: 48 })
      .then(({ items }) => {
        if (!cancelado) setProductos(mapearProductos(items).filter(p => p.oferta))
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No pudimos cargar la temporada.')
          setProductos([])
        }
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [busqueda])

  let productosFiltrados = [...productos].sort((a, b) => {
    if (orden === 'MAYOR_DESCUENTO') {
      const descA = a.oferta?.tipo === 'PORCENTAJE' ? a.oferta.valor : (a.oferta ? Math.round(((a.precio - a.oferta.precioFinal) / a.precio) * 100) : 0)
      const descB = b.oferta?.tipo === 'PORCENTAJE' ? b.oferta.valor : (b.oferta ? Math.round(((b.precio - b.oferta.precioFinal) / b.precio) * 100) : 0)
      return descB - descA
    }
    if (orden === 'MENOR_PRECIO') {
      return a.precio - b.precio
    }
    return Number(b.id) - Number(a.id)
  })

  if (userLat != null && userLon != null) {
    productosFiltrados = [...productosFiltrados].sort((a: any, b: any) => {
      const da = a.comercio?.latitud && a.comercio?.longitud ? distanciaKm(userLat, userLon, a.comercio.latitud, a.comercio.longitud) : 9999
      const db = b.comercio?.latitud && b.comercio?.longitud ? distanciaKm(userLat, userLon, b.comercio.latitud, b.comercio.longitud) : 9999
      return da - db
    })
  }

  const cercanos = userLat != null && userLon != null
    ? productosFiltrados.filter((p: any) => p.comercio?.latitud && p.comercio?.longitud && distanciaKm(userLat, userLon, p.comercio.latitud, p.comercio.longitud) <= RADIO_CERCA_KM)
    : productosFiltrados

  const listadoFinal = cercanos

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1">
        <section className="bg-white border-b border-[#1A1A1A]/5">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <p className="text-[#2D6A4F] text-xs font-semibold tracking-widest uppercase mb-2">
              Tiempo limitado
            </p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                  Temporada Teravia
                </h1>
                <p className="mt-2 max-w-2xl text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed">
                  Productos con precio especial por tiempo limitado, publicados por productores de todo el país.
                </p>
              </div>
              <Link href="/" className="self-start md:self-auto text-sm font-semibold text-[#2D6A4F] hover:underline">
                Volver al catálogo
              </Link>
            </div>

            {/* Barra de búsqueda y filtros de temporada */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar en ofertas de temporada (ej. cacao, pescado, camarones)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>

              <button
                type="button"
                onClick={userLat ? limpiarGPS : activarGPS}
                disabled={gpsCargando}
                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  userLat
                    ? 'bg-[#2D6A4F] text-white shadow-md'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-[#2D6A4F]'
                }`}
                title="Buscar ofertas más cercanas a tu ubicación"
              >
                {gpsCargando ? (
                  <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                )}
                <span>{gpsCiudad ? `📍 ${gpsCiudad}` : userLat ? '📍 Cerca de mí' : 'Ofertas cerca de mí'}</span>
              </button>

              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as any)}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#1A1A1A] focus:outline-none focus:border-[#2D6A4F]"
              >
                <option value="MAYOR_DESCUENTO">🔥 Mayor % de descuento</option>
                <option value="MENOR_PRECIO">💰 Menor precio</option>
                <option value="RECIENTES">✨ Más recientes</option>
              </select>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto w-full px-4 md:px-6 py-8 flex flex-col gap-6">
          {!cargando && !error && listadoFinal.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#1A1A1A]/55">
                {listadoFinal.length} {listadoFinal.length === 1 ? 'producto vigente' : 'productos vigentes'}{userLat ? <span className="text-[#2D6A4F]"> · a menos de {RADIO_CERCA_KM}km de tu ubicación</span> : ''}
              </p>
            </div>
          )}

          {cargando && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {error && !cargando && (
            <EmptyState
              titulo="No pudimos cargar la temporada"
              descripcion={error}
            />
          )}

          {!cargando && !error && userLat != null && listadoFinal.length === 0 && productos.length > 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 max-w-md mx-auto">
              <div className="w-16 h-16 bg-[#2D6A4F]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Nada cerca de ti todavía</h3>
              <p className="text-xs text-gray-500 mt-1 mb-5 leading-relaxed">
                No hay ofertas de temporada a menos de {RADIO_CERCA_KM}km de tu ubicación actual.
              </p>
              <button
                onClick={limpiarGPS}
                className="px-5 py-2.5 bg-[#2D6A4F] text-white text-xs font-bold rounded-xl hover:bg-[#1B4332] transition-all shadow-md"
              >
                Ver todas las ofertas de temporada
              </button>
            </div>
          )}

          {!cargando && !error && listadoFinal.length === 0 && (userLat == null || productos.length === 0) && (
            <EmptyState
              titulo="No se encontraron productos de temporada"
              descripcion="Prueba modificando la búsqueda o el filtro de ubicación."
            />
          )}

          {!cargando && !error && listadoFinal.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listadoFinal.map(producto => (
                <TarjetaProducto key={producto.id} producto={producto} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
