'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { SkeletonCard, EmptyState } from '@/components/ui'
import { listarProductos, listarCategorias } from '@/lib/api/productos'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'
import type { Categoria } from '@/types/categoria'
import BannerDisplay from '@/components/publicidad/BannerDisplay'

// Vitrina pública del vertical Agro (Capítulo 3, sección 3.4.1): reutiliza
// por completo el Producto/carrito/checkout del Marketplace — TERAVIA es la
// capa transaccional, no un directorio de productores paralelo. La única
// pieza nueva es GrupoCategoria.AGRO (mismo patrón que "Tienda Local").
export default function AgroPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [tardando, setTardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 6000)
    setCargando(true)
    setError(null)
    listarProductos({ grupo: 'AGRO', categoriaId: categoriaId || undefined, q: busqueda.trim() || undefined, porPagina: 24 })
      .then(({ items }) => setProductos(mapearProductos(items)))
      .catch(e => setError(e instanceof Error ? e.message : 'No pudimos cargar los productos.'))
      .finally(() => { setCargando(false); clearTimeout(t) })
    return () => clearTimeout(t)
  }, [categoriaId, busqueda])

  const [fotoHeroIdx, setFotoHeroIdx] = useState(0)

  const heroFotos = useMemo(() => {
    const urls = new Set<string>()
    productos.forEach((p: any) => {
      if (p.fotoUrl) urls.add(p.fotoUrl)
    })
    const arr = Array.from(urls)
    return arr.length > 0 ? arr : ['https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1600&q=80']
  }, [productos])

  useEffect(() => {
    if (heroFotos.length <= 1) return
    const id = setInterval(() => {
      setFotoHeroIdx(prev => (prev + 1) % heroFotos.length)
    }, 4000)
    return () => clearInterval(id)
  }, [heroFotos])

  const categoriasAgro = categorias.filter(c => c.grupo === 'AGRO')

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden min-h-[280px] sm:min-h-[320px] flex flex-col justify-end bg-[#111]">
        {heroFotos.map((url, idx) => (
          <img 
            key={url}
            src={url} 
            alt="Agro directo a tu mesa"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === fotoHeroIdx ? 'opacity-100' : 'opacity-0'}`} 
          />
        ))}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute top-0 right-0 p-12 opacity-30 pointer-events-none">
          <div className="w-72 h-72 bg-white/20 rounded-full blur-3xl mix-blend-overlay" />
        </div>

        <div className="relative max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#D4A017]/20 border border-[#D4A017]/30 text-[#D4A017] text-xs font-semibold px-3 py-1 rounded-full">
                  🌾 Del campo al Chocó
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Agro<br />
                <span className="text-[#52B788]">directo a tu mesa</span>
              </h1>
              <p className="text-white/55 text-sm mt-2.5 max-w-sm">
                Cacao, frutas, plantas medicinales y más — compra y paga con confianza, directo del productor.
              </p>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{productos.length > 0 ? `${productos.length}` : '–'}</p>
                <p className="text-white/50 text-xs">Productos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{categoriasAgro.length > 0 ? `${categoriasAgro.length}` : '–'}</p>
                <p className="text-white/50 text-xs">Categorías</p>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="mt-6 bg-white shadow-2xl rounded-2xl p-2 flex flex-col sm:flex-row gap-2 border border-gray-100 relative z-10">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Cacao, borojó, chontaduro…"
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-gray-900 placeholder-gray-400 text-sm font-medium focus:outline-none" />
            </div>
            <Link href="/comerciante/publicar"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#1B4332] text-white hover:bg-[#2D6A4F] transition-all whitespace-nowrap">
              ¿Vendes del campo? Publica gratis
            </Link>
          </div>
        </div>
      </div>

      {/* ── CATEGORÍAS ───────────────────────────────────────── */}
      {categoriasAgro.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setCategoriaId('')}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                categoriaId === '' ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]/40'
              }`}>
              Todas
            </button>
            {categoriasAgro.map(c => (
              <button key={c.id} onClick={() => setCategoriaId(c.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  categoriaId === c.id ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4332]/40'
                }`}>
                {c.icono} {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTENIDO ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {cargando && tardando && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4">
            ⏳ La API está despertando… puede tardar hasta 30 segundos la primera vez del día.
          </p>
        )}

        {error && !cargando && (
          <p className="text-xs text-center text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        {cargando ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : productos.length === 0 ? (
          <EmptyState
            titulo={busqueda || categoriaId ? 'Sin resultados' : 'Aún no hay productos de Agro'}
            descripcion={busqueda ? `No encontramos productos para "${busqueda}"` : categoriaId ? 'Ningún producto en esta categoría por ahora.' : 'Sé la primera persona en publicar un producto del campo.'}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {productos.map((p: any) => (
              p.esBannerDisplay ? (
                <div key={p.id} className="col-span-full mt-2 mb-2">
                  <BannerDisplay banner={p} />
                </div>
              ) : (
                <TarjetaProducto key={p.id} producto={p} mostrarBadgeVerificado />
              )
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
