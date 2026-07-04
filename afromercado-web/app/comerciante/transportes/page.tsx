'use client'

import { useEffect, useRef, useState } from 'react'
import {
  obtenerMiTransporte, actualizarMiTransporte, agregarRuta, actualizarRuta, eliminarRuta,
  reservasOperadorTransporte, cambiarEstadoReservaTransporte, subirFotosTransporte,
  subirVideoTransporte, quitarVideoTransporte, guardarVideoLinkTransporte,
  estadisticasTransporte,
  listarCuponesTransporte, crearCuponTransporte, eliminarCuponTransporte,
  type ConfigTransporte, type RutaTransporte, type ReservaTransporte, type EstadoReservaTransporte, type EstadisticasTransporte,
  type CuponTransporte,
} from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import SubidorVideoOLink from '@/components/comerciante/SubidorVideoOLink'
import type { VideoMetaCaptura, VideoEstado } from '@/components/comerciante/api'

const TIPO_OPCIONES = [
  // Fluvial
  'LANCHA', 'BOTE', 'CHALUPA', 'CANOA', 'PIRAGUA', 'FERRY',
  // Terrestre
  'BUS', 'CHIVA', 'VAN', 'MOTOTAXI', 'RAPIMOTO', 'PICKUP',
  // Turístico
  'TOUR_FLUVIAL', 'PAQUETE_MIXTO',
]

const TIPO_ICONO: Record<string, string> = {
  // Fluvial
  LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶', PIRAGUA: '🚣', FERRY: '⛴️',
  // Terrestre
  BUS: '🚌', CHIVA: '🚐', VAN: '🚐', MOTOTAXI: '🏍️', RAPIMOTO: '🏍️', PICKUP: '🛻',
  // Turístico
  TOUR_FLUVIAL: '🌊', PAQUETE_MIXTO: '🗺️',
}

const TIPO_CATEGORIA: Record<string, string> = {
  LANCHA: 'Fluvial', BOTE: 'Fluvial', CHALUPA: 'Fluvial', CANOA: 'Fluvial', PIRAGUA: 'Fluvial', FERRY: 'Fluvial',
  BUS: 'Terrestre', CHIVA: 'Terrestre', VAN: 'Terrestre', MOTOTAXI: 'Terrestre', RAPIMOTO: 'Terrestre', PICKUP: 'Terrestre',
  TOUR_FLUVIAL: 'Turístico', PAQUETE_MIXTO: 'Turístico',
}

const TIPO_LABEL: Record<string, string> = {
  LANCHA: 'Lancha', BOTE: 'Bote de motor', CHALUPA: 'Chalupa', CANOA: 'Canoa', PIRAGUA: 'Piragua', FERRY: 'Ferry',
  BUS: 'Bus intermunicipal', CHIVA: 'Chiva', VAN: 'Van / Buseta', MOTOTAXI: 'Mototaxi', RAPIMOTO: 'Rapimoto', PICKUP: 'Pickup / Camioneta',
  TOUR_FLUVIAL: 'Tour fluvial guiado', PAQUETE_MIXTO: 'Paquete turístico mixto',
}
const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL: Record<string, string> = { lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', domingo: 'Do' }

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700', CONFIRMADA: 'bg-green-100 text-green-700',
  COMPLETADA: 'bg-blue-100 text-blue-700',  CANCELADA: 'bg-red-100 text-red-600', RECHAZADA: 'bg-red-100 text-red-600',
}
const ACCIONES: Record<string, { label: string; estado: EstadoReservaTransporte }[]> = {
  PENDIENTE:  [{ label: '✅ Confirmar', estado: 'CONFIRMADA' }, { label: '🚫 Rechazar', estado: 'RECHAZADA' }],
  CONFIRMADA: [{ label: '✈️ Completar', estado: 'COMPLETADA' }, { label: '❌ Cancelar', estado: 'CANCELADA' }],
}

const RUTA_VACIA = { origen: '', destino: '', horario: '', diasSemana: [] as string[], capacidad: 10, precioAsiento: 0, activo: true }

