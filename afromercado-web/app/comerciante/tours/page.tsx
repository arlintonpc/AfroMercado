'use client'

import { useEffect, useRef, useState } from 'react'
import { obtenerMiTour, actualizarMiTour, reservasOperadorTour, cambiarEstadoReservaTour, subirFotosTour, type ConfigTour, type ReservaTour, type EstadoReservaTour } from '@/lib/api/tour'
import { formatearPrecio } from '@/lib/formatearPrecio'

const SERVICIOS_OPCIONES = [
  { key: 'transporte', label: '🚐 Transporte' },
  { key: 'almuerzo',   label: '🍱 Almuerzo' },
  { key: 'guia',       label: '🧭 Guía' },
  { key: 'equipo',     label: '🎒 Equipo' },
  { key: 'foto',       label: '📸 Fotografía' },
  { key: 'seguro',     label: '🛡️ Seguro' },
  { key: 'snacks',     label: '🍎 Snacks' },
  { key: 'audio',      label: '🎧 Audioguía' },
]

const IDIOMAS_OPCIONES = ['Español', 'English', 'Français', 'Português', 'Deutsch']

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-700',
  CONFIRMADA: 'bg-green-100 text-green-700',
  COMPLETADA: 'bg-blue-100 text-blue-700',
  CANCELADA:  'bg-red-100 text-red-600',
  RECHAZADA:  'bg-red-100 text-red-600',
}

const ACCIONES: Record<string, { label: string; estado: EstadoReservaTour }[]> = {
  PENDIENTE:  [{ label: '✅ Confirmar', estado: 'CONFIRMADA' }, { label: '🚫 Rechazar', estado: 'RECHAZADA' }],
  CONFIRMADA: [{ label: '🎉 Completar', estado: 'COMPLETADA' }, { label: '❌ Cancelar', estado: 'CANCELADA' }],
}

