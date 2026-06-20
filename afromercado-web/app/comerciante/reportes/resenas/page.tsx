'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { apiFetch } from '@/lib/api/client'

interface ResenaItem {
  id: number
  calificacion: number
  comentario: string | null
  createdAt: string
  producto: { nombre: string }
  autor: { nombre: string }
}

interface Evolucion {
  mes: string
  promedio: number
  total: number
}

interface ResenasData {
  distribucion: Record<string, number>
  evolucion: Evolucion[]
  resenas: ResenaItem[]
  total: number
  paginas: number
}

function Estrellas({ n, interactiva = false, onChange }: { n: number; interactiva?: boolean; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) =>
        interactiva ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="focus:outline-none"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={i <= (hover || n) ? '#D4A017' : 'none'} stroke="#D4A017" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ) : (
          <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= Math.round(n) ? '#D4A017' : 'none'} stroke="#D4A017" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )
      )}
    </span>
  )
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function promedioDeDistribucion(dist: Record<string, number>): number {
  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const suma = Object.entries(dist).reduce((a, [k, v]) => a + Number(k) * v, 0)
  return suma / total
}

export default function ReseñasPage() {
  const [data, setData] = useState<ResenasData | null>(null)
  const [pagina, setPagina] = useState(1)
  const [filtroEstrellas, setFiltroEstrellas] = useState<number | ''>('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async (pag = 1, estrellas: number | '' = '') => {
    setCargando(true)
    try {
      const qs = new URLSearchParams({ pagina: String(pag) })
      if (estrellas) qs.set('estrellas', String(estrellas))
      const res = await apiFetch<{ ok: boolean; data: ResenasData }>(
        `/reportes/comercio/resenas?${qs}`
      )
      setData(res?.data ?? null)
      setPagina(pag)
    } catch { /**/ } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar(1, filtroEstrellas) }, [filtroEstrellas, cargar])

  const promedio = data ? promedioDeDistribucion(data.distribucion) : 0
  const totalResenas = data ? Object.values(data.distribucion).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8">

        {/* Encabezado */}
        <Link href="/comerciante/reportes" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
          ← Reportes
        </Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-1 mb-0.5" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Reseñas de productos
        </h1>
        <p className="text-sm text-[#1A1A1A]/50 mb-6">Lo que tus compradores dicen sobre cada producto.</p>

        {/* Resumen visual */}
        {!cargando && data && totalResenas > 0 && (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 shadow-sm mb-4 flex flex-col sm:flex-row gap-5">
            {/* Promedio */}
            <div className="flex flex-col items-center justify-center min-w-[90px]">
              <p className="text-5xl font-bold text-[#1A1A1A]">{promedio.toFixed(1)}</p>
              <Estrellas n={promedio} />
              <p className="text-xs text-[#1A1A1A]/40 mt-1">{totalResenas} reseña{totalResenas !== 1 ? 's' : ''}</p>
            </div>

            {/* Distribución */}
            <div className="flex-1 flex flex-col gap-1.5 justify-center">
              {[5, 4, 3, 2, 1].map((s) => {
                const cnt = data.distribucion[s] ?? 0
                const pct = totalResenas ? (cnt / totalResenas) * 100 : 0
                return (
                  <button
                    key={s}
                    onClick={() => setFiltroEstrellas(filtroEstrellas === s ? '' : s)}
                    className={`flex items-center gap-2 group rounded-lg px-1 py-0.5 transition-colors ${filtroEstrellas === s ? 'bg-amber-50' : 'hover:bg-[#F8F5F0]'}`}
                  >
                    <span className="text-xs text-[#1A1A1A]/50 w-3">{s}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#D4A017" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <div className="flex-1 bg-[#1A1A1A]/8 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-[#D4A017] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#1A1A1A]/40 w-6 text-right">{cnt}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Filtro activo */}
        {filtroEstrellas !== '' && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-[#1A1A1A]/60">Filtrando: {filtroEstrellas} ★</span>
            <button
              onClick={() => setFiltroEstrellas('')}
              className="text-xs text-[#2D6A4F] hover:underline"
            >
              Ver todas
            </button>
          </div>
        )}

        {/* Lista de reseñas */}
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
            <p className="text-sm font-semibold text-[#1A1A1A]/60">
              {cargando ? 'Cargando…' : `${data?.total ?? 0} reseña${data?.total !== 1 ? 's' : ''}`}
            </p>
          </div>

          {cargando ? (
            <div className="flex flex-col divide-y divide-[#1A1A1A]/5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4">
                  <div className="h-3 bg-[#1A1A1A]/6 rounded animate-pulse w-32 mb-2" />
                  <div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse w-full" />
                </div>
              ))}
            </div>
          ) : !data?.resenas.length ? (
            <div className="px-5 py-16 text-center">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-base font-semibold text-[#1A1A1A]/50">Sin reseñas aún</p>
              <p className="text-sm text-[#1A1A1A]/30 mt-1">
                Las calificaciones de tus compradores aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1A1A1A]/5">
              {data.resenas.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#2D6A4F]">{r.producto.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Estrellas n={r.calificacion} />
                        <span className="text-xs text-[#1A1A1A]/40">— {r.autor.nombre}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#1A1A1A]/35 flex-shrink-0">{fmtFecha(r.createdAt)}</p>
                  </div>
                  {r.comentario && (
                    <p className="text-sm text-[#1A1A1A]/65 mt-2 leading-relaxed">{r.comentario}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {(data?.paginas ?? 0) > 1 && (
            <div className="px-5 py-3 border-t border-[#1A1A1A]/5 flex items-center justify-between">
              <button
                onClick={() => cargar(pagina - 1, filtroEstrellas)}
                disabled={pagina === 1 || cargando}
                className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-xs text-[#1A1A1A]/40">{pagina} / {data?.paginas}</span>
              <button
                onClick={() => cargar(pagina + 1, filtroEstrellas)}
                disabled={pagina >= (data?.paginas ?? 1) || cargando}
                className="text-xs px-3 py-1.5 border border-[#1A1A1A]/10 rounded-lg disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
