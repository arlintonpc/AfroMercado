'use client'

import React from 'react'
import Link from 'next/link'

export interface StickyHeaderProps {
  titulo?: string
  subtitulo?: string
  logoUrl?: string
  atrasUrl?: string
  atrasTexto?: string
  busqueda?: string
  onBusquedaChange?: (val: string) => void
  placeholderBusqueda?: string
  children?: React.ReactNode
  accionesDerecha?: React.ReactNode
  className?: string
}

export default function StickyHeader({
  titulo,
  subtitulo,
  logoUrl,
  atrasUrl,
  atrasTexto = 'Volver',
  busqueda,
  onBusquedaChange,
  placeholderBusqueda = 'Buscar...',
  children,
  accionesDerecha,
  className = '',
}: StickyHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#1A1A1A]/5 py-3 shadow-sm transition-all ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          {/* Lado izquierdo: Botón volver / Logo / Título */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {atrasUrl && (
              <Link
                href={atrasUrl}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full px-3 py-1.5 transition-all hover:scale-105 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                {atrasTexto}
              </Link>
            )}

            {logoUrl && (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={titulo || 'Logo'} className="w-full h-full object-cover" />
              </div>
            )}

            {(titulo || subtitulo) && (
              <div className="min-w-0">
                {titulo && (
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate leading-tight">
                    {titulo}
                  </h2>
                )}
                {subtitulo && (
                  <p className="text-xs text-gray-500 truncate font-medium">{subtitulo}</p>
                )}
              </div>
            )}
          </div>

          {/* Centro / Tabs infantiles o navegación personalizada */}
          {children && <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">{children}</div>}

          {/* Lado derecho: Buscador o Acciones */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onBusquedaChange && (
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={placeholderBusqueda}
                  value={busqueda || ''}
                  onChange={(e) => onBusquedaChange(e.target.value)}
                  className="block w-full pl-9 pr-8 py-2 border border-gray-200 rounded-full text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332] bg-white/70 backdrop-blur-md shadow-inner transition-all"
                />
                {busqueda && (
                  <button
                    onClick={() => onBusquedaChange('')}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {accionesDerecha}
          </div>
        </div>
      </div>
    </header>
  )
}
