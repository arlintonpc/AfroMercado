'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api/client'

interface ReviewBase {
  id: number
  estrellas: number
  comentario?: string | null
  createdAt: string
  autor: { id: number; nombre: string; email: string }
}

interface ReviewProducto extends ReviewBase {
  producto: { id: number; nombre: string }
}

interface ReviewTienda extends ReviewBase {
  comercio: { id: number; nombre: string }
}

function Estrellas({ n }: { n: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
      <span className="ml-1 text-xs font-semibold text-gray-600">{n}/5</span>
    </span>
  )
}

export default function AdminReviewsPage() {
  const [tipo, setTipo] = useState<'producto' | 'tienda'>('producto')
  const [items, setItems]       = useState<ReviewProducto[] | ReviewTienda[]>([])
  const [total, setTotal]       = useState(0)
  const [pagina, setPagina]     = useState(1)
  const [cargando, setCargando] = useState(true)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const LIMITE = 30

  const cargar = useCallback(async (p = pagina, t = tipo) => {
    setCargando(true)
    try {
      const r = await apiFetch<{ ok: boolean; data: any[]; total: number }>(
        `/admin/reviews?tipo=${t}&page=${p}`
      )
      setItems(r.data)
      setTotal(r.total)
    } catch { /* silent */ }
    setCargando(false)
  }, [pagina, tipo])

  useEffect(() => { cargar(1, tipo) }, []) // eslint-disable-line

  function cambiarTipo(t: typeof tipo) {
    setTipo(t)
    setPagina(1)
    cargar(1, t)
  }

  function cambiarPagina(p: number) {
    setPagina(p)
    cargar(p, tipo)
  }

  async function eliminar(id: number) {
    if (!window.confirm('¿Eliminar esta calificacion? Esta accion no se puede deshacer.')) return
    setEliminandoId(id)
    try {
      await apiFetch(`/admin/reviews/${id}?tipo=${tipo}`, { method: 'DELETE' })
      setItems(prev => prev.filter(x => x.id !== id))
      setTotal(t => t - 1)
    } catch { /* silent */ }
    setEliminandoId(null)
  }

  const totalPaginas = Math.ceil(total / LIMITE)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Moderacion de calificaciones</h1>
        <p className="text-sm text-gray-500 mt-1">{total} calificaciones &middot; elimina las inapropiadas</p>
      </div>

      {/* Tabs tipo */}
      <div className="flex rounded-xl border border-gray-200 bg-white p-1 gap-1 w-fit mb-5">
        {(['producto', 'tienda'] as const).map(t => (
          <button key={t} onClick={() => cambiarTipo(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              tipo === t ? 'bg-[#2D6A4F] text-white' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {t === 'producto' ? 'Productos' : 'Tiendas'}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay calificaciones</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map(item => {
              const r = item as any
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Destino */}
                    <p className="text-xs font-semibold text-[#2D6A4F] mb-1">
                      {tipo === 'producto' ? r.producto?.nombre : r.comercio?.nombre}
                    </p>
                    {/* Estrellas */}
                    <Estrellas n={r.estrellas} />
                    {/* Comentario */}
                    {r.comentario && (
                      <p className="text-sm text-gray-700 mt-1.5 line-clamp-3">{r.comentario}</p>
                    )}
                    {/* Autor */}
                    <p className="text-xs text-gray-400 mt-2">
                      {r.autor.nombre} &middot; {r.autor.email} &middot;{' '}
                      {new Date(r.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => eliminar(r.id)}
                    disabled={eliminandoId === r.id}
                    className="shrink-0 self-start w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Eliminar calificacion"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

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
