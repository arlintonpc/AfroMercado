'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'

// ── Tipos ─────────────────────────────────────────────────────

interface ConfigItem {
  clave: string
  valor: string
  descripcion: string | null
}

interface FilaState {
  valor: string
  guardando: boolean
  aviso: 'ok' | 'error' | null
  mensajeError: string | null
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Para `comision_global` el backend guarda el decimal (0.1 = 10%).
 * En la UI mostramos porcentaje entero.
 */
function valorMostrar(clave: string, raw: string): string {
  if (clave === 'comision_global') {
    const n = parseFloat(raw)
    return isNaN(n) ? raw : String(Math.round(n * 100))
  }
  return raw
}

/** Convierte el valor que viene del input al formato que espera el backend. */
function valorParaAPI(clave: string, uiValue: string): string {
  if (clave === 'comision_global') {
    const n = parseFloat(uiValue)
    return isNaN(n) ? uiValue : String(n / 100)
  }
  return uiValue
}

/** Etiqueta legible de la clave. */
function etiquetaClave(clave: string): string {
  const mapa: Record<string, string> = {
    whatsapp_boton_activo: 'Botón de WhatsApp',
    comision_global: 'Comisión global',
  }
  return mapa[clave] ?? clave.replace(/_/g, ' ')
}

// ── Componente fila ───────────────────────────────────────────

function FilaConfig({
  item,
  estadoInicial,
}: {
  item: ConfigItem
  estadoInicial: FilaState
}) {
  const [estado, setEstado] = useState<FilaState>(estadoInicial)

  const esToggle = item.clave === 'whatsapp_boton_activo'
  const esNumero = item.clave === 'comision_global'

  async function guardar() {
    setEstado((s) => ({ ...s, guardando: true, aviso: null, mensajeError: null }))
    try {
      await apiFetch(`/admin/config/${encodeURIComponent(item.clave)}`, {
        method: 'PUT',
        body: { valor: valorParaAPI(item.clave, estado.valor) },
      })
      setEstado((s) => ({ ...s, guardando: false, aviso: 'ok' }))
      setTimeout(() => setEstado((s) => ({ ...s, aviso: null })), 3500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar.'
      setEstado((s) => ({ ...s, guardando: false, aviso: 'error', mensajeError: msg }))
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-6">
      {/* Metadatos */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1A1A1A]">{etiquetaClave(item.clave)}</p>
        <code className="mt-0.5 inline-block text-[11px] text-[#1A1A1A]/40">{item.clave}</code>
        {item.descripcion && (
          <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A]/55">{item.descripcion}</p>
        )}
      </div>

      {/* Control de edición */}
      <div className="flex items-center gap-3 sm:justify-end">
        {esToggle ? (
          <label className="flex cursor-pointer items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={estado.valor === 'true'}
              onClick={() =>
                setEstado((s) => ({ ...s, valor: s.valor === 'true' ? 'false' : 'true', aviso: null }))
              }
              className={`relative flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:ring-offset-1 ${
                estado.valor === 'true' ? 'bg-[#2D6A4F]' : 'bg-[#1A1A1A]/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  estado.valor === 'true' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-[#1A1A1A]/60">
              {estado.valor === 'true' ? 'Activo' : 'Inactivo'}
            </span>
          </label>
        ) : esNumero ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={estado.valor}
              onChange={(e) =>
                setEstado((s) => ({ ...s, valor: e.target.value, aviso: null }))
              }
              className="w-24 rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
            />
            <span className="text-sm text-[#1A1A1A]/50">%</span>
          </div>
        ) : (
          <input
            type="text"
            value={estado.valor}
            onChange={(e) =>
              setEstado((s) => ({ ...s, valor: e.target.value, aviso: null }))
            }
            className="w-48 rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
          />
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={estado.guardando}
          className="flex-shrink-0 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#245a42] disabled:opacity-50"
        >
          {estado.guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* Avisos inline */}
      {estado.aviso === 'ok' && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] sm:absolute sm:right-5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Guardado
        </div>
      )}
      {estado.aviso === 'error' && (
        <p className="text-xs text-red-600">{estado.mensajeError}</p>
      )}
    </li>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function PaginaConfig() {
  const [items, setItems] = useState<ConfigItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ ok: boolean; data: ConfigItem[] }>('/admin/config')
      .then((res) => setItems(res?.data ?? []))
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'Error al cargar la configuración.'))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div>
        <Link
          href="/admin"
          className="text-xs text-[#1A1A1A]/40 transition-colors hover:text-[#2D6A4F]"
        >
          ← Panel admin
        </Link>
        <h1
          className="mt-1 text-3xl text-[#1A1A1A]"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Configuración global
        </h1>
        <p className="mt-0.5 text-sm text-[#1A1A1A]/50">
          Parámetros del sistema. Los cambios tienen efecto inmediato.
        </p>
      </div>

      {/* Cuerpo */}
      {cargando ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-[#1A1A1A]/8 bg-white"
            />
          ))}
        </div>
      ) : errorCarga ? (
        <div className="rounded-2xl border border-[#C0392B]/20 bg-[#C0392B]/8 px-5 py-4 text-sm text-[#C0392B]">
          {errorCarga}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/8 bg-white px-5 py-12 text-center">
          <p className="text-base font-semibold text-[#1A1A1A]/50">
            No hay claves de configuración registradas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <FilaConfig
              key={item.clave}
              item={item}
              estadoInicial={{
                valor: valorMostrar(item.clave, item.valor),
                guardando: false,
                aviso: null,
                mensajeError: null,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
