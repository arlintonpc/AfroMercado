'use client'

import { useState } from 'react'
import { obtenerToken } from '@/lib/api/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

interface BotonExportarProps {
  /** "/reportes/comercio/exportar" o "/reportes/admin/exportar" */
  endpoint: string
  /** Parámetros adicionales: desde, hasta, estados, etc. */
  params?: Record<string, string | undefined>
  /** Nombre base del archivo sin extensión */
  nombreBase?: string
  className?: string
}

export default function BotonExportar({ endpoint, params = {}, nombreBase = 'afromercado-reporte', className }: BotonExportarProps) {
  const [generando, setGenerando] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function exportar() {
    setGenerando(true)
    setError(null)
    try {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null) as [string, string][]
      ).toString()
      const token = obtenerToken()
      const res = await fetch(`${API_URL}${endpoint}${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        let msg = 'No pudimos generar el reporte.'
        try {
          const j = await res.json()
          if (j?.error) msg = j.error
        } catch { /* respuesta parcial o binaria */ }
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      // intenta leer el nombre del Content-Disposition; si no, usa el base
      const cd   = res.headers.get('Content-Disposition') ?? ''
      a.download = cd.match(/filename="(.+)"/)?.[1] ?? `${nombreBase}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={exportar}
        disabled={generando}
        className={className ?? 'inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#245a42] disabled:opacity-60 transition-colors'}
      >
        {generando ? (
          <>
            <svg className="animate-spin" width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.2"/>
              <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            Generando…
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <path d="M7 10l5 5 5-5"/>
              <path d="M12 15V3"/>
            </svg>
            Exportar Excel
          </>
        )}
      </button>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  )
}
