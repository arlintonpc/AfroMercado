'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { busquedaGlobal, type ResultadoBusqueda } from '@/lib/api/busqueda'
import { formatearPrecio } from '@/lib/formatearPrecio'

const ICONOS  = { productos: '🛍️', hoteles: '🏨', tours: '🗺️', transportes: '🛥️' } as const
const RUTAS   = { productos: '/producto', hoteles: '/hoteles', tours: '/tours', transportes: '/transportes' } as const
const LABELS  = { productos: 'Productos', hoteles: 'Hoteles', tours: 'Tours', transportes: 'Transportes' } as const
const SUGERENCIAS = ['Hoteles en Quibdó', 'Tours río Atrato', 'Artesanías', 'Transporte', 'Gastronomía']

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function BuscadorGlobal() {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda | null>(null)
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const qDebounced = useDebounce(q, 300)

  useEffect(() => {
    if (qDebounced.trim().length < 2) { setResultados(null); return }
    setCargando(true)
    busquedaGlobal(qDebounced).then(setResultados).finally(() => setCargando(false))
  }, [qDebounced])

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQ(''); setResultados(null) }
  }, [abierto])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setAbierto(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const total = resultados
    ? resultados.productos.length + resultados.hoteles.length + resultados.tours.length + resultados.transportes.length
    : 0

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-500"
        aria-label="Búsqueda global"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden md:inline text-gray-400">Buscar…</span>
        <kbd className="hidden lg:inline text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAbierto(false)} />
          <div className="relative z-10 mx-auto w-full max-w-2xl mt-16 md:mt-24 px-4">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar productos, hoteles, tours, transportes…"
                  className="flex-1 text-base outline-none text-[#1A1A1A] placeholder-gray-400"
                  autoComplete="off"
                />
                {cargando && (
                  <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <button onClick={() => setAbierto(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">×</button>
              </div>

              {/* Resultados */}
              {resultados && total > 0 && (
                <div className="max-h-[60vh] overflow-y-auto py-2">
                  {(['productos', 'hoteles', 'tours', 'transportes'] as const).map(modulo => {
                    const items = resultados[modulo]
                    if (!items.length) return null
                    return (
                      <div key={modulo} className="mb-2">
                        <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {ICONOS[modulo]} {LABELS[modulo]}
                        </p>
                        {items.map((item: any) => {
                          const foto = item.fotos?.[0] ?? item.habitaciones?.[0]?.fotos?.[0] ?? null
                          const nombre = item.nombre ?? item.comercio?.nombre
                          const municipio = item.comercio?.municipio
                          const precio = item.precio ?? item.precioPersona ?? item.habitaciones?.[0]?.precioPorNoche
                          return (
                            <Link
                              key={item.id}
                              href={`${RUTAS[modulo]}/${item.id}`}
                              onClick={() => setAbierto(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAF8F5] transition-colors"
                            >
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                {foto ? (
                                  <img src={foto} alt={nombre} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-[#E8DCC8] flex items-center justify-center text-lg">
                                    {ICONOS[modulo]}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{nombre}</p>
                                <p className="text-xs text-gray-400 truncate">
                                  {municipio && `📍 ${municipio}`}
                                  {precio && ` · ${formatearPrecio(Number(precio))}`}
                                  {item.tipo && ` · ${item.tipo}`}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Sin resultados */}
              {resultados && total === 0 && q.length >= 2 && !cargando && (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm">Sin resultados para "{q}"</p>
                  <p className="text-xs mt-1 text-gray-300">Intenta con otro término</p>
                </div>
              )}

              {/* Estado inicial — sugerencias */}
              {!resultados && q.length < 2 && (
                <div className="px-4 py-5">
                  <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">Sugerencias</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGERENCIAS.map(s => (
                      <button
                        key={s}
                        onClick={() => setQ(s)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-[#E8DCC8] transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  )
}
