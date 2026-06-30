'use client'

import { useEffect, useRef, useState } from 'react'
import {
  obtenerMiTransporte, actualizarMiTransporte, agregarRuta, actualizarRuta, eliminarRuta,
  reservasOperadorTransporte, cambiarEstadoReservaTransporte, subirFotosTransporte,
  subirVideoTransporte, quitarVideoTransporte,
  type ConfigTransporte, type RutaTransporte, type ReservaTransporte, type EstadoReservaTransporte,
} from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import SubidorVideo from '@/components/comerciante/SubidorVideo'
import type { VideoMetaCaptura, VideoEstado } from '@/components/comerciante/api'

const TIPO_OPCIONES = ['LANCHA', 'BOTE', 'CHALUPA', 'CANOA']
const TIPO_ICONO: Record<string, string> = { LANCHA: '🛥️', BOTE: '⛵', CHALUPA: '🚤', CANOA: '🛶' }
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

export default function ComercianteTransportesPage() {
  const [tab, setTab] = useState<'reservas' | 'rutas' | 'config'>('reservas')
  const [cfg, setCfg] = useState<ConfigTransporte | null>(null)
  const [reservas, setReservas] = useState<ReservaTransporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editCfg, setEditCfg] = useState<Partial<ConfigTransporte>>({})
  const [formRuta, setFormRuta] = useState<Partial<RutaTransporte>>(RUTA_VACIA)
  const [editandoRutaId, setEditandoRutaId] = useState<number | null>(null)
  const [mostrarFormRuta, setMostrarFormRuta] = useState(false)
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
        videoUrl: (t as any).videoUrl ?? null,
        videoPosterUrl: (t as any).videoPosterUrl ?? null,
        videoDuracionSegundos: null,
        videoMimeType: null,
      })
      setCargando(false)
    })
  }, [])

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

  if (cargando) return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#023E8A] border-t-transparent rounded-full animate-spin" /></div>

  const pendientes = reservas.filter(r => r.estado === 'PENDIENTE')
  const TABS = [
    { key: 'reservas', label: `Reservas${pendientes.length > 0 ? ` (${pendientes.length})` : ''}` },
    { key: 'rutas',    label: 'Rutas' },
    { key: 'config',   label: 'Configuración' },
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
              <label className="block text-xs text-gray-500 mb-1">Tipo de embarcación</label>
              <div className="flex flex-wrap gap-2">
                {TIPO_OPCIONES.map(tipo => (
                  <button key={tipo} onClick={() => setEditCfg(p => ({ ...p, tipo }))}
                    className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${editCfg.tipo === tipo ? 'bg-[#023E8A] text-white border-[#023E8A]' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {TIPO_ICONO[tipo]} {tipo}
                  </button>
                ))}
              </div>
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
            <SubidorVideo
              titulo="Video del servicio"
              descripcion="Sube un clip de hasta 45 segundos. Si el video es más largo, elige el fragmento que quieres mostrar."
              estadoInicial={videoEstadoTransporte}
              onSubir={handleSubirVideoTransporte}
              onEliminar={handleQuitarVideoTransporte}
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
