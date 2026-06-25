'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import SubidorLogo from '@/components/admin/SubidorLogo'

interface Regla {
  clave: string
  valor: string
  tipo: 'bool' | 'numero' | 'porcentaje_decimal' | 'select' | 'texto'
  grupo: string
  etiqueta: string
  desc?: string
  opciones?: string[]
}

type Grupos = Record<string, Regla[]>

/** Convierte el valor crudo (de la API) al valor que se muestra en el control. */
function aVista(r: Regla): string {
  if (r.tipo === 'porcentaje_decimal') {
    const n = parseFloat(r.valor)
    return isNaN(n) ? r.valor : String(Math.round(n * 100))
  }
  return r.valor
}

/** Convierte el valor del control al formato que espera el backend. */
function aAPI(tipo: Regla['tipo'], v: string): string {
  if (tipo === 'porcentaje_decimal') {
    const n = parseFloat(v)
    return isNaN(n) ? v : String(n / 100)
  }
  return v
}

function FilaRegla({ regla }: { regla: Regla }) {
  const [valor, setValor] = useState(aVista(regla))
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<'ok' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function guardar(nuevoValor?: string) {
    const v = nuevoValor ?? valor
    setGuardando(true)
    setAviso(null)
    setError(null)
    try {
      await apiFetch(`/admin/config/${encodeURIComponent(regla.clave)}`, {
        method: 'PUT',
        body: { valor: aAPI(regla.tipo, v) },
      })
      setAviso('ok')
      setTimeout(() => setAviso(null), 3000)
    } catch (e) {
      setAviso('error')
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // El toggle guarda al instante (mejor UX para booleanos).
  function onToggle() {
    const nuevo = valor === 'true' ? 'false' : 'true'
    setValor(nuevo)
    guardar(nuevo)
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1A1A1A]">{regla.etiqueta}</p>
        {regla.desc && <p className="mt-0.5 text-xs leading-relaxed text-[#1A1A1A]/55">{regla.desc}</p>}
        <code className="mt-1 inline-block text-[11px] text-[#1A1A1A]/35">{regla.clave}</code>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        {regla.tipo === 'bool' ? (
          <button
            type="button"
            role="switch"
            aria-checked={valor === 'true'}
            onClick={onToggle}
            disabled={guardando}
            className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${valor === 'true' ? 'bg-[#2D6A4F]' : 'bg-[#1A1A1A]/20'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${valor === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        ) : regla.tipo === 'select' ? (
          <select
            value={valor}
            onChange={(e) => { setValor(e.target.value); guardar(e.target.value) }}
            disabled={guardando}
            className="rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          >
            {(regla.opciones ?? []).map((op) => (
              <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
            ))}
          </select>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <input
                type={regla.tipo === 'texto' ? 'text' : 'number'}
                value={valor}
                min={regla.tipo !== 'texto' ? '0' : undefined}
                onChange={(e) => { setValor(e.target.value); setAviso(null) }}
                className="w-28 rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              />
              {regla.tipo === 'porcentaje_decimal' && <span className="text-sm text-[#1A1A1A]/50">%</span>}
            </div>
            <button
              type="button"
              onClick={() => guardar()}
              disabled={guardando}
              className="flex-shrink-0 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#245a42] disabled:opacity-50"
            >
              {guardando ? '…' : 'Guardar'}
            </button>
          </>
        )}
        {aviso === 'ok' && (
          <span className="text-xs font-semibold text-[#2D6A4F]">✓</span>
        )}
      </div>
      {aviso === 'error' && <p className="text-xs text-[#C0392B] sm:basis-full sm:text-right">{error}</p>}
    </li>
  )
}

export default function PaginaReglas() {
  const [grupos, setGrupos] = useState<Grupos>({})
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ ok: boolean; data: Grupos }>('/admin/reglas')
      .then((res) => setGrupos(res?.data ?? {}))
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'Error al cargar las reglas.'))
      .finally(() => setCargando(false))
  }, [])

  const nombresGrupos = Object.keys(grupos)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-xs text-[#1A1A1A]/40 transition-colors hover:text-[#2D6A4F]">← Panel admin</Link>
        <h1 className="mt-1 text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Reglas del marketplace
        </h1>
        <p className="mt-0.5 text-sm text-[#1A1A1A]/50">
          Configura las reglas de negocio sin tocar código. Los cambios tienen efecto inmediato.
        </p>
      </div>

      <SubidorLogo />

      {cargando ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-[#1A1A1A]/8 bg-white" />
          ))}
        </div>
      ) : errorCarga ? (
        <div className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/8 px-5 py-4 text-sm text-[#C0392B]">{errorCarga}</div>
      ) : (
        <div className="flex flex-col gap-8">
          {nombresGrupos.map((grupo) => (
            <section key={grupo}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#52B788]">{grupo}</h2>
              <ul className="flex flex-col gap-3">
                {grupos[grupo].map((r) => (
                  <FilaRegla key={r.clave} regla={r} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
