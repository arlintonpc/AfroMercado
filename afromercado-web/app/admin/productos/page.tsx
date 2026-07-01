'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api/client'
import { formatearPrecio } from '@/lib/formatearPrecio'

interface ProductoAdmin {
  id: number
  nombre: string
  precio: number | string
  stock: number
  activo: boolean
  fotoUrl?: string | null
  unidad?: string | null
  comercio: { id: number; nombre: string; municipio: string }
}

export default function AdminProductosPage() {
  const [productos, setProductos] = useState<ProductoAdmin[]>([])
  const [total, setTotal]         = useState(0)
  const [pagina, setPagina]       = useState(1)
  const [cargando, setCargando]   = useState(true)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const LIMITE = 30

  const cargar = useCallback(async (p = pagina, q = busqueda, fa = filtroActivo) => {
    setCargando(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q) params.set('q', q)
      if (fa === 'activos')   params.set('activo', 'true')
      if (fa === 'inactivos') params.set('activo', 'false')
      const r = await apiFetch<{ ok: boolean; data: ProductoAdmin[]; total: number }>(
        `/admin/productos?${params}`
      )
      setProductos(r.data)
      setTotal(r.total)
    } catch { /* silent */ }
    setCargando(false)
  }, [pagina, busqueda, filtroActivo])

  useEffect(() => { cargar(1, busqueda, filtroActivo) }, []) // eslint-disable-line

  function buscar(q: string) {
    setBusqueda(q)
    setPagina(1)
    cargar(1, q, filtroActivo)
  }

  function cambiarFiltro(f: typeof filtroActivo) {
    setFiltroActivo(f)
    setPagina(1)
    cargar(1, busqueda, f)
  }

  function cambiarPagina(p: number) {
    setPagina(p)
    cargar(p, busqueda, filtroActivo)
  }

  async function toggleActivo(p: ProductoAdmin) {
    setProcesandoId(p.id)
    try {
      await apiFetch(`/admin/productos/${p.id}/activo`, { method: 'PATCH', body: { activo: !p.activo } })
      setProductos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x))
    } catch { /* silent */ }
    setProcesandoId(null)
  }

  async function toggleDestacado(p: ProductoAdmin & { destacado?: boolean }) {
    setProcesandoId(p.id)
    try {
      await apiFetch(`/admin/productos/${p.id}/destacado`, { method: 'PATCH', body: { destacado: !p.destacado } })
      setProductos(prev => prev.map(x => x.id === p.id ? { ...x, destacado: !((x as any).destacado) } : x))
    } catch { /* silent */ }
    setProcesandoId(null)
  }

  const totalPaginas = Math.ceil(total / LIMITE)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Productos del marketplace</h1>
        <p className="text-sm text-gray-500 mt-1">{total} productos en total</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={busqueda}
          onChange={e => buscar(e.target.value)}
          placeholder="Buscar por nombre..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
        />
        <div className="flex gap-1">
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button key={f} onClick={() => cambiarFiltro(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-colors ${
                filtroActivo === f ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay productos con esos filtros</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tienda</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Precio</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Stock</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.fotoUrl} alt={p.nombre} className="h-10 w-10 rounded-lg object-cover border border-gray-100 shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-[#2D6A4F]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#2D6A4F]">
                              {p.nombre[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-[#1A1A1A] line-clamp-1 max-w-[180px]">{p.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p className="font-medium">{p.comercio.nombre}</p>
                        <p className="text-xs text-gray-400">{p.comercio.municipio}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatearPrecio(Number(p.precio))}
                        {p.unidad && <span className="text-xs text-gray-400 ml-1">/{p.unidad}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${p.stock === 0 ? 'text-red-500' : p.stock <= 5 ? 'text-amber-500' : 'text-gray-600'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleActivo(p)}
                          disabled={procesandoId === p.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                            p.activo
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => cambiarPagina(pagina - 1)} disabled={pagina === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:border-[#2D6A4F]/30">
                Anterior
              </button>
              <span className="text-xs text-gray-500">Pag. {pagina} de {totalPaginas}</span>
              <button onClick={() => cambiarPagina(pagina + 1)} disabled={pagina === totalPaginas}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:border-[#2D6A4F]/30">
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
