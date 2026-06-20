'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import BotonExportar from '@/components/reportes/BotonExportar'

interface ProductoMetrica {
  id: number; nombre: string; precio: number; fotoUrl?: string | null
  unidad: string; stock: number; stockReservado: number; stockDisponible: number
  activo: boolean; calificacion: number; totalReviews: number
  unidades: number; ingresos: number; neto: number; vistas: number; conversion: number
}

type Orden = 'ingresos' | 'unidades' | 'vistas' | 'conversion' | 'calificacion' | 'stock'

function Estrellas({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(n) ? '#D4A017' : 'none'} stroke="#D4A017" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span className="text-[10px] text-[#1A1A1A]/40 ml-0.5">{n.toFixed(1)}</span>
    </span>
  )
}

function StockBadge({ disponible }: { disponible: number }) {
  if (disponible === 0) return <span className="text-[11px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5 border border-red-200">Agotado</span>
  if (disponible <= 3)  return <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-200">{disponible} disponible{disponible > 1 ? 's' : ''}</span>
  return <span className="text-[11px] text-[#1A1A1A]/40">{disponible}</span>
}

function Contenido() {
  const params = useSearchParams()
  const hoy    = new Date()
  const ini    = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const desde  = params.get('desde') ?? ini
  const hasta  = params.get('hasta') ?? hoy.toISOString().slice(0, 10)

  const [data, setData]       = useState<ProductoMetrica[]>([])
  const [cargando, setCargando] = useState(true)
  const [orden, setOrden]     = useState<Orden>('ingresos')
  const [vista, setVista]     = useState<'todos' | 'estrellas' | 'ayuda'>('todos')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await apiFetch<{ ok: boolean; data: ProductoMetrica[] }>(
        `/reportes/comercio/productos?desde=${desde}&hasta=${hasta}`
      )
      setData(res?.data ?? [])
    } catch { /**/ } finally { setCargando(false) }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const sinStock = data.filter((p) => p.stockDisponible === 0 && p.activo)
  const bajStock = data.filter((p) => p.stockDisponible > 0 && p.stockDisponible <= 3 && p.activo)

  const lista = [...data]
    .filter((p) => {
      if (vista === 'estrellas') return p.ingresos > 0
      if (vista === 'ayuda')     return p.unidades === 0 || p.stockDisponible === 0
      return true
    })
    .sort((a, b) => {
      switch (orden) {
        case 'ingresos':    return b.ingresos - a.ingresos
        case 'unidades':    return b.unidades - a.unidades
        case 'vistas':      return b.vistas - a.vistas
        case 'conversion':  return b.conversion - a.conversion
        case 'calificacion':return b.calificacion - a.calificacion
        case 'stock':       return b.stockDisponible - a.stockDisponible
        default:            return 0
      }
    })

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div>
        <Link href="/comerciante/dashboard" className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">← Panel</Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Reporte de productos
        </h1>
        <p className="text-sm text-[#1A1A1A]/50 mt-0.5">Rendimiento de cada producto: ventas, vistas, stock y calificación.</p>
      </div>

      {/* Alertas de stock */}
      {(sinStock.length > 0 || bajStock.length > 0) && (
        <div className="flex flex-col gap-2">
          {sinStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
              <span className="text-red-500 text-lg flex-shrink-0">⚠</span>
              <div>
                <p className="text-sm font-semibold text-red-700">{sinStock.length} producto{sinStock.length > 1 ? 's' : ''} agotado{sinStock.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-600 mt-0.5">{sinStock.map((p) => p.nombre).join(', ')}</p>
              </div>
            </div>
          )}
          {bajStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
              <span className="text-amber-600 text-lg flex-shrink-0">📦</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Stock bajo (≤ 3 unidades)</p>
                <p className="text-xs text-amber-700 mt-0.5">{bajStock.map((p) => `${p.nombre} (${p.stockDisponible})`).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controles */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FiltroFechas />
          <div className="ml-auto">
            <BotonExportar
              endpoint="/reportes/comercio/exportar"
              params={{ desde, hasta }}
              nombreBase="productos"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['todos', 'estrellas', 'ayuda'] as const).map((v) => (
            <button key={v}
              onClick={() => setVista(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                vista === v ? 'border-[#2D6A4F] bg-[#52B788]/15 text-[#2D6A4F]' : 'border-[#1A1A1A]/10 bg-white text-[#1A1A1A]/60 hover:bg-[#52B788]/10'
              }`}
            >
              {v === 'todos' ? 'Todos' : v === 'estrellas' ? '⭐ Mis estrellas' : '😴 Necesitan ayuda'}
            </button>
          ))}
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            className="ml-auto rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
          >
            <option value="ingresos">Ordenar: Ingresos</option>
            <option value="unidades">Ordenar: Unidades vendidas</option>
            <option value="vistas">Ordenar: Vistas</option>
            <option value="conversion">Ordenar: Conversión</option>
            <option value="calificacion">Ordenar: Calificación</option>
            <option value="stock">Ordenar: Stock</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
          <p className="text-sm font-semibold text-[#1A1A1A]/60">
            {cargando ? 'Cargando…' : `${lista.length} producto${lista.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-[#F8F5F0]/40 border-b border-[#1A1A1A]/5">
              <tr>
                {['Producto','Unid. vendidas','Ingresos brutos','Tus ingresos','Vistas','Conversión','Stock','Calificación'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#1A1A1A]/50 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {cargando ? [1,2,3,4,5].map((i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-[#1A1A1A]/6 rounded animate-pulse"/></td></tr>
              )) : lista.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center">
                  <p className="text-base font-semibold text-[#1A1A1A]/50">Sin productos</p>
                </td></tr>
              ) : lista.map((p) => (
                <tr key={p.id} className={`transition-colors hover:bg-[#F8F5F0]/60 ${p.stockDisponible === 0 && p.activo ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.fotoUrl ? (
                        <Image src={p.fotoUrl} alt={p.nombre} width={36} height={36} className="w-9 h-9 rounded-lg object-cover flex-shrink-0"/>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#52B788]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-base">🌿</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#1A1A1A] text-sm">{p.nombre}</p>
                        <p className="text-[11px] text-[#1A1A1A]/40">{formatearPrecio(p.precio)} / {p.unidad}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1A1A1A]">{p.unidades.toLocaleString('es-CO')}</p>
                    <p className="text-[11px] text-[#1A1A1A]/40">{p.unidad}</p>
                  </td>
                  <td className="px-4 py-3 text-[#1A1A1A]/70">{p.ingresos > 0 ? formatearPrecio(p.ingresos) : <span className="text-[#1A1A1A]/30">—</span>}</td>
                  <td className="px-4 py-3 font-semibold text-[#2D6A4F]">{p.neto > 0 ? formatearPrecio(p.neto) : <span className="text-[#1A1A1A]/30">—</span>}</td>
                  <td className="px-4 py-3 text-[#1A1A1A]/60">{p.vistas.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3">
                    {p.conversion > 0 ? (
                      <span className={`text-xs font-semibold ${p.conversion >= 5 ? 'text-[#2D6A4F]' : p.conversion >= 2 ? 'text-amber-600' : 'text-[#1A1A1A]/50'}`}>
                        {p.conversion.toFixed(1)}%
                      </span>
                    ) : <span className="text-[#1A1A1A]/30">—</span>}
                  </td>
                  <td className="px-4 py-3"><StockBadge disponible={p.stockDisponible}/></td>
                  <td className="px-4 py-3">
                    {p.totalReviews > 0 ? <Estrellas n={p.calificacion}/> : <span className="text-[11px] text-[#1A1A1A]/30">Sin reseñas</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota conversión */}
      <p className="text-xs text-[#1A1A1A]/40 text-center">
        Conversión = unidades vendidas / vistas × 100. Stock disponible = stock total − reservado.
      </p>
    </div>
  )
}

export default function ReporteProductosPage() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center text-[#1A1A1A]/40 text-sm">Cargando…</div>}>
      <Contenido />
    </Suspense>
  )
}
