'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listarMisProductos,
  type ProductoComerciante,
} from '@/components/comerciante/api'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MisProductosPage() {
  const [productos, setProductos]     = useState<ProductoComerciante[]>([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [procesandoId, setProcesando] = useState<number | null>(null)
  const [aviso, setAviso]             = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [editandoStockId, setEditandoStockId] = useState<number | null>(null)
  const [stockTemporal, setStockTemporal]     = useState<string>('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setProductos(await listarMisProductos())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function guardarStock(p: ProductoComerciante) {
    const nuevo = parseInt(stockTemporal, 10)
    if (isNaN(nuevo) || nuevo < 0) { setEditandoStockId(null); return }
    if (nuevo === p.stock) { setEditandoStockId(null); return }
    setProcesando(p.id)
    try {
      await apiFetch(`/productos/${p.id}`, { method: 'PATCH', body: { stock: nuevo } })
      setProductos(prev => prev.map(x => x.id === p.id ? { ...x, stock: nuevo } : x))
      setAviso({ tipo: 'exito', texto: `Stock de "${p.nombre}" actualizado a ${nuevo}.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar.' })
    } finally {
      setProcesando(null)
      setEditandoStockId(null)
    }
  }

  async function toggleActivo(p: ProductoComerciante) {
    const accion = p.activo ? 'desactivar' : 'activar'
    if (!window.confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} "${p.nombre}"?`)) return
    setProcesando(p.id)
    try {
      if (p.activo) {
        await apiFetch(`/productos/${p.id}`, { method: 'DELETE' })
      } else {
        await apiFetch(`/productos/${p.id}`, { method: 'PATCH', body: { activo: true } })
      }
      setAviso({ tipo: 'exito', texto: `Producto ${p.activo ? 'desactivado' : 'activado'}.` })
      void cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo actualizar.' })
    } finally {
      setProcesando(null)
    }
  }

  const activos   = productos.filter((p) =>  p.activo).length
  const inactivos = productos.filter((p) => !p.activo).length

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Mis productos
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            {productos.length > 0
              ? `${activos} activo${activos !== 1 ? 's' : ''}, ${inactivos} inactivo${inactivos !== 1 ? 's' : ''}.`
              : 'Gestiona tus productos publicados.'}
          </p>
        </div>
        <Link href="/comerciante/publicar">
          <Button variant="primary" size="sm">+ Publicar</Button>
        </Link>
      </div>

      {/* Aviso */}
      {aviso && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          aviso.tipo === 'exito'
            ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {aviso.texto}
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div className="rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/5 px-4 py-4 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : productos.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-[#1A1A1A]/60">Aún no tienes productos</p>
            <p className="mt-1 text-sm text-[#1A1A1A]/40">
              Publica tu primer producto para que los clientes lo encuentren.
            </p>
            <Link href="/comerciante/publicar" className="mt-5 inline-block">
              <Button variant="primary" size="sm">Publicar primer producto</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]/8 text-xs uppercase tracking-wide text-[#1A1A1A]/50">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Precio</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr
                    key={p.id}
                    className={[
                      'border-b border-[#1A1A1A]/5 last:border-0 transition-colors',
                      p.activo ? 'hover:bg-[#F8F5F0]/60' : 'bg-[#1A1A1A]/[0.02] opacity-70',
                    ].join(' ')}
                  >
                    {/* Producto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.fotoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.fotoUrl}
                            alt={p.nombre}
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 rounded-lg border border-[#1A1A1A]/8 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2D6A4F]/10 text-base font-bold text-[#2D6A4F]">
                            {p.nombre[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-[#1A1A1A] line-clamp-1 max-w-[180px]">
                          {p.nombre}
                        </span>
                      </div>
                    </td>

                    {/* Precio */}
                    <td className="px-4 py-3 text-[#1A1A1A]/80">
                      {formatearPrecio(Number(p.precio))}
                    </td>

                    {/* Stock — edición inline al hacer clic */}
                    <td className="px-4 py-3">
                      {editandoStockId === p.id ? (
                        <form
                          onSubmit={e => { e.preventDefault(); guardarStock(p) }}
                          className="flex items-center gap-1"
                        >
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            value={stockTemporal}
                            onChange={e => setStockTemporal(e.target.value)}
                            onBlur={() => guardarStock(p)}
                            onKeyDown={e => { if (e.key === 'Escape') setEditandoStockId(null) }}
                            className="w-20 rounded-lg border border-[#2D6A4F]/40 bg-white px-2 py-1 text-sm font-semibold text-[#1A1A1A] focus:outline-none focus:border-[#2D6A4F]"
                            disabled={procesandoId === p.id}
                          />
                          <button type="submit" className="text-[#2D6A4F] hover:text-[#1B4332]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          title="Clic para editar stock"
                          onClick={() => { setEditandoStockId(p.id); setStockTemporal(String(p.stock)) }}
                          className="group flex items-center gap-1 rounded-lg px-1 -mx-1 hover:bg-[#F8F5F0] transition-colors"
                        >
                          <span className={[
                            'text-sm font-semibold',
                            p.stock === 0 ? 'text-[#C0392B]' : p.stock <= 5 ? 'text-[#D4A017]' : 'text-[#1A1A1A]/70',
                          ].join(' ')}>
                            {p.stock}
                          </span>
                          <span className="text-xs text-[#1A1A1A]/40">{p.unidad}</span>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[#1A1A1A]/20 group-hover:text-[#2D6A4F] transition-colors">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        p.activo
                          ? 'border-[#52B788]/30 bg-[#52B788]/10 text-[#2D6A4F]'
                          : 'border-[#1A1A1A]/15 bg-[#1A1A1A]/5 text-[#1A1A1A]/50',
                      ].join(' ')}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/comerciante/productos/${p.id}/editar`}>
                          <Button variant="secondary" size="sm">Editar</Button>
                        </Link>
                        <Button
                          variant={p.activo ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => toggleActivo(p)}
                          loading={procesandoId === p.id}
                          disabled={procesandoId !== null}
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
