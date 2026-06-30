'use client'

import React from 'react'
import type { Categoria } from '@/types/categoria'

interface Filtro {
  id: string
  etiqueta: string
  proximamente: boolean
}

/**
 * Slugs que ya tienen catálogo disponible. El resto se muestra como
 * "Próximamente" para conservar la UX original aunque el backend devuelva
 * todas las categorías como activas.
 */
const SLUGS_DISPONIBLES = new Set(['del-campo'])

/** Filtros por defecto (fallback si no llegan categorías de la API). */
const FILTROS_FALLBACK: Filtro[] = [
  { id: 'campo', etiqueta: 'Del Campo', proximamente: false },
  { id: 'artesanias', etiqueta: 'Artesanías', proximamente: true },
  { id: 'gastronomia', etiqueta: 'Gastronomía', proximamente: true },
  { id: 'turismo', etiqueta: 'Turismo', proximamente: true },
  { id: 'cultural', etiqueta: 'Cultural', proximamente: true },
]

/**
 * Construye la lista de filtros: siempre "Todos" + las categorías reales.
 * El `id` de cada filtro es el id real de la categoría (string) para poder
 * llamar a la API con `categoriaId`. "Todos" usa el id especial 'todos'.
 */
function construirFiltros(categorias: Categoria[]): Filtro[] {
  if (!categorias.length) {
    return [{ id: 'todos', etiqueta: 'Todos', proximamente: false }, ...FILTROS_FALLBACK]
  }

  const reales: Filtro[] = categorias.map((cat) => ({
    id: cat.id,
    etiqueta: cat.nombre,
    proximamente: !SLUGS_DISPONIBLES.has(cat.slug),
  }))

  // Disponibles primero, "Próximamente" al final (orden original del diseño).
  reales.sort((a, b) => Number(a.proximamente) - Number(b.proximamente))

  const disponibles = reales.filter((f) => !f.proximamente)

  // Ocultar siempre las categorías "Próximamente".
  // Si no hay ninguna disponible, mostrar todas sin el badge para no dejar la barra vacía.
  const filtradas =
    disponibles.length > 0
      ? disponibles
      : reales.map((f) => ({ ...f, proximamente: false }))

  return [{ id: 'todos', etiqueta: 'Todos', proximamente: false }, ...filtradas]
}

interface FiltrosHorizontalesProps {
  filtroActivo: string
  onFiltroChange: (filtro: string) => void
  /** Categorías reales de la API. Si está vacío se usa el fallback estático. */
  categorias?: Categoria[]
}

export default function FiltrosHorizontales({
  filtroActivo,
  onFiltroChange,
  categorias = [],
}: FiltrosHorizontalesProps) {
  const filtros = construirFiltros(categorias)

  return (
    <div className="relative fade-right">
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        role="list"
        aria-label="Filtros de categoría"
      >

        {filtros.map((filtro) => {
          const estaActivo = filtroActivo === filtro.id
          const estaDeshabilitado = filtro.proximamente

          return (
            <div key={filtro.id} className="relative flex-shrink-0" role="listitem">
              <button
                onClick={() => {
                  if (!estaDeshabilitado) onFiltroChange(filtro.id)
                }}
                disabled={estaDeshabilitado}
                aria-pressed={estaActivo}
                aria-label={
                  estaDeshabilitado
                    ? `${filtro.etiqueta} — Próximamente`
                    : filtro.etiqueta
                }
                className={[
                  'flex items-center gap-1.5 px-4 rounded-full text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                  'min-h-[44px]',
                  estaActivo
                    ? 'bg-[#1A1A1A] text-white'
                    : estaDeshabilitado
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-[#1A1A1A] hover:bg-gray-200',
                ].join(' ')}
                style={{ fontFamily: 'var(--font-inter)' }}
              >
                {filtro.etiqueta}
                {estaDeshabilitado && (
                  <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full leading-none min-h-0">
                    Próximamente
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
      {/* Indicador visual de más filtros a la derecha */}
      <div className="absolute right-0 top-0 bottom-1 w-12 bg-gradient-to-l from-[#F8F5F0] to-transparent pointer-events-none" />
    </div>
  )
}