export default function ComercianteTourPage() {
  const [tab, setTab] = useState<'reservas' | 'config'>('reservas')
  const [tour, setTour] = useState<ConfigTour | null>(null)
  const [reservas, setReservas] = useState<ReservaTour[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFotos, setSubiendoFotos] = useState(false)
  const [editConfig, setEditConfig] = useState<Partial<ConfigTour>>({})
  const reservasRef = useRef<ReservaTour[]>([])
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const pendientes = reservas.filter(r => r.estado === 'PENDIENTE')

  useEffect(() => {
    Promise.all([obtenerMiTour(), reservasOperadorTour()]).then(([t, rs]) => {
      setTour(t)
      setEditConfig(t)
      setReservas(rs)
      reservasRef.current = rs
      setCargando(false)
    })
  }, [])

  // Polling de reservas cada 20s
  useEffect(() => {
    const iv = setInterval(() => {
      reservasOperadorTour().then(nuevas => {
        const prev = reservasRef.current
        const hayNuevasPendientes = nuevas.some(n => n.estado === 'PENDIENTE' && !prev.find(p => p.id === n.id))
        if (hayNuevasPendientes) {
          try {
            const ctx = new AudioContext()
            const beep = (t: number) => {
              const osc = ctx.createOscillator(); const g = ctx.createGain()
              osc.connect(g); g.connect(ctx.destination)
              osc.frequency.value = 660; g.gain.setValueAtTime(0.3, t)
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
              osc.start(t); osc.stop(t + 0.35)
            }
            beep(ctx.currentTime); beep(ctx.currentTime + 0.4); beep(ctx.currentTime + 0.8)
          } catch {}
        }
        reservasRef.current = nuevas
        setReservas(nuevas)
      })
    }, 20000)
    return () => clearInterval(iv)
  }, [])

  async function cambiarEstado(id: number, estado: EstadoReservaTour) {
    try {
      await cambiarEstadoReservaTour(id, estado)
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function subirFotos(archivos: FileList) {
    setSubiendoFotos(true)
    try {
      const t = await subirFotosTour(archivos)
      setTour(t)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSubiendoFotos(false)
    }
  }

  async function guardarConfig() {
    setGuardando(true)
    try {
      const t = await actualizarMiTour(editConfig)
      setTour(t)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const TABS = [
    { key: 'reservas', label: `Reservas${pendientes.length > 0 ? ` (${pendientes.length})` : ''}` },
    { key: 'config',   label: 'Configuración' },
  ] as const

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-12">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1A1A1A]">🗺️ {tour?.nombre ?? 'Mi Tour'}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${tour?.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">{tour?.activo ? 'Visible al público' : 'Oculto'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Reservas ── */}
      {tab === 'reservas' && (
        <div className="space-y-3">
          {reservas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🗺️</p>
              <p>Sin reservas todavía</p>
            </div>
          ) : reservas.map(r => {
            const fecha = new Date(r.fechaTour).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
            const acciones = ACCIONES[r.estado] ?? []
            return (
              <div key={r.id} className={`bg-white rounded-2xl border p-4 ${r.estado === 'PENDIENTE' ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#1A1A1A]">{r.nombreContacto}</p>
                    <p className="text-xs text-gray-500 mt-0.5">📅 {fecha} · 👥 {r.participantes} pers.</p>
                    <p className="text-xs text-gray-400 mt-0.5">📞 {r.telefonoContacto}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado] ?? ''}`}>
                      {r.estado}
                    </span>
                    <p className="text-sm font-bold text-[#2D6A4F] mt-1">{formatearPrecio(Number(r.total))}</p>
                  </div>
                </div>
                {r.notasCliente && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-2 py-1">💬 {r.notasCliente}</p>
                )}
                {acciones.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {acciones.map(a => (
                      <button key={a.estado} onClick={() => cambiarEstado(r.id, a.estado)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-300 mt-2 font-mono">{r.codigo}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Config ── */}
      {tab === 'config' && editConfig && (
        <div className="space-y-4">
          {/* Activo */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#1A1A1A]">Tour visible al público</p>
              <p className="text-xs text-gray-400 mt-0.5">Actívalo cuando tengas todo configurado</p>
            </div>
            <button onClick={() => setEditConfig(p => ({ ...p, activo: !p.activo }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${editConfig.activo ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editConfig.activo ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Confirmación automática */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#1A1A1A]">Confirmación automática</p>
              <p className="text-xs text-gray-400 mt-0.5">Confirmar reservas sin revisión manual</p>
            </div>
            <button onClick={() => setEditConfig(p => ({ ...p, confirmacionAuto: !p.confirmacionAuto }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${editConfig.confirmacionAuto ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editConfig.confirmacionAuto ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Datos básicos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-semibold text-[#1A1A1A]">Información del tour</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre del tour</label>
              <input value={editConfig.nombre ?? ''} onChange={e => setEditConfig(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <textarea value={editConfig.descripcion ?? ''} onChange={e => setEditConfig(p => ({ ...p, descripcion: e.target.value }))}
                rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duración (horas)</label>
                <input type="number" min={0.5} step={0.5} value={editConfig.duracionHoras ?? 2}
                  onChange={e => setEditConfig(p => ({ ...p, duracionHoras: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio / persona</label>
                <input type="number" min={0} value={Number(editConfig.precioPersona ?? 0)}
                  onChange={e => setEditConfig(p => ({ ...p, precioPersona: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Máx. participantes por fecha</label>
              <input type="number" min={1} value={editConfig.maxParticipantes ?? 10}
                onChange={e => setEditConfig(p => ({ ...p, maxParticipantes: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Punto de encuentro</label>
              <input value={editConfig.puntoEncuentro ?? ''} onChange={e => setEditConfig(p => ({ ...p, puntoEncuentro: e.target.value }))}
                placeholder="Ej: Parque principal de Quibdó"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
          </div>

          {/* Servicios incluidos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">¿Qué incluye?</h3>
            <div className="flex flex-wrap gap-2">
              {SERVICIOS_OPCIONES.map(s => {
                const sel = (editConfig.servicios ?? []).includes(s.key)
                return (
                  <button key={s.key} onClick={() => setEditConfig(p => ({
                    ...p,
                    servicios: sel ? (p.servicios ?? []).filter(x => x !== s.key) : [...(p.servicios ?? []), s.key]
                  }))} className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                    sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Idiomas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">Idiomas</h3>
            <div className="flex flex-wrap gap-2">
              {IDIOMAS_OPCIONES.map(lang => {
                const sel = (editConfig.idiomas ?? []).includes(lang)
                return (
                  <button key={lang} onClick={() => setEditConfig(p => ({
                    ...p,
                    idiomas: sel ? (p.idiomas ?? []).filter(x => x !== lang) : [...(p.idiomas ?? []), lang]
                  }))} className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                    sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {lang}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">Fotos del tour</h3>
            {(tour?.fotos ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {tour?.fotos.map((f, i) => (
                  <img key={i} src={f} alt="" className="w-full h-20 object-cover rounded-xl" />
                ))}
              </div>
            )}
            <input ref={inputFotoRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && subirFotos(e.target.files)} />
            <button onClick={() => inputFotoRef.current?.click()} disabled={subiendoFotos}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:border-[#2D6A4F] hover:text-[#2D6A4F] disabled:opacity-50 transition-colors">
              {subiendoFotos ? '⏳ Subiendo…' : '📸 Agregar fotos'}
            </button>
          </div>

          {/* Política cancelación */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#1A1A1A] mb-2">Política de cancelación</h3>
            <textarea value={editConfig.politicaCancelacion ?? ''} rows={3}
              onChange={e => setEditConfig(p => ({ ...p, politicaCancelacion: e.target.value }))}
              placeholder="Describe tu política de cancelación y reembolsos…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
          </div>

          <button onClick={guardarConfig} disabled={guardando}
            className="w-full bg-[#2D6A4F] text-white font-bold py-3.5 rounded-2xl hover:bg-[#40916C] disabled:opacity-50 transition-colors">
            {guardando ? 'Guardando…' : '💾 Guardar configuración'}
          </button>
        </div>
      )}
    </div>
  )
}
