'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRegion } from '@/context/RegionContext'

/* ─── Tipos ─────────────────────────────────────────────────── */
interface CampanaIrruptor {
  id:         number
  tipo:       string
  titulo:     string
  subtitulo?: string | null
  imagenUrl:  string
  ctaTexto:   string
  urlDestino: string
  prioridad:  number
}

const VISITAS_KEY = 'afm_irruptor_visitas'
const LAST_KEY = 'afm_irruptor_last'
const FRECUENCIA_MS = 48 * 60 * 60 * 1000 // 48 horas

/* ─── Rutas donde nunca debe mostrarse ── */
function rutaExcluida(pathname: string): boolean {
  const exactas = ['/carrito', '/checkout', '/ingresar', '/registro']
  if (exactas.includes(pathname)) return true
  if (pathname.startsWith('/comerciante') || pathname.startsWith('/admin')) return true
  if (/^\/pedido\/[^/]+\/pago$/.test(pathname)) return true
  return false
}

/** Incrementa el contador de visitas en localStorage y devuelve el conteo actualizado. */
function registrarVisitaYContar(): number {
  try {
    const actual = Number(window.localStorage.getItem(VISITAS_KEY) ?? '0') || 0
    const nuevo = actual + 1
    window.localStorage.setItem(VISITAS_KEY, String(nuevo))
    return nuevo
  } catch {
    return 0
  }
}

function puedeMostrarPorFrecuencia(): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_KEY) ?? '0') || 0
    return Date.now() - last >= FRECUENCIA_MS
  } catch {
    return true
  }
}

function marcarMostrado() {
  try {
    window.localStorage.setItem(LAST_KEY, String(Date.now()))
  } catch { /* noop */ }
}

/* ─── Componente ──────────────────────────────────────────────── */
export default function IrruptorBienvenida() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')
  const { regionActiva } = useRegion()
  const pathname = usePathname()

  const [campana, setCampana] = useState<CampanaIrruptor | null>(null)
  const [visible, setVisible] = useState(false)

  /* ── Contar visita al montar (una vez por carga de la app) ── */
  useEffect(() => {
    const visitas = registrarVisitaYContar()
    // Primera visita (contador acaba de pasar a 1): nunca mostrar.
    if (visitas < 2) return
    if (!puedeMostrarPorFrecuencia()) return

    const qs = regionActiva ? `?tipo=IRRUPTOR_BIENVENIDA&departamento=${encodeURIComponent(regionActiva)}` : '?tipo=IRRUPTOR_BIENVENIDA'
    let cancelado = false
    fetch(`${API_URL}/campanas/activas${qs}`)
      .then(r => r.json())
      .then(j => {
        if (cancelado) return
        const items: CampanaIrruptor[] = Array.isArray(j.items) ? j.items : []
        if (items.length > 0) setCampana(items[0])
      })
      .catch(() => {})
    return () => { cancelado = true }
    // Solo se evalúa una vez al montar la app (región inicial); no se re-dispara si el usuario cambia de región después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Mostrar solo si hay campaña, no estamos en ruta excluida y no se ha mostrado ya en esta carga ── */
  useEffect(() => {
    if (!campana) return
    if (rutaExcluida(pathname ?? '')) return
    setVisible(true)
    marcarMostrado()
    fetch(`${API_URL}/campanas/${campana.id}/vista`, { method: 'POST' }).catch(() => {})
    // Solo debe dispararse una vez, cuando llega la campaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campana])

  function cerrar() {
    setVisible(false)
  }

  function clicCta() {
    if (campana) fetch(`${API_URL}/campanas/${campana.id}/clic`, { method: 'POST' }).catch(() => {})
  }

  if (!visible || !campana) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={campana.titulo}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={cerrar}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden bg-white shadow-2xl">
        {/* Botón cerrar — mínimo 44x44px, funcional desde el primer frame */}
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute top-2 right-2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Badge Patrocinado */}
        <span className="absolute top-3 left-3 z-10 bg-[#2D6A4F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none tracking-wide uppercase">
          Patrocinado
        </span>

        <div className="relative w-full" style={{ aspectRatio: '4 / 3' }}>
          <Image
            src={campana.imagenUrl}
            alt={campana.titulo}
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
            priority
          />
        </div>

        <div className="p-5 text-center">
          <h3 className="text-lg font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            {campana.titulo}
          </h3>
          {campana.subtitulo && (
            <p className="mt-1 text-sm text-[#1A1A1A]/60">{campana.subtitulo}</p>
          )}
          <a
            href={campana.urlDestino}
            onClick={clicCta}
            className="mt-4 inline-block w-full sm:w-auto bg-[#D4A017] text-[#1A1A1A] font-semibold px-8 py-3 rounded-full hover:shadow-lg transition-shadow"
          >
            {campana.ctaTexto}
          </a>
        </div>
      </div>
    </div>
  )
}
