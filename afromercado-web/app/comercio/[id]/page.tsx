'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TarjetaProducto from '@/components/catalogo/TarjetaProducto'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { mapearProductos } from '@/lib/mapearProducto'
import type { Producto } from '@/types/producto'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

interface ComercioPublico {
  id: number
  nombre: string
  descripcion?: string | null
  historia?: string | null
  municipio: string
  logoUrl?: string | null
  whatsapp?: string | null
  calificacion: string | number
  totalReviews: number
  totalVentas: number
  verificado: boolean
}

async function fetchComercio(id: string): Promise<ComercioPublico | null> {
  const r = await fetch(`${API_URL}/comercios/${id}`, { cache: 'no-store' })
  if (!r.ok) return null
  const j = await r.json()
  return j?.comercio ?? null
}

async function fetchProductos(comercioId: number): Promise<Producto[]> {
  const r = await fetch(`${API_URL}/productos?comercioId=${comercioId}&porPagina=50`, {
    cache: 'no-store',
  })
  if (!r.ok) return []
  const j = await r.json()
  return mapearProductos(j?.productos ?? [])
}

// ── Estrellas ─────────────────────────────────────────────────

function Estrellas({ valor }: { valor: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= Math.round(valor) ? '#D4A017' : 'none'} stroke="#D4A017" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

// ── Cabecera del comercio ─────────────────────────────────────

function CabeceraComercio({ c }: { c: ComercioPublico }) {
  const cal = Number(c.calificacion)
  const mensajeWa = `Hola, vi tu tienda "${c.nombre}" en AfroMercado y me gustaría hacer un pedido.`
  const waUrl = c.whatsapp
    ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensajeWa)}`
    : null

  return (
    <section className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Logo o inicial */}
        {c.logoUrl ? (
          <img
            src={c.logoUrl}
            alt={c.nombre}
            className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
            <span
              className="text-2xl font-bold text-[#2D6A4F]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              {c.nombre.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-2xl text-[#1A1A1A]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              {c.nombre}
            </h1>
            {c.verificado && (
              <span title="Comercio verificado" className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2D6A4F]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-sm text-[#1A1A1A]/55 mt-0.5">📍 {c.municipio}, Chocó</p>

          {cal > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <Estrellas valor={cal} />
              <span className="text-sm text-[#1A1A1A]/60">
                {cal.toFixed(1)} · {c.totalReviews} {c.totalReviews === 1 ? 'reseña' : 'reseñas'}
              </span>
            </div>
          )}

          {c.totalVentas > 0 && (
            <p className="text-xs text-[#1A1A1A]/40 mt-1">
              {c.totalVentas} {c.totalVentas === 1 ? 'pedido completado' : 'pedidos completados'}
            </p>
          )}
        </div>
      </div>

      {c.descripcion && (
        <p className="mt-4 text-sm text-[#1A1A1A]/70 leading-relaxed">{c.descripcion}</p>
      )}

      {c.historia && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-semibold text-[#2D6A4F] list-none flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="transition-transform group-open:rotate-90">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Nuestra historia
          </summary>
          <p className="mt-2 text-sm text-[#1A1A1A]/70 leading-relaxed pl-5">{c.historia}</p>
        </details>
      )}

      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Contactar por WhatsApp
        </a>
      )}
    </section>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PaginaComercio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [comercio, setComercio] = useState<ComercioPublico | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      const c = await fetchComercio(id)
      if (!activo) return
      if (!c) { setNoEncontrado(true); setCargando(false); return }
      setComercio(c)
      const prods = await fetchProductos(c.id)
      if (activo) { setProductos(prods); setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [id])

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-8 pb-12">
        {cargando ? (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 flex gap-4">
              <Skeleton className="w-16 h-16 rounded-2xl flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : noEncontrado || !comercio ? (
          <EmptyState
            titulo="Comercio no encontrado"
            descripcion="Este comercio no existe o ya no está disponible."
          >
            <Link href="/" className="mt-2 text-sm text-[#2D6A4F] font-semibold hover:underline">
              Explorar productos
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            <CabeceraComercio c={comercio} />

            <div>
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">
                Productos de {comercio.nombre}
              </h2>

              {productos.length === 0 ? (
                <EmptyState
                  titulo="Sin productos disponibles"
                  descripcion="Este comercio aún no tiene productos publicados o están agotados."
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {productos.map((p) => (
                    <TarjetaProducto key={p.id} producto={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