function FormNuevoCuponTransporte({ onCreado, onCancelar }: { onCreado: () => void; onCancelar: () => void }) {
  const [form, setForm] = useState({
    codigo: '',
    tipo: 'PORCENTAJE' as 'PORCENTAJE' | 'VALOR_FIJO',
    valor: '',
    minimoAsientos: '',
    usosMaximos: '',
    inicio: '',
    fin: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!form.codigo.trim() || !form.valor || !form.inicio || !form.fin) {
      setError('Completa código, valor, fecha inicio y fecha fin')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await crearCuponTransporte({
        codigo: form.codigo.trim().toUpperCase(),
        tipo: form.tipo,
        valor: Number(form.valor),
        minimoAsientos: form.minimoAsientos ? Number(form.minimoAsientos) : undefined,
        usosMaximos: form.usosMaximos ? Number(form.usosMaximos) : undefined,
        inicio: form.inicio,
        fin: form.fin,
      })
      onCreado()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear cupón')
    }
    setGuardando(false)
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">Nuevo cupón</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
          <input type="text" value={form.codigo}
            onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
            placeholder="Ej: AFRO20"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A] uppercase" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
          <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'PORCENTAJE' | 'VALOR_FIJO' }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]">
            <option value="PORCENTAJE">Porcentaje (%)</option>
            <option value="VALOR_FIJO">Valor fijo ($)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Valor *</label>
          <input type="number" min={0} value={form.valor}
            onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
            placeholder={form.tipo === 'PORCENTAJE' ? '20' : '10000'}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mín. asientos</label>
          <input type="number" min={1} value={form.minimoAsientos}
            onChange={e => setForm(p => ({ ...p, minimoAsientos: e.target.value }))}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Usos máx.</label>
          <input type="number" min={1} value={form.usosMaximos}
            onChange={e => setForm(p => ({ ...p, usosMaximos: e.target.value }))}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
          <input type="date" value={form.inicio}
            onChange={e => setForm(p => ({ ...p, inicio: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin *</label>
          <input type="date" value={form.fin}
            onChange={e => setForm(p => ({ ...p, fin: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={guardar} disabled={guardando}
          className="flex-1 bg-[#023E8A] text-white font-bold py-2 rounded-xl text-sm hover:bg-[#0077B6] transition-colors disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Crear cupón'}
        </button>
      </div>
    </div>
  )
}

export default function ComercianteTransportesPage() {
  const [tab, setTab] = useState<'reservas' | 'rutas' | 'cupones' | 'estadisticas' | 'config'>('reservas')
  const [cfg, setCfg] = useState<ConfigTransporte | null>(null)
  const [reservas, setReservas] = useState<ReservaTransporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editCfg, setEditCfg] = useState<Partial<ConfigTransporte>>({})
  const [formRuta, setFormRuta] = useState<Partial<RutaTransporte>>(RUTA_VACIA)
  const [editandoRutaId, setEditandoRutaId] = useState<number | null>(null)
  const [mostrarFormRuta, setMostrarFormRuta] = useState(false)
  const [stats, setStats] = useState<EstadisticasTransporte | null>(null)
  const [cargandoStats, setCargandoStats] = useState(false)
  const [desdeFiltro, setDesdeFiltro] = useState('')
  const [hastaFiltro, setHastaFiltro] = useState('')
  const [cupones, setCupones] = useState<CuponTransporte[]>([])
  const [mostrarFormCupon, setMostrarFormCupon] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const reservasRef = useRef<ReservaTransporte[]>([])
  const [videoEstadoTransporte, setVideoEstadoTransporte] = useState<VideoEstado>({
    videoUrl: null,
    videoPosterUrl: null,
    videoDuracionSegundos: null,
    videoMimeType: null,
  })

  useEffect(() => {
    Promise.all([obtenerMiTransporte(), reservasOperadorTransporte()]).then(([t, rs]) => {
      setCfg(t); setEditCfg(t); setReservas(rs); reservasRef.current = rs
      setVideoEstadoTransporte({
        videoUrl: t.videoUrl ?? null,
        videoPosterUrl: t.videoPosterUrl ?? null,
        videoDuracionSegundos: null,
        videoMimeType: null,
      })
      setCargando(false)
    })
  }, [])

  useEffect(() => {
    if (tab !== 'estadisticas' || stats) return
    cargarEstadisticas()
  }, [tab])

  async function cargarEstadisticas(params?: { desde?: string; hasta?: string }) {
    setCargandoStats(true)
    try {
      const s = await estadisticasTransporte(params)
      setStats(s)
    } catch {}
    finally { setCargandoStats(false) }
  }

  async function cargarCupones() {
    try {
      const data = await listarCuponesTransporte()
      setCupones(data)
    } catch {}
  }

  useEffect(() => {
    if (cfg) cargarCupones()
  }, [cfg])

  useEffect(() => {
    const iv = setInterval(() => {
      reservasOperadorTransporte().then(nuevas => {
        const prev = reservasRef.current
        const hayNuevas = nuevas.some(n => n.estado === 'PENDIENTE' && !prev.find(p => p.id === n.id))
        if (hayNuevas) {
          try { const ctx = new AudioContext(); const b = (t: number) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 520; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.start(t); o.stop(t + 0.35) }; b(ctx.currentTime); b(ctx.currentTime + 0.4) } catch {}
        }
        reservasRef.current = nuevas; setReservas(nuevas)
      })
    }, 20000)
    return () => clearInterval(iv)
  }, [])

  async function cambiarEstado(id: number, estado: EstadoReservaTransporte) {
    try { await cambiarEstadoReservaTransporte(id, estado); setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r)) }
    catch (e: any) { alert(e.message) }
  }

  async function guardarConfig() {
    setGuardando(true)
    try { const t = await actualizarMiTransporte(editCfg); setCfg(t) }
    catch (e: any) { alert(e.message) }
    finally { setGuardando(false) }
  }

  async function guardarRuta() {
    setGuardando(true)
    try {
      if (editandoRutaId) {
        const r = await actualizarRuta(editandoRutaId, formRuta)
        setCfg(prev => prev ? { ...prev, rutas: prev.rutas.map(x => x.id === editandoRutaId ? r : x) } : prev)
      } else {
        const r = await agregarRuta(formRuta)
        setCfg(prev => prev ? { ...prev, rutas: [...prev.rutas, r] } : prev)
      }
      setMostrarFormRuta(false); setFormRuta(RUTA_VACIA); setEditandoRutaId(null)
    } catch (e: any) { alert(e.message) }
    finally { setGuardando(false) }
  }

  async function borrarRuta(id: number) {
    if (!confirm('¿Desactivar esta ruta?')) return
    try { await eliminarRuta(id); setCfg(prev => prev ? { ...prev, rutas: prev.rutas.map(r => r.id === id ? { ...r, activo: false } : r) } : prev) }
    catch (e: any) { alert(e.message) }
  }

  async function subirFotos(files: FileList) {
    try { const t = await subirFotosTransporte(Array.from(files)); setCfg(t) } catch (e: any) { alert(e.message) }
  }

  async function handleSubirVideoTransporte(file: File, meta: VideoMetaCaptura): Promise<VideoEstado> {
    const r = await subirVideoTransporte(file, meta)
    const nuevo: VideoEstado = { videoUrl: r.videoUrl, videoPosterUrl: r.videoPosterUrl ?? null, videoDuracionSegundos: meta.duracionSegundos, videoMimeType: file.type }
    setVideoEstadoTransporte(nuevo)
    return nuevo
  }

  async function handleQuitarVideoTransporte(): Promise<VideoEstado> {
    await quitarVideoTransporte()
    const vacio: VideoEstado = { videoUrl: null, videoPosterUrl: null, videoDuracionSegundos: null, videoMimeType: null }
    setVideoEstadoTransporte(vacio)
    return vacio
  }

  async function handleGuardarLinkTransporte(url: string): Promise<VideoEstado> {
    await guardarVideoLinkTransporte(url)
    const nuevo: VideoEstado = { videoUrl: url, videoPosterUrl: null, videoDuracionSegundos: null, videoMimeType: null }
    setVideoEstadoTransporte(nuevo)
    return nuevo
  }

  if (cargando) return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#023E8A] border-t-transparent rounded-full animate-spin" /></div>

  const pendientes = reservas.filter(r => r.estado === 'PENDIENTE')
  const TABS = [
    { key: 'reservas',     label: `Reservas${pendientes.length > 0 ? ` (${pendientes.length})` : ''}` },
    { key: 'rutas',        label: 'Rutas' },
    { key: 'cupones',      label: 'Cupones' },
    { key: 'estadisticas', label: 'Estadísticas' },
    { key: 'config',       label: 'Configuración' },
  ] as const

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-12">
      <div className="mb-5">
        <h1 className="text-xl font-bold">{TIPO_ICONO[cfg?.tipo ?? ''] ?? '🛥️'} {cfg?.nombre}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${cfg?.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">{cfg?.activo ? 'Visible al público' : 'Oculto'}</span>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${tab === t.key ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Reservas ── */}
      {tab === 'reservas' && (
        <div className="space-y-3">
          {reservas.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-2">🛥️</p><p>Sin reservas todavía</p></div>
          ) : reservas.map(r => {
            const ruta = r.ruta
            const acciones = ACCIONES[r.estado] ?? []
            return (
              <div key={r.id} className={`bg-white rounded-2xl border p-4 ${r.estado === 'PENDIENTE' ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{r.nombreContacto}</p>
                    <p className="text-xs text-gray-500">{ruta?.origen} → {ruta?.destino}</p>
                    <p className="text-xs text-gray-400">📅 {new Date(r.fechaViaje).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {ruta?.horario} · {r.asientos} asiento{r.asientos !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-gray-400">📞 {r.telefonoContacto}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado] ?? ''}`}>{r.estado}</span>
                    <p className="text-sm font-bold text-[#023E8A] mt-1">{formatearPrecio(Number(r.total))}</p>
                  </div>
                </div>
                {acciones.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {acciones.map(a => (
                      <button key={a.estado} onClick={() => cambiarEstado(r.id, a.estado)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50">{a.label}</button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-300 mt-2 font-mono">{r.codigo}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Rutas ── */}
      {tab === 'rutas' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Rutas activas</h2>
            <button onClick={() => { setFormRuta(RUTA_VACIA); setEditandoRutaId(null); setMostrarFormRuta(true) }}
              className="text-xs bg-[#023E8A] text-white px-3 py-1.5 rounded-xl">+ Nueva ruta</button>
          </div>

          <div className="space-y-3 mb-4">
            {(cfg?.rutas ?? []).filter(r => r.activo).map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{r.origen} → {r.destino}</p>
                    <p className="text-xs text-gray-500 mt-0.5">🕐 {r.horario} · 👥 {r.capacidad} asientos</p>
                    {r.diasSemana.length > 0 && (
                      <div className="flex gap-1 mt-1">{r.diasSemana.map(d => <span key={d} className="text-[10px] bg-[#023E8A]/10 text-[#023E8A] px-1.5 py-0.5 rounded font-medium">{DIAS_LABEL[d]}</span>)}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#023E8A]">{formatearPrecio(Number(r.precioAsiento))}</p>
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => { setFormRuta(r); setEditandoRutaId(r.id); setMostrarFormRuta(true) }}
                        className="text-xs border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">Editar</button>
                      <button onClick={() => borrarRuta(r.id)}
                        className="text-xs border border-red-100 text-red-500 px-2 py-1 rounded-lg hover:bg-red-50">Quitar</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(cfg?.rutas ?? []).filter(r => r.activo).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Sin rutas. Crea la primera.</p>
            )}
          </div>

          {mostrarFormRuta && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
                <div className="flex justify-between mb-1">
                  <h3 className="font-bold">{editandoRutaId ? 'Editar ruta' : 'Nueva ruta'}</h3>
                  <button onClick={() => setMostrarFormRuta(false)} className="text-gray-400 text-xl">×</button>
                </div>
                {['origen', 'destino'].map(campo => (
                  <div key={campo}>
                    <label className="block text-xs text-gray-500 mb-1 capitalize">{campo}</label>
                    <input value={(formRuta as any)[campo] ?? ''} onChange={e => setFormRuta(p => ({ ...p, [campo]: e.target.value }))}
                      placeholder={campo === 'origen' ? 'Ej: Quibdó' : 'Ej: Nuquí'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Horario (HH:MM)</label>
                    <input type="time" value={formRuta.horario ?? ''} onChange={e => setFormRuta(p => ({ ...p, horario: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Capacidad</label>
                    <input type="number" min={1} value={formRuta.capacidad ?? 10} onChange={e => setFormRuta(p => ({ ...p, capacidad: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio por asiento</label>
                  <input type="number" min={0} value={Number(formRuta.precioAsiento ?? 0)} onChange={e => setFormRuta(p => ({ ...p, precioAsiento: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Días de operación</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map(d => {
                      const sel = (formRuta.diasSemana ?? []).includes(d)
                      return (
                        <button key={d} onClick={() => setFormRuta(p => ({
                          ...p, diasSemana: sel ? (p.diasSemana ?? []).filter(x => x !== d) : [...(p.diasSemana ?? []), d]
                        }))} className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${sel ? 'bg-[#023E8A] text-white border-[#023E8A]' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {DIAS_LABEL[d]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setMostrarFormRuta(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm">Cancelar</button>
                  <button onClick={guardarRuta} disabled={guardando} className="flex-1 bg-[#023E8A] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cupones ── */}
      {tab === 'cupones' && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Cupones de descuento</h2>
            <button onClick={() => setMostrarFormCupon(true)}
              className="text-sm font-medium bg-[#023E8A] text-white px-4 py-2 rounded-xl hover:bg-[#0077B6] transition-colors">
              + Nuevo cupón
            </button>
          </div>

          {cupones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin cupones activos. Crea uno para ofrecer descuentos a tus pasajeros.</p>
          ) : (
            <div className="space-y-2">
              {cupones.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-mono font-semibold text-sm text-[#023E8A]">{c.codigo}</p>
                    <p className="text-xs text-gray-500">
                      {c.tipo === 'PORCENTAJE' ? `${c.valor}% descuento` : `$${Number(c.valor).toLocaleString('es-CO')} fijo`}
                      {c.minimoAsientos ? ` · mín. ${c.minimoAsientos} asientos` : ''}
                      {' · '}{c.usosActuales}{c.usosMaximos ? `/${c.usosMaximos}` : ''} usos
                      {' · '}{new Date(c.fin) > new Date() ? <span className="text-emerald-600">Activo</span> : <span className="text-red-500">Vencido</span>}
                    </p>
                  </div>
                  <button onClick={() => eliminarCuponTransporte(c.id).then(cargarCupones)}
                    className="text-xs text-red-400 hover:text-red-600">Desactivar</button>
                </div>
              ))}
            </div>
          )}

          {mostrarFormCupon && (
            <FormNuevoCuponTransporte onCreado={() => { setMostrarFormCupon(false); cargarCupones() }} onCancelar={() => setMostrarFormCupon(false)} />
          )}
        </div>
      )}

      {/* ── Estadísticas ── */}
      {tab === 'estadisticas' && (
        <div className="p-4 space-y-4">
          {cargandoStats ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" /></div>
          ) : stats ? (
            <>
              {/* Filtro por rango de fechas (consultas contables) */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Desde</label>
                  <input
                    type="date"
                    value={desdeFiltro}
                    onChange={e => setDesdeFiltro(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Hasta</label>
                  <input
                    type="date"
                    value={hastaFiltro}
                    onChange={e => setHastaFiltro(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={() => desdeFiltro && hastaFiltro && cargarEstadisticas({ desde: desdeFiltro, hasta: hastaFiltro })}
                  disabled={!desdeFiltro || !hastaFiltro}
                  className="px-4 py-1.5 rounded-lg bg-[#023E8A] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Consultar
                </button>
                {stats.rango && (
                  <button
                    onClick={() => { setDesdeFiltro(''); setHastaFiltro(''); cargarEstadisticas() }}
                    className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Resultado del rango consultado */}
              {stats.rango && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                  <h3 className="font-semibold text-gray-800">
                    Rango consultado: {stats.rango.desde} a {stats.rango.hasta}
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Reservas</p>
                      <p className="text-lg font-bold text-gray-800">{stats.rango.reservas}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Ingresos</p>
                      <p className="text-lg font-bold text-gray-800">{formatearPrecio(stats.rango.ingresos)}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Canceladas</p>
                      <p className="text-lg font-bold text-gray-800">{stats.rango.canceladas}</p>
                    </div>
                  </div>

                  {stats.rango.rutasPopulares.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Rutas más solicitadas</h4>
                      <div className="space-y-2">
                        {stats.rango.rutasPopulares.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{r.origen} → {r.destino}</span>
                            <span className="font-semibold text-[#2D6A4F]">{r.total} reservas</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.rango.reservas === 0 && (
                    <p className="text-sm text-gray-500">No hay reservas en este rango.</p>
                  )}
                </div>
              )}

              {/* KPIs principales */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total reservas', valor: stats.totalReservas, color: 'text-blue-700 bg-blue-50' },
                  { label: 'Completadas', valor: stats.reservasCompletadas, color: 'text-green-700 bg-green-50' },
                  { label: 'Ingresos mes', valor: formatearPrecio(stats.ingresoMes), color: 'text-[#1B4332] bg-[#2D6A4F]/10' },
                  { label: 'Ingresos total', valor: formatearPrecio(stats.ingresoTotal), color: 'text-[#1B4332] bg-[#2D6A4F]/10' },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-2xl p-4 ${kpi.color}`}>
                    <p className="text-xs font-medium opacity-70">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.valor}</p>
                  </div>
                ))}
              </div>

              {/* Ocupación promedio */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-2">Ocupación promedio</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className="bg-[#2D6A4F] h-3 rounded-full transition-all" style={{ width: `${stats.ocupacionPromedio}%` }} />
                  </div>
                  <span className="text-sm font-bold text-[#1B4332]">{stats.ocupacionPromedio}%</span>
                </div>
              </div>

              {/* Rutas más populares */}
              {stats.rutasPopulares.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Rutas más solicitadas</p>
                  <div className="space-y-2">
                    {stats.rutasPopulares.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{r.origen} → {r.destino}</span>
                        <span className="font-semibold text-[#2D6A4F]">{r.total} reservas</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial por mes */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-3">Últimos 6 meses</p>
                <div className="space-y-2">
                  {stats.reservasPorMes.map(m => (
                    <div key={m.mes} className="flex items-center gap-3 text-sm">
                      <span className="w-14 text-gray-400 text-xs flex-shrink-0">{m.mes}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-[#2D6A4F] h-2 rounded-full"
                          style={{ width: `${stats.reservasPorMes.length > 0 ? (m.total / Math.max(...stats.reservasPorMes.map(x => x.total), 1)) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-gray-600 text-xs">{m.total}</span>
                      <span className="w-24 text-right text-[#2D6A4F] text-xs font-medium">{formatearPrecio(m.ingresos)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 py-8">No hay datos disponibles</p>
          )}
        </div>
      )}

      {/* ── Configuración ── */}
      {tab === 'config' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div><p className="font-medium">Servicio visible al público</p><p className="text-xs text-gray-400 mt-0.5">Actívalo cuando las rutas estén listas</p></div>
            <button onClick={() => setEditCfg(p => ({ ...p, activo: !p.activo }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${editCfg.activo ? 'bg-[#023E8A]' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editCfg.activo ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h3 className="font-semibold">Información del servicio</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre del servicio</label>
              <input value={editCfg.nombre ?? ''} onChange={e => setEditCfg(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Tipo de transporte</label>
              {['Fluvial', 'Terrestre', 'Turístico'].map(cat => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {TIPO_OPCIONES.filter(t => TIPO_CATEGORIA[t] === cat).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditCfg(p => ({ ...p, tipo: t }))}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                          editCfg.tipo === t
                            ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#2D6A4F]'
                        }`}
                      >
                        <span>{TIPO_ICONO[t]}</span>
                        <span>{TIPO_LABEL[t]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <textarea value={editCfg.descripcion ?? ''} onChange={e => setEditCfg(p => ({ ...p, descripcion: e.target.value }))}
                rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#023E8A] resize-none" />
            </div>
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold mb-3">Fotos del servicio</h3>
            {(cfg?.fotos ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {cfg?.fotos.map((f, i) => (
                  <img key={i} src={f} className="w-full h-20 object-cover rounded-xl" />
                ))}
              </div>
            )}
            <input ref={inputFotoRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && subirFotos(e.target.files)} />
            <button onClick={() => inputFotoRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#023E8A] hover:text-[#023E8A] transition-colors">
              📸 Agregar fotos
            </button>
          </div>

          {/* Video */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Video del servicio</h3>
            <SubidorVideoOLink
              titulo="Video del servicio"
              estadoInicial={videoEstadoTransporte}
              onSubir={handleSubirVideoTransporte}
              onEliminar={handleQuitarVideoTransporte}
              onGuardarLink={handleGuardarLinkTransporte}
            />
          </div>

          <button onClick={guardarConfig} disabled={guardando}
            className="w-full bg-[#023E8A] text-white font-bold py-3.5 rounded-2xl hover:bg-[#0077B6] disabled:opacity-50 transition-colors">
            {guardando ? 'Guardando…' : '💾 Guardar configuración'}
          </button>
        </div>
      )}
    </div>
  )
}
