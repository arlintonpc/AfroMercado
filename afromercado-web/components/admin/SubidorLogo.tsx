'use client'

import { useEffect, useRef, useState } from 'react'
import { obtenerReglasPublicas } from '@/lib/api/config'
import { obtenerToken } from '@/lib/api/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

/** Sube el logo de la plataforma (se guarda en config y se muestra en la cabecera). */
export default function SubidorLogo() {
  const [logoUrl, setLogoUrl] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    obtenerReglasPublicas().then((r) => setLogoUrl(r.logoUrl)).catch(() => {})
  }, [])

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true); setError(null); setOk(false)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const token = obtenerToken()
      const res = await fetch(`${API_URL}/admin/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      })
      if (!res.ok) {
        let m = 'No se pudo subir el logo.'
        try { const j = await res.json(); if (j?.error) m = j.error } catch { /* sin cuerpo */ }
        throw new Error(m)
      }
      const j = await res.json()
      setLogoUrl(j.url)
      setOk(true); setTimeout(() => setOk(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el logo.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-[#1A1A1A]">Logo de la plataforma</h2>
      <p className="mt-0.5 text-xs text-[#1A1A1A]/55">
        Se muestra en la cabecera de la tienda. PNG o SVG, fondo transparente, máx 3&nbsp;MB.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-44 items-center justify-center overflow-hidden rounded-xl border border-[#1A1A1A]/10 bg-[#F8F5F0]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo actual" className="h-12 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="text-lg" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              <span className="text-[#2D6A4F]">Afro</span><span className="text-[#D4A017]">Mercado</span>
            </span>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={subir} disabled={subiendo} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#245a42] disabled:opacity-50"
        >
          {subiendo ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
        </button>
        {ok && <span className="text-xs font-semibold text-[#2D6A4F]">✓ Guardado</span>}
      </div>
      {error && <p className="mt-2 text-xs text-[#C0392B]">{error}</p>}
    </section>
  )
}
