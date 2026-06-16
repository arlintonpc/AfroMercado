'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Modo   = 'FIJAS' | 'DINAMICO' | 'ALEATORIO'
type Fuente = 'ORGANICO' | 'CAMPANAS' | 'MIXTO'

const MODOS: { valor: Modo; label: string; desc: string; icono: string }[] = [
  { valor: 'FIJAS',    label: 'Fijas',    icono: '🖼️', desc: 'Las imágenes no cambian. Muestra siempre las primeras 4.' },
  { valor: 'DINAMICO', label: 'Dinámico', icono: '▶️', desc: 'Rotan en orden secuencial cada X segundos.' },
  { valor: 'ALEATORIO',label: 'Aleatorio',icono: '🔀', desc: 'Rotan en orden aleatorio sin repetir hasta completar el ciclo.' },
]

const FUENTES: { valor: Fuente; label: string; desc: string; icono: string }[] = [
  { valor: 'ORGANICO', label: 'Orgánico',  icono: '🌿', desc: 'Solo muestra productos del catálogo (gratis, automático).' },
  { valor: 'CAMPANAS', label: 'Campañas',  icono: '📢', desc: 'Muestra campañas activas: publicidad pagada y contenido social. Si no hay, muestra orgánico.' },
  { valor: 'MIXTO',    label: 'Mixto',     icono: '⚡', desc: 'Intercala publicidad pagada cada 3 productos; las sociales entran como comunidad.' },
]

function RadioGroup({ opciones, valor, onChange }: {
  opciones: { valor: string; label: string; desc: string; icono: string }[]
  valor:    string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {opciones.map(o => (
        <label key={o.valor} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${valor === o.valor ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 shadow-sm' : 'border-[#1A1A1A]/10 hover:border-[#2D6A4F]/40'}`}>
          <input type="radio" checked={valor === o.valor} onChange={() => onChange(o.valor)} className="mt-0.5 accent-[#2D6A4F]" />
          <div>
            <p className="font-semibold text-[#1A1A1A] text-sm"><span className="mr-1.5">{o.icono}</span>{o.label}</p>
            <p className="text-[#1A1A1A]/55 text-xs mt-0.5 leading-relaxed">{o.desc}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

export default function AdminHeroPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

  const [modo,     setModo]     = useState<Modo>('FIJAS')
  const [fuente,   setFuente]   = useState<Fuente>('ORGANICO')
  const [intervalo,setIntervalo]= useState(10)
  const [cargando, setCargando] = useState(true)
  const [guardando,setGuardando]= useState(false)
  const [aviso,    setAviso]    = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/config/hero`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) { setModo(j.modo); setIntervalo(j.intervaloSegundos); setFuente(j.fuente) }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [API_URL])

  async function guardar() {
    setGuardando(true)
    setAviso(null)
    try {
      const token = localStorage.getItem('afromercado_token')
      const r = await fetch(`${API_URL}/config/hero`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ modo, intervaloSegundos: intervalo, fuente }),
      })
      if (!r.ok) throw new Error('No se pudo guardar')
      setAviso({ tipo: 'ok', texto: 'Configuración guardada. Los cambios se ven al recargar la página principal.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al guardar' })
    } finally { setGuardando(false) }
  }

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      <div>
        <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Hero banner
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          Controla qué se muestra en el banner principal y cómo rota.
        </p>
      </div>

      {aviso && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${aviso.tipo === 'ok' ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]' : 'border-red-300/40 bg-red-50 text-red-700'}`}>
          {aviso.texto}
        </div>
      )}

      {cargando ? (
        <div className="h-48 rounded-2xl bg-white border border-[#1A1A1A]/5 animate-pulse" />
      ) : (
        <>
          {/* Fuente de contenido */}
          <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Fuente de contenido</h2>
              <Link href="/admin/campanas" className="text-xs text-[#2D6A4F] font-semibold hover:underline">
                Gestionar campañas →
              </Link>
            </div>
            <RadioGroup opciones={FUENTES} valor={fuente} onChange={v => setFuente(v as Fuente)} />

            {fuente !== 'ORGANICO' && (
              <div className="mt-3 rounded-lg bg-[#D4A017]/10 border border-[#D4A017]/25 px-3 py-2.5 text-xs text-[#B8860B]">
                <strong>Importante:</strong> necesitas tener campañas activas, pagadas o sociales, en el período correcto para que se muestren.
                {' '}<Link href="/admin/campanas" className="underline font-semibold">Crear campaña</Link>
              </div>
            )}
          </section>

          {/* Modo de rotación */}
          <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Modo de rotación</h2>
            <RadioGroup opciones={MODOS} valor={modo} onChange={v => setModo(v as Modo)} />
          </section>

          {/* Intervalo */}
          {modo !== 'FIJAS' && (
            <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">Intervalo de rotación</h2>
              <p className="text-xs text-[#1A1A1A]/50 mb-5">Cada cuántos segundos cambia el grupo de 4 imágenes (5 – 300 s).</p>
              <div className="flex items-center gap-4">
                <input type="range" min={5} max={120} step={5} value={Math.min(intervalo, 120)} onChange={e => setIntervalo(Number(e.target.value))} className="flex-1 accent-[#2D6A4F] cursor-pointer" />
                <div className="w-24 text-center flex-shrink-0">
                  <span className="text-2xl font-bold text-[#2D6A4F]">{intervalo}</span>
                  <span className="text-xs text-[#1A1A1A]/50 ml-1">seg</span>
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#1A1A1A]/35 mt-1 px-0.5">
                <span>5 s · rápido</span><span>30 s</span><span>60 s</span><span>120 s · lento</span>
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#1A1A1A]/6">
                <label className="text-xs text-[#1A1A1A]/60 whitespace-nowrap">Valor exacto:</label>
                <input type="number" min={5} max={300} value={intervalo} onChange={e => setIntervalo(Math.max(5, Math.min(300, Number(e.target.value))))} className="w-24 rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
                <span className="text-xs text-[#1A1A1A]/40">segundos</span>
              </div>
            </section>
          )}

          {/* Vista previa textual */}
          <div className="rounded-xl bg-[#F0EBE3] px-4 py-3 text-sm text-[#2D6A4F]">
            <strong>Vista previa:</strong>{' '}
            {(() => {
              const fuenteTexto = fuente === 'ORGANICO' ? 'productos del catálogo' : fuente === 'CAMPANAS' ? 'campañas activas' : 'publicidad, comunidad y productos orgánicos'
              if (modo === 'FIJAS') return `El hero mostrará siempre las mismas 4 imágenes de ${fuenteTexto}.`
              return `El hero mostrará ${fuenteTexto} y rotará ${modo === 'ALEATORIO' ? 'aleatoriamente' : 'en orden'} cada ${intervalo} segundos.`
            })()}
          </div>

          <button onClick={guardar} disabled={guardando} className="self-start bg-[#2D6A4F] text-white font-semibold px-7 py-3 rounded-full hover:bg-[#245a42] transition-colors disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </>
      )}
    </div>
  )
}
