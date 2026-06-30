'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  obtenerMiHotel, actualizarMiHotel, agregarHabitacion, actualizarHabitacion, eliminarHabitacion,
  reservasHotelero, cambiarEstadoReserva, ocupacionHotel, subirFotosHabitacion, subirVideoHabitacion,
  quitarVideoHabitacion,
  listarHabitacionesFisicas, crearHabitacionFisica,
  cambiarEstadoHabitacionFisica, eliminarHabitacionFisica, asignarHabitacionFisicaReserva,
  listarBloqueos, crearBloqueo, eliminarBloqueo,
  listarCuponesHotel, crearCuponHotel, eliminarCuponHotel,
  listarTemporadasHotel, crearTemporadaHotel, eliminarTemporadaHotel,
  obtenerEstadisticasHotel,
  type ConfigHotel, type HabitacionTipo, type HabitacionFisica, type ReservaHotel,
  type EstadoReservaHotel, type EstadoHabitacionFisica, type BloqueoFecha, type CuponHotel,
  type TemporadaHotel, type EstadisticasHotel,
} from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { obtenerToken } from '@/lib/api/client'
import SubidorVideo from '@/components/comerciante/SubidorVideo'
import type { VideoMetaCaptura, VideoEstado } from '@/components/comerciante/api'

const SERVICIOS_OPCIONES = ['wifi', 'desayuno', 'parking', 'piscina', 'restaurante', 'aire', 'ventilador', 'gym', 'spa', 'bar', 'mascotas', 'tv', 'cocina', 'lavadora', 'agua_caliente', 'balcon']
const SERVICIOS_LABELS: Record<string, string> = {
  wifi: '📶 WiFi', desayuno: '🍳 Desayuno', parking: '🅿️ Parqueadero', piscina: '🏊 Piscina',
  restaurante: '🍽️ Restaurante', aire: '❄️ Aire acond.', ventilador: '🌀 Ventilador', gym: '💪 Gym', spa: '💆 Spa', bar: '🍸 Bar', mascotas: '🐾 Mascotas',
  tv: '📺 TV', cocina: '🍳 Cocina equipada', lavadora: '🧺 Lavadora', agua_caliente: '🚿 Agua caliente', balcon: '🌇 Balcón',
}

const ESTADO_RESERVA: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: '⏳ Pendiente',  color: 'bg-amber-100 text-amber-700' },
  CONFIRMADA: { label: '✅ Confirmada', color: 'bg-blue-100 text-blue-700' },
  CHECKIN:    { label: '🏨 Check-in',   color: 'bg-green-100 text-green-700' },
  CHECKOUT:   { label: '👋 Check-out',  color: 'bg-gray-100 text-gray-600' },
  CANCELADA:  { label: '❌ Cancelada',  color: 'bg-red-100 text-red-600' },
  RECHAZADA:  { label: '🚫 Rechazada',  color: 'bg-red-100 text-red-600' },
}

const TRANSICIONES: Record<string, { label: string; estado: EstadoReservaHotel; color: string }[]> = {
  PENDIENTE:  [{ label: '✅ Confirmar', estado: 'CONFIRMADA', color: 'bg-green-600' }, { label: '🚫 Rechazar', estado: 'RECHAZADA', color: 'bg-red-500' }],
  CONFIRMADA: [{ label: '🏨 Check-in',  estado: 'CHECKIN',    color: 'bg-blue-600'  }, { label: '❌ Cancelar', estado: 'CANCELADA',  color: 'bg-red-500' }],
  CHECKIN:    [{ label: '👋 Check-out', estado: 'CHECKOUT',   color: 'bg-gray-600'  }],
}

const ESTADO_HABITACION_FISICA: Record<string, { label: string; chip: string; card: string }> = {
  LIBRE: { label: 'Libre', chip: 'bg-emerald-50 text-emerald-700 border-emerald-100', card: 'border-emerald-100 bg-emerald-50/45' },
  OCUPADA: { label: 'Ocupada', chip: 'bg-[#1B4332] text-white border-[#1B4332]', card: 'border-[#1B4332]/20 bg-[#F4FBF7]' },
  RESERVADA: { label: 'Reservada', chip: 'bg-blue-50 text-blue-700 border-blue-100', card: 'border-blue-100 bg-blue-50/45' },
  ENTRA_HOY: { label: 'Entra hoy', chip: 'bg-amber-50 text-amber-800 border-amber-100', card: 'border-amber-100 bg-amber-50/50' },
  SALE_HOY: { label: 'Sale hoy', chip: 'bg-orange-50 text-orange-700 border-orange-100', card: 'border-orange-100 bg-orange-50/50' },
  LIMPIEZA: { label: 'Limpieza', chip: 'bg-cyan-50 text-cyan-700 border-cyan-100', card: 'border-cyan-100 bg-cyan-50/45' },
  MANTENIMIENTO: { label: 'Mantenimiento', chip: 'bg-gray-100 text-gray-700 border-gray-200', card: 'border-gray-200 bg-gray-50' },
  BLOQUEADA: { label: 'Bloqueada', chip: 'bg-red-50 text-red-700 border-red-100', card: 'border-red-100 bg-red-50/45' },
}

const ESTADOS_HABITACION_EDITABLES: EstadoHabitacionFisica[] = ['LIBRE', 'LIMPIEZA', 'MANTENIMIENTO', 'BLOQUEADA']
type TabHotel = 'reservas' | 'recepcion' | 'habitaciones' | 'config' | 'ocupacion' | 'bloqueos'

function esVideo(url: string): boolean {
  return url.includes('/video/upload/') || /\.(mp4|webm|mov|avi)$/i.test(url)
}

type MetodoPagoHotelKey = 'permitePagarAlLlegar' | 'permiteDeposito30' | 'permiteTotal'

function SwitchElegante({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={onClick}
      className={`group inline-flex min-w-[92px] items-center justify-between gap-2 rounded-full border px-2 py-1 text-[11px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25 ${
        activo
          ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/10 text-[#1B4332] shadow-sm'
          : 'border-gray-200 bg-white text-gray-400'
      }`}
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${activo ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`}>
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${activo ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
      <span>{activo ? 'Activo' : 'Inactivo'}</span>
    </button>
  )
}

function FormHabitacion({ inicial, onGuardar, onCancelar }: {
  inicial?: Partial<HabitacionTipo>
  onGuardar: (datos: Partial<HabitacionTipo>, archivos?: File[]) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState<Partial<HabitacionTipo>>({
    nombre: '', descripcion: '', capacidad: 2, precioPorNoche: 80000, cantidad: 1,
    fotos: [], serviciosExtra: [], ...inicial,
  })
  const [subiendoFotos, setSubiendoFotos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const archivosRef = useRef<File[]>([])

  // Estado de video para SubidorVideo — se inicializa con el video ya guardado
  const [videoEstado, setVideoEstado] = useState<VideoEstado>({
    videoUrl: inicial?.videoUrl ?? null,
    videoPosterUrl: inicial?.videoPosterUrl ?? null,
    videoDuracionSegundos: inicial?.videoDuracionSeg ?? null,
    videoMimeType: null,
  })

  async function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (inicial?.id) {
      setSubiendoFotos(true)
      try {
        const hab = await subirFotosHabitacion(inicial.id, files)
        setForm(p => ({ ...p, fotos: hab.fotos }))
      } catch (err: any) { setError(err.message) }
      setSubiendoFotos(false)
    } else {
      archivosRef.current = [...archivosRef.current, ...files]
      const urls = files.map(f => URL.createObjectURL(f))
      setForm(p => ({ ...p, fotos: [...(p.fotos ?? []), ...urls] }))
    }
    if (inputFotoRef.current) inputFotoRef.current.value = ''
  }

  // Callbacks para SubidorVideo — solo disponibles cuando la habitación ya tiene ID
  async function handleSubirVideo(file: File, meta: VideoMetaCaptura): Promise<VideoEstado> {
    if (!inicial?.id) {
      // Habitación nueva: guardamos el archivo para subirlo después del create
      archivosRef.current  // no usamos para video aquí — se maneja en onGuardar
      throw new Error('Guarda primero la habitación y luego sube el video.')
    }
    const result = await subirVideoHabitacion(inicial.id, file, meta)
    const nuevo: VideoEstado = {
      videoUrl: result.videoUrl,
      videoPosterUrl: result.videoPosterUrl ?? null,
      videoDuracionSegundos: result.videoDuracionSeg ?? null,
      videoMimeType: null,
    }
    setVideoEstado(nuevo)
    return nuevo
  }

  async function handleQuitarVideo(): Promise<VideoEstado> {
    if (inicial?.id) await quitarVideoHabitacion(inicial.id)
    const vacio: VideoEstado = { videoUrl: null, videoPosterUrl: null, videoDuracionSegundos: null, videoMimeType: null }
    setVideoEstado(vacio)
    return vacio
  }

  async function handleGuardar() {
    if (!form.nombre?.trim() || !form.precioPorNoche) { setError('Nombre y precio son obligatorios'); return }
    setGuardando(true); setError('')
    try {
      const datos = inicial?.id
        ? form
        : { ...form, fotos: (form.fotos ?? []).filter(f => !f.startsWith('blob:')) }
      await onGuardar(datos, !inicial?.id ? archivosRef.current : undefined)
    } catch (e: any) { setError(e.message) }
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{inicial?.id ? 'Editar habitación' : 'Nueva habitación'}</h3>
            <button onClick={onCancelar} className="text-gray-400 text-xl leading-none">×</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input value={form.nombre ?? ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Habitación Doble, Suite Junior"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <textarea value={form.descripcion ?? ''} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                rows={2} placeholder="Describe la habitación…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Capacidad</label>
                <input type="number" min={1} value={form.capacidad ?? 2} onChange={e => setForm(p => ({ ...p, capacidad: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Precio/noche *</label>
                <input type="number" min={0} value={form.precioPorNoche ?? ''} onChange={e => setForm(p => ({ ...p, precioPorNoche: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                <input type="number" min={1} value={form.cantidad ?? 1} onChange={e => setForm(p => ({ ...p, cantidad: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
            </div>

            {/* Fotos */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fotos de la habitación</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(form.fotos ?? []).filter(f => !esVideo(f)).map((f, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={f} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button onClick={() => setForm(p => ({ ...p, fotos: (p.fotos ?? []).filter(x => x !== f) }))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none">×</button>
                  </div>
                ))}
                <button type="button" onClick={() => inputFotoRef.current?.click()} disabled={subiendoFotos}
                  className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-[#2D6A4F] disabled:opacity-50 text-xl">
                  {subiendoFotos ? <span className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" /> : '+'}
                </button>
              </div>
              <input ref={inputFotoRef} type="file" accept="image/*" multiple onChange={handleFotos} className="hidden" />
              <p className="text-[10px] text-gray-400">Formatos: JPG, PNG, WEBP. Máx 8MB por foto.</p>

              {/* Video de la habitación */}
              <div className="mt-4">
                {inicial?.id ? (
                  <SubidorVideo
                    titulo="Video de la habitación"
                    descripcion="Sube un clip de hasta 45 segundos. Si el video es más largo, elige el fragmento que quieres publicar."
                    estadoInicial={videoEstado}
                    onSubir={handleSubirVideo}
                    onEliminar={handleQuitarVideo}
                  />
                ) : (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 text-center">
                    💡 Guarda la habitación primero y luego podrás subir el video.
                  </p>
                )}
              </div>
            </div>

            {/* Servicios extra por habitación */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Servicios de esta habitación</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['TV', 'Baño privado', 'Balcón', 'Vista al mar', 'Minibar', 'Caja fuerte', 'Secador de pelo',
                  'Aire acond.', 'Ventilador', 'Cocina equipada', 'Nevera', 'Lavadora', 'Agua caliente',
                  'WiFi', 'Jacuzzi', 'Terraza'].map(s => {
                  const sel = (form.serviciosExtra ?? []).includes(s)
                  return (
                    <button key={s} type="button" onClick={() => setForm(p => {
                      const list = p.serviciosExtra ?? []
                      return { ...p, serviciosExtra: sel ? list.filter(x => x !== s) : [...list, s] }
                    })} className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {s}
                    </button>
                  )
                })}
                {/* Personalizados ya guardados */}
                {(form.serviciosExtra ?? []).filter(s => !['TV','Baño privado','Balcón','Vista al mar','Minibar','Caja fuerte','Secador de pelo','Aire acond.','Ventilador','Cocina equipada','Nevera','Lavadora','Agua caliente','WiFi','Jacuzzi','Terraza'].includes(s)).map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-[#2D6A4F] text-white border-[#2D6A4F]">
                    {s}
                    <button type="button" onClick={() => setForm(p => ({ ...p, serviciosExtra: (p.serviciosExtra ?? []).filter(x => x !== s) }))}
                      className="hover:opacity-70 leading-none">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Ej: Vista al río, Chimenea…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#2D6A4F]"
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (!val) return
                    setForm(p => ({ ...p, serviciosExtra: (p.serviciosExtra ?? []).includes(val) ? p.serviciosExtra : [...(p.serviciosExtra ?? []), val] }));
                    (e.target as HTMLInputElement).value = ''
                  }} />
                <button type="button"
                  onClick={e => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement
                    const val = input.value.trim()
                    if (!val) return
                    setForm(p => ({ ...p, serviciosExtra: (p.serviciosExtra ?? []).includes(val) ? p.serviciosExtra : [...(p.serviciosExtra ?? []), val] }))
                    input.value = ''
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#1B4332] transition-colors whitespace-nowrap">
                  + Agregar
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={handleGuardar} disabled={guardando}
              className="w-full bg-[#2D6A4F] text-white font-bold py-2.5 rounded-xl text-sm hover:bg-[#40916C] transition-colors disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar habitación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormNuevoCupon({ onCreado, onCancelar }: { onCreado: () => void; onCancelar: () => void }) {
  const [form, setForm] = useState({
    codigo: '',
    tipo: 'PORCENTAJE' as 'PORCENTAJE' | 'VALOR_FIJO',
    valor: '',
    minimoNoches: '',
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
      await crearCuponHotel({
        codigo: form.codigo.trim().toUpperCase(),
        tipo: form.tipo,
        valor: Number(form.valor),
        minimoNoches: form.minimoNoches ? Number(form.minimoNoches) : undefined,
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
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] uppercase" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
          <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'PORCENTAJE' | 'VALOR_FIJO' }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]">
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
            placeholder={form.tipo === 'PORCENTAJE' ? '20' : '50000'}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mín. noches</label>
          <input type="number" min={1} value={form.minimoNoches}
            onChange={e => setForm(p => ({ ...p, minimoNoches: e.target.value }))}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Usos máx.</label>
          <input type="number" min={1} value={form.usosMaximos}
            onChange={e => setForm(p => ({ ...p, usosMaximos: e.target.value }))}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
          <input type="date" value={form.inicio}
            onChange={e => setForm(p => ({ ...p, inicio: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin *</label>
          <input type="date" value={form.fin}
            onChange={e => setForm(p => ({ ...p, fin: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={guardar} disabled={guardando}
          className="flex-1 bg-[#1B4332] text-white font-bold py-2 rounded-xl text-sm hover:bg-[#2D6A4F] transition-colors disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Crear cupón'}
        </button>
      </div>
    </div>
  )
}

function FormNuevaTemporada({
  habitaciones,
  onCreada,
  onCancelar,
}: {
  habitaciones: HabitacionTipo[]
  onCreada: () => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [precio, setPrecio] = useState('')
  const [habId, setHabId] = useState<string>('todas')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!nombre || !inicio || !fin || !precio) { setError('Completa todos los campos'); return }
    setGuardando(true); setError('')
    try {
      await crearTemporadaHotel({
        nombre,
        inicio,
        fin,
        precioPorNoche: Number(precio),
        habitacionTipoId: habId === 'todas' ? null : Number(habId),
      })
      onCreada()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
    setGuardando(false)
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <h3 className="font-semibold text-sm text-gray-800">Nueva temporada</h3>
      <input value={nombre} onChange={e => setNombre(e.target.value)}
        placeholder="Ej: Semana Santa 2027, Temporada alta..."
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Fecha inicio</label>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Fecha fin</label>
          <input type="date" value={fin} onChange={e => setFin(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Precio por noche ($COP)</label>
        <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0"
          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" />
      </div>
      <div>
        <label className="text-xs text-gray-500">Aplicar a</label>
        <select value={habId} onChange={e => setHabId(e.target.value)}
          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white">
          <option value="todas">Todas las habitaciones</option>
          {habitaciones.map(h => (
            <option key={h.id} value={String(h.id)}>{h.nombre}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={guardando}
          className="flex-1 py-2 text-sm font-medium bg-[#1B4332] text-white rounded-xl disabled:opacity-50 hover:bg-[#2D6A4F] transition-colors">
          {guardando ? 'Guardando...' : 'Guardar temporada'}
        </button>
        <button onClick={onCancelar}
          className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function CalendarioOcupacion({
  mes,
  habitaciones,
  reservas,
  onMesAnterior,
  onMesSiguiente,
}: {
  mes: Date
  habitaciones: { id: number; nombre: string; habitacionTipoId?: number; fisicaId?: number }[]
  reservas: ReservaHotel[]
  onMesAnterior: () => void
  onMesSiguiente: () => void
}) {
  const diasEnMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const dias = Array.from({ length: diasEnMes }, (_, i) => i + 1)

  const mesNombre = mes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  function getReservaInfo(hab: { id: number; habitacionTipoId?: number; fisicaId?: number }, dia: number): ReservaHotel | null {
    const fecha = new Date(mes.getFullYear(), mes.getMonth(), dia)
    return reservas.find(r =>
      (hab.fisicaId ? r.habitacionFisicaId === hab.fisicaId : r.habitacionTipoId === hab.id) &&
      ['PENDIENTE', 'CONFIRMADA', 'CHECKIN'].includes(r.estado) &&
      new Date(r.fechaEntrada) <= fecha &&
      new Date(r.fechaSalida) > fecha
    ) ?? null
  }

  const esHoy = (dia: number) => {
    const hoy = new Date()
    return hoy.getFullYear() === mes.getFullYear() && hoy.getMonth() === mes.getMonth() && hoy.getDate() === dia
  }

  return (
    <div>
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onMesAnterior} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="font-semibold text-gray-800 capitalize">{mesNombre}</span>
        <button onClick={onMesSiguiente} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" /> Reservada</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Pendiente</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> Libre</span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left p-1 text-gray-400 font-medium sticky left-0 bg-white min-w-[80px]">Día</th>
              {habitaciones.map(h => (
                <th key={h.id} className="text-center p-1 text-gray-600 font-medium min-w-[70px] max-w-[90px] truncate"
                  title={h.nombre}>{h.nombre.length > 10 ? h.nombre.slice(0, 10) + '…' : h.nombre}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map(dia => (
              <tr key={dia} className={esHoy(dia) ? 'bg-blue-50' : ''}>
                <td className={`p-1 font-medium sticky left-0 ${esHoy(dia) ? 'bg-blue-50' : 'bg-white'} ${esHoy(dia) ? 'text-blue-600' : 'text-gray-500'}`}>
                  {dia}{esHoy(dia) ? ' ·hoy' : ''}
                </td>
                {habitaciones.map(h => {
                  const r = getReservaInfo(h, dia)
                  const ocupado = !!r
                  const pendiente = r?.estado === 'PENDIENTE'
                  return (
                    <td key={h.id} className="p-0.5">
                      <div
                        title={r ? `${r.nombreHuesped} · ${r.codigo}` : 'Libre'}
                        className={`h-6 rounded text-center leading-6 text-[10px] font-medium cursor-default transition-colors ${
                          pendiente ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          ocupado   ? 'bg-[#1B4332]/90 text-white' :
                          'bg-gray-50 border border-gray-100 text-gray-300'
                        }`}>
                        {ocupado ? (pendiente ? 'P' : '✓') : ''}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DashboardEstadisticas() {
  const [stats, setStats] = useState<EstadisticasHotel | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    obtenerEstadisticasHotel()
      .then(setStats)
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!stats) return null

  const mesActual = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Ingresos 6 meses', valor: formatearPrecio(stats.ingresoTotal6m), color: 'text-[#1B4332]' },
          { label: `Reservas ${mesActual}`, valor: String(stats.reservasMesActual), color: 'text-blue-600' },
          { label: 'Reservas 6 meses', valor: String(stats.totalReservas6m), color: 'text-gray-800' },
          { label: 'Ocupación promedio', valor: `${stats.tasaOcupacionPromedio}%`, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="min-w-0 bg-gray-50 rounded-xl p-3 lg:p-4">
            <p className="text-xs text-gray-500 leading-tight">{k.label}</p>
            <p className={`mt-1 text-[clamp(1.05rem,1.7vw,1.5rem)] font-black leading-tight tracking-tight tabular-nums break-words ${k.color}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Ingresos por mes — barras simples */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Ingresos por mes</p>
        {(() => {
          const max = Math.max(...stats.ingresosPorMes.map(m => m.ingreso), 1)
          return (
            <div className="space-y-2">
              {stats.ingresosPorMes.map(({ mes, ingreso }) => {
                const [anio, mesNum] = mes.split('-')
                const label = new Date(Number(anio), Number(mesNum) - 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
                const pct = Math.round((ingreso / max) * 100)
                return (
                  <div key={mes} className="grid grid-cols-[3.25rem_minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_104px]">
                    <span className="text-xs text-gray-400 text-right capitalize leading-tight">{label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div className="h-full bg-[#2D6A4F] rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, ingreso > 0 ? 4 : 0)}%` }}>
                        {ingreso > 0 && pct >= 28 && <span className="text-[10px] text-white font-medium tabular-nums">{formatearPrecio(ingreso)}</span>}
                      </div>
                    </div>
                    <span className={`text-xs text-right tabular-nums ${ingreso === 0 ? 'text-gray-300' : 'text-gray-500'}`}>{formatearPrecio(ingreso)}</span>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Ocupación por habitación */}
      {stats.ocupacionPorHab.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Ocupación este mes por habitación</p>
          <div className="space-y-2">
            {stats.ocupacionPorHab.map(h => (
              <div key={h.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 truncate">{h.nombre}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${h.tasaOcupacion >= 80 ? 'bg-[#1B4332]' : h.tasaOcupacion >= 50 ? 'bg-[#2D6A4F]' : 'bg-emerald-300'}`}
                    style={{ width: `${h.tasaOcupacion}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{h.tasaOcupacion}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ComercianteHotelesPage() {
  const [cfg, setCfg]               = useState<ConfigHotel | null>(null)
  const [reservas, setReservas]     = useState<ReservaHotel[]>([])
  const [habitacionesFisicas, setHabitacionesFisicas] = useState<HabitacionFisica[]>([])
  const [ocupacion, setOcupacion]   = useState<{ habitaciones: HabitacionTipo[]; habitacionesFisicas: HabitacionFisica[]; reservas: ReservaHotel[] } | null>(null)
  const [tab, setTab]               = useState<TabHotel>('reservas')
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })
  const [reservasCalendario, setReservasCalendario] = useState<ReservaHotel[]>([])
  const [bloqueos, setBloqueos]     = useState<BloqueoFecha[]>([])
  const [cargandoBloqueos, setCargandoBloqueos] = useState(false)
  const [formBloqueo, setFormBloqueo] = useState<{ habitacionId: string; fechaInicio: string; fechaFin: string; motivo: string }>({ habitacionId: '', fechaInicio: '', fechaFin: '', motivo: '' })
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false)
  const [errorBloqueo, setErrorBloqueo] = useState('')
  const [cupones, setCupones]       = useState<CuponHotel[]>([])
  const [mostrarFormCupon, setMostrarFormCupon] = useState(false)
  const [temporadas, setTemporadas] = useState<TemporadaHotel[]>([])
  const [mostrarFormTemporada, setMostrarFormTemporada] = useState(false)
  const [cargando, setCargando]     = useState(true)
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState('')
  const [editConfig, setEditConfig] = useState<Partial<ConfigHotel>>({})
  const [formHab, setFormHab]       = useState<{ visible: boolean; inicial?: Partial<HabitacionTipo> }>({ visible: false })
  const [formFisica, setFormFisica] = useState<{ habitacionTipoId: string; nombre: string; piso: string; zona: string; estado: EstadoHabitacionFisica; notas: string }>({
    habitacionTipoId: '',
    nombre: '',
    piso: '',
    zona: '',
    estado: 'LIBRE',
    notas: '',
  })
  const [guardandoFisica, setGuardandoFisica] = useState(false)
  const [errorFisica, setErrorFisica] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const primerasCarga               = useRef(true)

  const reservasRef = useRef<ReservaHotel[]>([])

  const cargar = useCallback(async () => {
    try {
      const [hotelData, reservasData, fisicasData] = await Promise.all([
        obtenerMiHotel(),
        reservasHotelero(),
        listarHabitacionesFisicas().catch(() => [] as HabitacionFisica[]),
      ])
      setCfg(hotelData)
      setHabitacionesFisicas(fisicasData)
      if (primerasCarga.current) {
        setEditConfig(hotelData)
        primerasCarga.current = false
      }

      // Detectar nuevas reservas PENDIENTE → alerta sonora
      const prevIds = new Set(reservasRef.current.map(r => r.id))
      const nuevas  = reservasData.filter(r => r.estado === 'PENDIENTE' && !prevIds.has(r.id))
      if (nuevas.length > 0 && reservasRef.current.length > 0) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          ;[0, 200, 400].forEach(delay => {
            const osc  = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = 660
            gain.gain.setValueAtTime(0.3, ctx.currentTime + delay / 1000)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.35)
            osc.start(ctx.currentTime + delay / 1000)
            osc.stop(ctx.currentTime + delay / 1000 + 0.35)
          })
        } catch {}
      }
      reservasRef.current = reservasData
      setReservas(reservasData)
      setReservasCalendario(reservasData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    const t = setInterval(cargar, 20000)
    return () => clearInterval(t)
  }, [cargar])

  useEffect(() => {
    if (!formFisica.habitacionTipoId && cfg?.habitaciones?.[0]?.id) {
      setFormFisica(p => ({ ...p, habitacionTipoId: String(cfg.habitaciones[0].id) }))
    }
  }, [cfg, formFisica.habitacionTipoId])

  // SSE para nuevas reservas
  useEffect(() => {
    const token = obtenerToken()
    if (!token) return
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
    const es = new EventSource(`${API}/notificaciones/stream?token=${encodeURIComponent(token)}`)
    es.addEventListener('notificacion', (e) => {
      try {
        const notif = JSON.parse((e as MessageEvent).data)
        if (notif?.tipo === 'HOTEL') cargar()
      } catch {}
    })
    return () => es.close()
  }, [cargar])

  async function cargarOcupacion() {
    try {
      const data = await ocupacionHotel()
      setOcupacion(data)
      if (data.habitacionesFisicas) setHabitacionesFisicas(data.habitacionesFisicas)
    } catch {}
  }

  useEffect(() => {
    if (tab === 'ocupacion' || tab === 'recepcion') cargarOcupacion()
  }, [tab])

  async function cargarBloqueos() {
    setCargandoBloqueos(true)
    try {
      const data = await listarBloqueos()
      setBloqueos(data)
    } catch {}
    setCargandoBloqueos(false)
  }

  useEffect(() => {
    if (tab === 'bloqueos') cargarBloqueos()
  }, [tab])

  async function cargarCupones() {
    try {
      const data = await listarCuponesHotel()
      setCupones(data)
    } catch {}
  }

  async function cargarTemporadas() {
    try { setTemporadas(await listarTemporadasHotel()) } catch {}
  }

  useEffect(() => {
    if (cfg) { cargarCupones(); cargarTemporadas() }
  }, [cfg])

  async function handleCrearBloqueo() {
    if (!formBloqueo.fechaInicio || !formBloqueo.fechaFin) { setErrorBloqueo('Selecciona fecha inicio y fecha fin'); return }
    if (formBloqueo.fechaFin < formBloqueo.fechaInicio) { setErrorBloqueo('La fecha fin debe ser posterior a la fecha inicio'); return }
    setGuardandoBloqueo(true); setErrorBloqueo('')
    try {
      await crearBloqueo({
        habitacionId: formBloqueo.habitacionId ? Number(formBloqueo.habitacionId) : null,
        fechaInicio: formBloqueo.fechaInicio,
        fechaFin: formBloqueo.fechaFin,
        motivo: formBloqueo.motivo || undefined,
      })
      setFormBloqueo({ habitacionId: '', fechaInicio: '', fechaFin: '', motivo: '' })
      await cargarBloqueos()
    } catch (e: any) { setErrorBloqueo(e.message) }
    setGuardandoBloqueo(false)
  }

  async function handleEliminarBloqueo(id: string) {
    if (!window.confirm('¿Eliminar este bloqueo de fechas?')) return
    try {
      await eliminarBloqueo(id)
      setBloqueos(prev => prev.filter(b => b.id !== id))
    } catch (e: any) { setErrorBloqueo(e.message) }
  }

  async function cargarHabitacionesFisicas() {
    try {
      setHabitacionesFisicas(await listarHabitacionesFisicas())
    } catch (e: any) {
      setErrorFisica(e.message)
    }
  }

  async function handleCrearHabitacionFisica() {
    if (!formFisica.habitacionTipoId || !formFisica.nombre.trim()) {
      setErrorFisica('Selecciona el tipo y escribe el numero o nombre de la habitacion.')
      return
    }
    setGuardandoFisica(true)
    setErrorFisica('')
    try {
      const nueva = await crearHabitacionFisica({
        habitacionTipoId: Number(formFisica.habitacionTipoId),
        nombre: formFisica.nombre.trim(),
        piso: formFisica.piso.trim() || null,
        zona: formFisica.zona.trim() || null,
        estado: formFisica.estado,
        notas: formFisica.notas.trim() || null,
      })
      setHabitacionesFisicas(prev => [...prev, nueva])
      setFormFisica(p => ({ ...p, nombre: '', piso: '', zona: '', estado: 'LIBRE', notas: '' }))
    } catch (e: any) {
      setErrorFisica(e.message)
    } finally {
      setGuardandoFisica(false)
    }
  }

  async function handleCambiarEstadoFisica(id: number, estado: EstadoHabitacionFisica) {
    try {
      const actualizada = await cambiarEstadoHabitacionFisica(id, estado)
      setHabitacionesFisicas(prev => prev.map(h => h.id === id ? { ...h, ...actualizada } : h))
      if (tab === 'ocupacion' || tab === 'recepcion') cargarOcupacion()
    } catch (e: any) {
      setErrorFisica(e.message)
    }
  }

  async function handleEliminarHabitacionFisica(id: number) {
    if (!window.confirm('Eliminar esta habitacion real del inventario operativo?')) return
    try {
      await eliminarHabitacionFisica(id)
      setHabitacionesFisicas(prev => prev.filter(h => h.id !== id))
    } catch (e: any) {
      setErrorFisica(e.message)
    }
  }

  async function handleAsignarHabitacionFisica(reservaId: number, habitacionFisicaId: number) {
    try {
      const actualizada = await asignarHabitacionFisicaReserva(reservaId, habitacionFisicaId)
      setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, ...actualizada } : r))
      setReservasCalendario(prev => prev.map(r => r.id === reservaId ? { ...r, ...actualizada } : r))
      await cargarHabitacionesFisicas()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function guardarConfig() {
    setGuardando(true); setError(''); setExito('')
    try {
      const actualizado = await actualizarMiHotel(editConfig)
      setCfg(actualizado)
      setExito('Configuración guardada')
      setTimeout(() => setExito(''), 3000)
    } catch (e: any) { setError(e.message) }
    setGuardando(false)
  }

  async function handleCambioEstado(reservaId: number, estado: EstadoReservaHotel) {
    try {
      const actualizada = await cambiarEstadoReserva(reservaId, estado)
      setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, ...actualizada } : r))
      setReservasCalendario(prev => prev.map(r => r.id === reservaId ? { ...r, ...actualizada } : r))
      await cargarHabitacionesFisicas()
    } catch (e: any) { setError(e.message) }
  }

  const reservasFiltradas = filtroEstado ? reservas.filter(r => r.estado === filtroEstado) : reservas
  const pendientes = reservas.filter(r => r.estado === 'PENDIENTE').length
  const hoy = new Date()
  const esMismaFecha = (fecha: string | Date) => {
    const f = new Date(fecha)
    return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth() && f.getDate() === hoy.getDate()
  }
  const llegadasHoy = reservas
    .filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && esMismaFecha(r.fechaEntrada))
    .sort((a, b) => new Date(a.fechaEntrada).getTime() - new Date(b.fechaEntrada).getTime())
  const salidasHoy = reservas
    .filter(r => r.estado === 'CHECKIN' && esMismaFecha(r.fechaSalida))
    .sort((a, b) => new Date(a.fechaSalida).getTime() - new Date(b.fechaSalida).getTime())
  const calendarioHabitaciones = habitacionesFisicas.length > 0
    ? habitacionesFisicas.map(h => ({
        id: h.id,
        nombre: `${h.nombre}${h.habitacionTipo?.nombre ? ` - ${h.habitacionTipo.nombre}` : ''}`,
        habitacionTipoId: h.habitacionTipoId,
        fisicaId: h.id,
      }))
    : (cfg?.habitaciones ?? []).map(h => ({ id: h.id, nombre: h.nombre }))

  const reservaActualPorHabitacion = (habitacionId: number) =>
    reservas.find(r => r.habitacionFisicaId === habitacionId && r.estado === 'CHECKIN') ?? null

  const proximaReservaPorHabitacion = (habitacionId: number) =>
    reservas
      .filter(r => r.habitacionFisicaId === habitacionId && ['PENDIENTE', 'CONFIRMADA'].includes(r.estado))
      .sort((a, b) => new Date(a.fechaEntrada).getTime() - new Date(b.fechaEntrada).getTime())[0] ?? null

  const estadoVisualHabitacion = (habitacion: HabitacionFisica) => {
    if (habitacion.estado === 'MANTENIMIENTO' || habitacion.estado === 'BLOQUEADA' || habitacion.estado === 'LIMPIEZA') return habitacion.estado
    const actual = reservaActualPorHabitacion(habitacion.id)
    if (actual && esMismaFecha(actual.fechaSalida)) return 'SALE_HOY'
    if (actual) return 'OCUPADA'
    const proxima = proximaReservaPorHabitacion(habitacion.id)
    if (proxima && esMismaFecha(proxima.fechaEntrada)) return 'ENTRA_HOY'
    if (proxima) return 'RESERVADA'
    return habitacion.estado || 'LIBRE'
  }

  const resumenHabitaciones = habitacionesFisicas.reduce((acc, h) => {
    const estado = estadoVisualHabitacion(h)
    acc[estado] = (acc[estado] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (cargando) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/comerciante" className="text-[#2D6A4F] p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>
            <div>
              <h1 className="font-bold text-[#1A1A1A]">Gestión Hotelera</h1>
              {cfg && <p className="text-xs text-gray-500">{cfg.activo ? '🟢 Activo' : '🔴 Inactivo'}</p>}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {([
              { key: 'reservas',     label: 'Reservas',     badge: pendientes },
              { key: 'recepcion',    label: 'Recepcion',    badge: llegadasHoy.length + salidasHoy.length },
              { key: 'ocupacion',    label: 'Ocupación',    badge: 0 },
              { key: 'habitaciones', label: 'Habitaciones', badge: 0 },
              { key: 'bloqueos',     label: '🔒 Bloqueos',  badge: 0 },
              { key: 'config',       label: 'Configuración',badge: 0 },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.key ? 'bg-[#2D6A4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 pb-16 sm:px-6 lg:px-8">
        {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
        {exito && <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">{exito}</div>}

        {/* ── DASHBOARD EJECUTIVO ── */}
        {(() => {
          const ahora = new Date()
          const mesActual = ahora.getMonth()
          const anioActual = ahora.getFullYear()

          const reservasMes = reservas.filter(r => {
            const f = new Date(r.creadoAt)
            return f.getMonth() === mesActual && f.getFullYear() === anioActual
          })

          const ingresosMes = reservasMes
            .filter(r => r.estado === 'CONFIRMADA' || r.estado === 'CHECKIN' || r.estado === 'CHECKOUT')
            .reduce((acc, r) => acc + Number(r.total), 0)

          const unidadesOperativas = habitacionesFisicas.filter(h => h.estado !== 'MANTENIMIENTO' && h.estado !== 'BLOQUEADA').length
          const habitacionesOcupadas = habitacionesFisicas.length > 0
            ? habitacionesFisicas.filter(h => ['OCUPADA', 'SALE_HOY'].includes(estadoVisualHabitacion(h))).length
            : reservas.filter(r => r.estado === 'CHECKIN').length
          const capacidadTotal = habitacionesFisicas.length > 0
            ? unidadesOperativas
            : (cfg?.habitaciones ?? []).reduce((acc, h) => acc + h.cantidad, 0)
          const tasaOcupacion = capacidadTotal > 0
            ? Math.round((habitacionesOcupadas / capacidadTotal) * 100)
            : 0

          const reseñasPendientes = reservas.filter(r => r.estado === 'CHECKOUT' && !r.review).length
          const reservasConfirmadas = reservas.filter(r => r.estado === 'CONFIRMADA').length
          const huespedesEnCasa = reservas.filter(r => r.estado === 'CHECKIN').length
          const proximaReserva = reservas
            .filter(r => r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA')
            .sort((a, b) => new Date(a.fechaEntrada).getTime() - new Date(b.fechaEntrada).getTime())[0]

          const tarjetas = [
            {
              icono: '📅',
              valor: reservasMes.length,
              etiqueta: 'Reservas este mes',
            },
            {
              icono: '📊',
              valor: `${tasaOcupacion}%`,
              etiqueta: 'Tasa de ocupación',
            },
            {
              icono: '⭐',
              valor: reseñasPendientes,
              etiqueta: 'Reseñas pendientes',
            },
            {
              icono: '✅',
              valor: reservasConfirmadas,
              etiqueta: 'Confirmadas',
            },
          ]

          return (
            <section className="mb-5 overflow-hidden rounded-[1.75rem] border border-[#E9DFC9] bg-white shadow-sm">
              <div className="border-b border-[#F0E7D7] px-4 py-5 sm:px-6 lg:px-7">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B7791F]">Panel hotelero</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-[#101828]">Gestiona reservas, ingresos y ocupación</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                      Vista ejecutiva para decidir rápido: qué falta confirmar, cuánto va el mes y cómo se está usando la capacidad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTab('reservas'); setFiltroEstado('PENDIENTE') }}
                    className={`w-fit rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                      pendientes > 0
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-emerald-50 text-[#1B4332] hover:bg-emerald-100'
                    }`}
                  >
                    {pendientes > 0 ? `${pendientes} reserva${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''}` : 'Sin pendientes'}
                  </button>
                </div>
              </div>

              <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7 xl:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0">
                  <DashboardEstadisticas />
                </div>

                <aside className="space-y-3">
                  <div className="relative overflow-hidden rounded-3xl bg-[#1B4332] p-5 text-white">
                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                    <div className="absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-[#D8A31A]/25" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">Este mes</p>
                    <p className="mt-3 text-[clamp(1.65rem,3vw,2.35rem)] font-black leading-none tracking-tight tabular-nums">
                      {formatearPrecio(ingresosMes)}
                    </p>
                    <p className="mt-2 text-sm text-white/75">
                      {reservasMes.length} reserva{reservasMes.length !== 1 ? 's' : ''} registrada{reservasMes.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {tarjetas.map((t, i) => (
                      <div key={i} className="min-w-0 rounded-2xl border border-gray-100 bg-[#FAFAF8] p-4">
                        <span className="text-lg">{t.icono}</span>
                        <p className="mt-2 text-[clamp(1.25rem,2.1vw,1.75rem)] font-black leading-none tracking-tight text-gray-900 tabular-nums break-words">{t.valor}</p>
                        <p className="mt-1 text-xs font-medium leading-tight text-gray-400">{t.etiqueta}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Operación rápida</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-amber-50 px-2 py-3">
                        <p className="text-lg font-black text-amber-700">{pendientes}</p>
                        <p className="text-[11px] font-medium text-amber-700/70">Pendientes</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-2 py-3">
                        <p className="text-lg font-black text-[#1B4332]">{reservasConfirmadas}</p>
                        <p className="text-[11px] font-medium text-[#1B4332]/70">Confirmadas</p>
                      </div>
                      <div className="rounded-xl bg-blue-50 px-2 py-3">
                        <p className="text-lg font-black text-blue-700">{huespedesEnCasa}</p>
                        <p className="text-[11px] font-medium text-blue-700/70">En casa</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-gray-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Próxima llegada</p>
                      {proximaReserva ? (
                        <>
                          <p className="mt-1 truncate text-sm font-black text-gray-900">{proximaReserva.nombreHuesped}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(proximaReserva.fechaEntrada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {proximaReserva.habitacionTipo?.nombre ?? 'Habitación'}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">No hay llegadas pendientes.</p>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setTab('reservas'); setFiltroEstado('PENDIENTE') }}
                        className="rounded-xl bg-[#1B4332] px-3 py-2 text-xs font-bold text-white hover:bg-[#15362A]">
                        Ver pendientes
                      </button>
                      <button type="button" onClick={() => setTab('recepcion')}
                        className="rounded-xl border border-[#1B4332]/15 bg-white px-3 py-2 text-xs font-bold text-[#1B4332] hover:bg-[#F0FDF4]">
                        Ver ocupación
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )
        })()}

        {/* ── RESERVAS ── */}
        {tab === 'recepcion' && (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[1.75rem] border border-[#E9DFC9] bg-white shadow-sm">
              <div className="border-b border-[#F0E7D7] px-5 py-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B7791F]">Recepcion operativa</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-[#101828]">Mapa vivo de habitaciones</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                      Controla habitaciones reales, llegadas, salidas, limpieza y mantenimiento sin mezclarlo con los tipos comerciales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('habitaciones')}
                    className="w-fit rounded-full border border-[#2D6A4F]/20 bg-[#F7FCF9] px-4 py-2 text-sm font-bold text-[#1B4332] hover:bg-[#EAF7EF]"
                  >
                    Administrar habitaciones reales
                  </button>
                </div>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ['LIBRE', 'Libres'],
                  ['OCUPADA', 'Ocupadas'],
                  ['ENTRA_HOY', 'Llegan hoy'],
                  ['SALE_HOY', 'Salen hoy'],
                  ['LIMPIEZA', 'En limpieza'],
                ].map(([estado, label]) => (
                  <div key={estado} className="rounded-2xl bg-[#FAFAF8] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-gray-950">{resumenHabitaciones[estado] ?? 0}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
              <section className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-gray-950">Habitaciones reales</h3>
                    <p className="text-sm text-gray-400">{habitacionesFisicas.length} unidad{habitacionesFisicas.length !== 1 ? 'es' : ''} operativa{habitacionesFisicas.length !== 1 ? 's' : ''}</p>
                  </div>
                  {errorFisica && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">{errorFisica}</span>}
                </div>

                {habitacionesFisicas.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#D8C7A3] bg-[#FFFCF4] p-8 text-center">
                    <p className="text-3xl">🏨</p>
                    <h4 className="mt-3 font-black text-gray-900">Crea habitaciones reales para activar recepcion</h4>
                    <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                      Ejemplo: 101, 102, Suite Rio o Cabana 3. Esto permite asignar reservas y ver ocupacion real.
                    </p>
                    <button type="button" onClick={() => setTab('habitaciones')}
                      className="mt-4 rounded-full bg-[#1B4332] px-5 py-2 text-sm font-bold text-white hover:bg-[#2D6A4F]">
                      Crear habitaciones reales
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {habitacionesFisicas.map(h => {
                      const estado = estadoVisualHabitacion(h)
                      const meta = ESTADO_HABITACION_FISICA[estado] ?? ESTADO_HABITACION_FISICA.LIBRE
                      const actual = reservaActualPorHabitacion(h.id)
                      const proxima = proximaReservaPorHabitacion(h.id)
                      return (
                        <article key={h.id} className={`rounded-3xl border p-4 transition-all ${meta.card}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xl font-black text-gray-950">{h.nombre}</p>
                              <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
                                {h.habitacionTipo?.nombre ?? 'Habitacion'}{h.piso ? ` - Piso ${h.piso}` : ''}{h.zona ? ` - ${h.zona}` : ''}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.chip}`}>
                              {meta.label}
                            </span>
                          </div>

                          <div className="mt-4 rounded-2xl bg-white/70 p-3">
                            {actual ? (
                              <>
                                <p className="text-xs font-bold uppercase tracking-wide text-[#1B4332]">Huesped en casa</p>
                                <p className="mt-1 truncate text-sm font-black text-gray-900">{actual.nombreHuesped}</p>
                                <p className="text-xs text-gray-500">
                                  Sale {new Date(actual.fechaSalida).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                </p>
                              </>
                            ) : proxima ? (
                              <>
                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Proxima reserva</p>
                                <p className="mt-1 truncate text-sm font-black text-gray-900">{proxima.nombreHuesped}</p>
                                <p className="text-xs text-gray-500">
                                  Entra {new Date(proxima.fechaEntrada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Disponible</p>
                                <p className="mt-1 text-sm text-gray-500">Sin reserva asignada en curso.</p>
                              </>
                            )}
                          </div>

                          {h.notas && <p className="mt-3 text-xs italic text-gray-500">{h.notas}</p>}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {h.estado === 'LIMPIEZA' && !actual && (
                              <button type="button" onClick={() => handleCambiarEstadoFisica(h.id, 'LIBRE')}
                                className="rounded-full bg-[#1B4332] px-3 py-1.5 text-xs font-bold text-white">
                                Marcar lista
                              </button>
                            )}
                            {!actual && h.estado !== 'LIMPIEZA' && h.estado !== 'MANTENIMIENTO' && h.estado !== 'BLOQUEADA' && (
                              <button type="button" onClick={() => handleCambiarEstadoFisica(h.id, 'LIMPIEZA')}
                                className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700">
                                Limpieza
                              </button>
                            )}
                            {!actual && h.estado !== 'MANTENIMIENTO' && (
                              <button type="button" onClick={() => handleCambiarEstadoFisica(h.id, 'MANTENIMIENTO')}
                                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600">
                                Mantenimiento
                              </button>
                            )}
                            {!actual && (h.estado === 'MANTENIMIENTO' || h.estado === 'BLOQUEADA') && (
                              <button type="button" onClick={() => handleCambiarEstadoFisica(h.id, 'LIBRE')}
                                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                                Liberar
                              </button>
                            )}
                            {actual && (
                              <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-gray-500">
                                Check-out desde la reserva
                              </span>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-[1.5rem] border border-amber-100 bg-amber-50/60 p-5">
                  <h3 className="font-black text-amber-950">Llegadas de hoy</h3>
                  <div className="mt-3 space-y-2">
                    {llegadasHoy.length === 0 ? (
                      <p className="text-sm text-amber-800/60">No hay entradas programadas para hoy.</p>
                    ) : llegadasHoy.map(r => (
                      <div key={r.id} className="rounded-2xl bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-900">{r.nombreHuesped}</p>
                            <p className="text-xs text-gray-500">{r.habitacionTipo?.nombre ?? 'Habitacion'} - {r.codigo}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ESTADO_RESERVA[r.estado]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                            {r.estado}
                          </span>
                        </div>
                        {r.habitacionFisica ? (
                          <p className="mt-2 text-xs font-bold text-[#1B4332]">Asignada: {r.habitacionFisica.nombre}</p>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-amber-700">Sin habitacion real asignada</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-5">
                  <h3 className="font-black text-orange-950">Salidas de hoy</h3>
                  <div className="mt-3 space-y-2">
                    {salidasHoy.length === 0 ? (
                      <p className="text-sm text-orange-800/60">No hay salidas para hoy.</p>
                    ) : salidasHoy.map(r => (
                      <div key={r.id} className="rounded-2xl bg-white p-3">
                        <p className="truncate text-sm font-black text-gray-900">{r.nombreHuesped}</p>
                        <p className="text-xs text-gray-500">
                          {r.habitacionFisica?.nombre ?? r.habitacionTipo?.nombre ?? 'Habitacion'} - {formatearPrecio(Number(r.total))}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        )}

        {tab === 'reservas' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['', 'PENDIENTE', 'CONFIRMADA', 'CHECKIN', 'CHECKOUT', 'CANCELADA'].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-colors ${
                    filtroEstado === e ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {e ? (ESTADO_RESERVA[e]?.label ?? e) : 'Todas'}
                </button>
              ))}
            </div>

            {reservasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">📋</p>
                <p>No hay reservas{filtroEstado ? ` con estado "${ESTADO_RESERVA[filtroEstado]?.label}"` : ''}</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {reservasFiltradas.map(res => {
                const info = ESTADO_RESERVA[res.estado]
                const trans = TRANSICIONES[res.estado] ?? []
                const entrada = new Date(res.fechaEntrada)
                const salida  = new Date(res.fechaSalida)
                const noches  = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000)
                const fisicasTipo = habitacionesFisicas.filter(h => h.habitacionTipoId === res.habitacionTipoId)
                const reservaCerrada = ['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(res.estado)

                return (
                  <div key={res.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-[#1A1A1A]">{res.nombreHuesped}</p>
                        <p className="text-xs text-gray-400">{res.codigo}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${info?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {info?.label ?? res.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-400">Entrada</p>
                        <p className="font-medium">{entrada.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-400">Salida</p>
                        <p className="font-medium">{salida.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>

                    <div className="text-sm space-y-0.5 mb-3">
                      <p className="text-gray-600">🛏️ {res.habitacionTipo?.nombre} · {noches} noche{noches !== 1 ? 's' : ''}</p>
                      <p className="text-gray-600">👤 {res.huespedes} huésped{res.huespedes !== 1 ? 'es' : ''} · 📱 {res.telefonoHuesped}</p>
                      {res.notasCliente && <p className="text-gray-400 italic text-xs">"{res.notasCliente}"</p>}
                    </div>

                    <div className="mb-3 rounded-2xl border border-gray-100 bg-[#FAFAF8] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-wide text-gray-400">Habitacion real</p>
                          <p className="mt-0.5 truncate text-sm font-bold text-gray-900">
                            {res.habitacionFisica?.nombre ?? 'Sin asignar'}
                          </p>
                        </div>
                        {fisicasTipo.length > 0 ? (
                          <select
                            value={res.habitacionFisicaId ? String(res.habitacionFisicaId) : ''}
                            disabled={reservaCerrada}
                            onChange={e => {
                              if (!e.target.value) return
                              handleAsignarHabitacionFisica(res.id, Number(e.target.value))
                            }}
                            className="max-w-[190px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"
                          >
                            <option value="">Asignar</option>
                            {fisicasTipo.map(h => (
                              <option key={h.id} value={h.id}>
                                {h.nombre} - {ESTADO_HABITACION_FISICA[estadoVisualHabitacion(h)]?.label ?? h.estado}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button type="button" onClick={() => setTab('habitaciones')}
                            className="rounded-xl bg-[#1B4332] px-3 py-2 text-xs font-bold text-white">
                            Crear
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-400">{res.metodoPago}</span>
                      <span className="font-bold">{formatearPrecio(Number(res.total))}</span>
                    </div>

                    {trans.length > 0 && (
                      <div className="flex gap-2">
                        {trans.map(t => (
                          <button key={t.estado} onClick={() => handleCambioEstado(res.id, t.estado)}
                            className={`flex-1 ${t.color} text-white font-medium py-2 rounded-xl text-xs transition-opacity hover:opacity-90`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── OCUPACIÓN ── */}
        {tab === 'ocupacion' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="font-bold text-[#1A1A1A] mb-3">Ocupación actual</h2>
              {!ocupacion ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  {ocupacion.habitaciones.map(hab => {
                    const reservasHab = ocupacion.reservas.filter(r => r.habitacionTipoId === hab.id)
                    const ocupadas = reservasHab.filter(r => r.estado === 'CHECKIN').length
                    const confirmadas = reservasHab.filter(r => r.estado === 'CONFIRMADA').length
                    const pct = Math.round((ocupadas / hab.cantidad) * 100)

                    return (
                      <div key={hab.id} className="mb-4 last:mb-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="font-medium text-sm text-[#1A1A1A]">{hab.nombre}</p>
                          <p className="text-xs text-gray-400">{ocupadas}/{hab.cantidad} ocupadas</p>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#2D6A4F' }} />
                        </div>
                        {confirmadas > 0 && <p className="text-xs text-blue-600">+{confirmadas} confirmada(s) entrante(s)</p>}
                        {reservasHab.map(r => (
                          <div key={r.id} className="mt-1.5 flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                            <span className="text-gray-600">{r.nombreHuesped}</span>
                            <span className="text-gray-400">
                              {new Date(r.fechaEntrada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} →{' '}
                              {new Date(r.fechaSalida).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-medium ${ESTADO_RESERVA[r.estado]?.color ?? ''}`}>
                              {r.estado === 'CHECKIN' ? 'Hospedado' : 'Entrante'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {ocupacion.habitaciones.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-6">No hay habitaciones configuradas</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── HABITACIONES ── */}
        {tab === 'habitaciones' && (
          <div className="space-y-4">
            <button onClick={() => setFormHab({ visible: true })}
              className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] transition-colors">
              + Agregar tipo de habitación
            </button>

            <section className="rounded-[1.5rem] border border-[#E9DFC9] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B7791F]">Inventario operativo</p>
                  <h2 className="mt-1 text-xl font-black text-gray-950">Habitaciones reales</h2>
                  <p className="mt-1 text-sm text-gray-500">Crea las unidades que recepcion usa en el dia a dia: 101, 102, Cabana 3, Suite Rio.</p>
                </div>
                <button type="button" onClick={cargarHabitacionesFisicas}
                  className="w-fit rounded-full border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
                  Actualizar
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.7fr_0.8fr_0.8fr_auto]">
                <select
                  value={formFisica.habitacionTipoId}
                  onChange={e => setFormFisica(p => ({ ...p, habitacionTipoId: e.target.value }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                >
                  <option value="">Tipo de habitacion</option>
                  {(cfg?.habitaciones ?? []).filter(h => h.activo).map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))}
                </select>
                <input
                  value={formFisica.nombre}
                  onChange={e => setFormFisica(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Numero o nombre"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
                <input
                  value={formFisica.piso}
                  onChange={e => setFormFisica(p => ({ ...p, piso: e.target.value }))}
                  placeholder="Piso"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
                <input
                  value={formFisica.zona}
                  onChange={e => setFormFisica(p => ({ ...p, zona: e.target.value }))}
                  placeholder="Zona"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
                <select
                  value={formFisica.estado}
                  onChange={e => setFormFisica(p => ({ ...p, estado: e.target.value as EstadoHabitacionFisica }))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
                >
                  {ESTADOS_HABITACION_EDITABLES.map(e => (
                    <option key={e} value={e}>{ESTADO_HABITACION_FISICA[e]?.label ?? e}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCrearHabitacionFisica}
                  disabled={guardandoFisica || !cfg?.habitaciones?.length}
                  className="rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-bold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                >
                  {guardandoFisica ? 'Guardando...' : '+ Crear'}
                </button>
              </div>

              <input
                value={formFisica.notas}
                onChange={e => setFormFisica(p => ({ ...p, notas: e.target.value }))}
                placeholder="Notas internas opcionales: vista al rio, requiere revisar aire, cama adicional..."
                className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
              />

              {errorFisica && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{errorFisica}</p>}

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {habitacionesFisicas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-sm text-gray-400 md:col-span-2 xl:col-span-3">
                    Aun no hay habitaciones reales. Crea al menos una para activar el mapa de recepcion.
                  </div>
                ) : habitacionesFisicas.map(h => {
                  const estado = estadoVisualHabitacion(h)
                  const meta = ESTADO_HABITACION_FISICA[estado] ?? ESTADO_HABITACION_FISICA.LIBRE
                  const actual = reservaActualPorHabitacion(h.id)
                  return (
                    <div key={h.id} className="rounded-2xl border border-gray-100 bg-[#FAFAF8] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-gray-950">{h.nombre}</p>
                          <p className="truncate text-xs text-gray-500">
                            {h.habitacionTipo?.nombre ?? 'Tipo sin nombre'}{h.piso ? ` - Piso ${h.piso}` : ''}{h.zona ? ` - ${h.zona}` : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${meta.chip}`}>{meta.label}</span>
                      </div>
                      {h.notas && <p className="mt-2 text-xs italic text-gray-500">{h.notas}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {actual ? (
                          <span className="rounded-full bg-[#1B4332]/10 px-3 py-1.5 text-[11px] font-bold text-[#1B4332]">
                            En uso por {actual.nombreHuesped}
                          </span>
                        ) : (
                          <>
                            {ESTADOS_HABITACION_EDITABLES.map(e => (
                              <button key={e} type="button" onClick={() => handleCambiarEstadoFisica(h.id, e)}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                                  h.estado === e ? 'bg-[#1B4332] text-white' : 'border border-gray-200 bg-white text-gray-600'
                                }`}>
                                {ESTADO_HABITACION_FISICA[e]?.label ?? e}
                              </button>
                            ))}
                            <button type="button" onClick={() => handleEliminarHabitacionFisica(h.id)}
                              className="rounded-full border border-red-100 bg-white px-3 py-1.5 text-[11px] font-bold text-red-500">
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {cfg?.habitaciones.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">🛏️</p>
                <p>Aún no has agregado habitaciones</p>
              </div>
            )}

            {cfg?.habitaciones.map(hab => (
              <div key={hab.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#1A1A1A]">{hab.nombre}</h3>
                      {!hab.activo && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactiva</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">👤 {hab.capacidad} personas · {hab.cantidad} habitación{hab.cantidad !== 1 ? 'es' : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#2D6A4F]">{formatearPrecio(Number(hab.precioPorNoche))}</p>
                    <p className="text-xs text-gray-400">por noche</p>
                  </div>
                </div>
                {hab.descripcion && <p className="text-xs text-gray-500 mt-1.5">{hab.descripcion}</p>}
                {hab.fotos.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {hab.fotos.slice(0, 3).map((f, i) => <img key={i} src={f} alt="" className="w-16 h-12 object-cover rounded-lg" />)}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setFormHab({ visible: true, inicial: hab })}
                    className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-xl text-xs hover:bg-gray-50">
                    ✏️ Editar
                  </button>
                  <button onClick={async () => {
                    if (!confirm('¿Desactivar esta habitación?')) return
                    await eliminarHabitacion(hab.id)
                    cargar()
                  }} className="flex-1 border border-red-200 text-red-500 font-medium py-2 rounded-xl text-xs hover:bg-red-50">
                    🗑️ Desactivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── BLOQUEOS ── */}
        {tab === 'bloqueos' && (
          <div className="space-y-4">
            {/* Formulario crear bloqueo */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
              <h2 className="font-bold text-[#1A1A1A]">Bloquear fechas</h2>

              {/* Habitación */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Habitación</label>
                <select
                  value={formBloqueo.habitacionId}
                  onChange={e => setFormBloqueo(p => ({ ...p, habitacionId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                >
                  <option value="">Todas las habitaciones</option>
                  {(cfg?.habitaciones ?? []).map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
                  <input
                    type="date"
                    value={formBloqueo.fechaInicio}
                    onChange={e => setFormBloqueo(p => ({ ...p, fechaInicio: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin *</label>
                  <input
                    type="date"
                    value={formBloqueo.fechaFin}
                    onChange={e => setFormBloqueo(p => ({ ...p, fechaFin: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo (opcional)</label>
                <input
                  type="text"
                  value={formBloqueo.motivo}
                  onChange={e => setFormBloqueo(p => ({ ...p, motivo: e.target.value }))}
                  placeholder="Mantenimiento, reserva directa, evento..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>

              {errorBloqueo && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{errorBloqueo}</p>
              )}

              <button
                onClick={handleCrearBloqueo}
                disabled={guardandoBloqueo}
                className="w-full bg-[#1B4332] text-white font-bold py-2.5 rounded-xl text-sm hover:bg-[#2D6A4F] transition-colors disabled:opacity-50"
              >
                {guardandoBloqueo ? 'Bloqueando…' : '🔒 Bloquear fechas'}
              </button>
            </div>

            {/* Lista bloqueos activos */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="font-bold text-[#1A1A1A] mb-3">Bloqueos activos</h2>

              {cargandoBloqueos ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : bloqueos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">🔓</p>
                  <p className="text-sm">No hay bloqueos activos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bloqueos.map(b => {
                    const hab = b.habitacionId
                      ? (cfg?.habitaciones ?? []).find(h => h.id === b.habitacionId)
                      : null
                    const inicio = new Date(b.fechaInicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                    const fin    = new Date(b.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A1A1A]">
                            {inicio} → {fin}
                          </p>
                          <p className="text-xs text-gray-500">
                            {hab ? `🛏️ ${hab.nombre}` : '🏨 Todas las habitaciones'}
                            {b.motivo ? ` · ${b.motivo}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleEliminarBloqueo(b.id)}
                          className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors text-lg"
                          title="Eliminar bloqueo"
                        >
                          🗑️
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CONFIGURACIÓN ── */}
        {tab === 'config' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5">
            <h2 className="font-bold text-[#1A1A1A]">Configuración del hotel</h2>

            {/* Activo */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Módulo activo</p>
                <p className="text-xs text-gray-400">Tu hotel aparecerá en el listado público</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={editConfig.activo ?? false}
                  onChange={e => setEditConfig(p => ({ ...p, activo: e.target.checked }))}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2D6A4F]" />
              </label>
            </div>

            {/* Confirmación automática */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Confirmación automática</p>
                <p className="text-xs text-gray-400">Reservas se confirman al instante si hay disponibilidad</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={editConfig.confirmacionAuto ?? false}
                  onChange={e => setEditConfig(p => ({ ...p, confirmacionAuto: e.target.checked }))}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2D6A4F]" />
              </label>
            </div>

            {!editConfig.confirmacionAuto && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Horas para confirmar manualmente</label>
                <input type="number" min={1} max={72} value={editConfig.horasLimiteConfirm ?? 2}
                  onChange={e => setEditConfig(p => ({ ...p, horasLimiteConfirm: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
            )}

            {/* Horarios check-in / check-out */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hora de Check-in</label>
                <input type="time" value={editConfig.checkInHora ?? '15:00'}
                  onChange={e => setEditConfig(p => ({ ...p, checkInHora: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hora de Check-out</label>
                <input type="time" value={editConfig.checkOutHora ?? '12:00'}
                  onChange={e => setEditConfig(p => ({ ...p, checkOutHora: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
              </div>
            </div>

            {/* Servicios del hotel */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Servicios del hotel</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {SERVICIOS_OPCIONES.map(s => {
                  const sel = (editConfig.servicios ?? []).includes(s)
                  return (
                    <button key={s} onClick={() => setEditConfig(p => {
                      const list = p.servicios ?? []
                      return { ...p, servicios: sel ? list.filter(x => x !== s) : [...list, s] }
                    })} className={`px-3 py-1.5 rounded-full text-xs border transition-colors font-medium ${
                      sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {SERVICIOS_LABELS[s]}
                    </button>
                  )
                })}
                {/* Servicios personalizados ya guardados */}
                {(editConfig.servicios ?? []).filter(s => !SERVICIOS_OPCIONES.includes(s)).map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border bg-[#2D6A4F] text-white border-[#2D6A4F] font-medium">
                    {s}
                    <button onClick={() => setEditConfig(p => ({ ...p, servicios: (p.servicios ?? []).filter(x => x !== s) }))}
                      className="ml-0.5 hover:opacity-70 leading-none text-sm">×</button>
                  </span>
                ))}
              </div>
              {/* Agregar servicio personalizado */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: Jacuzzi, Vista al río, Generador…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (!val) return
                    setEditConfig(p => ({
                      ...p,
                      servicios: (p.servicios ?? []).includes(val) ? p.servicios : [...(p.servicios ?? []), val],
                    }));
                    (e.target as HTMLInputElement).value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={e => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                    const val = input.value.trim()
                    if (!val) return
                    setEditConfig(p => ({
                      ...p,
                      servicios: (p.servicios ?? []).includes(val) ? p.servicios : [...(p.servicios ?? []), val],
                    }))
                    input.value = ''
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#1B4332] transition-colors whitespace-nowrap">
                  + Agregar
                </button>
              </div>
            </div>

            {/* Métodos de pago aceptados */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Métodos de pago aceptados</label>
              <p className="text-xs text-gray-400 mb-3">Desactiva "Pagar al llegar" si no quieres arriesgarte a no-shows sin pago.</p>
              <div className="space-y-2">
                {[
                  { key: 'permitePagarAlLlegar', label: 'Pagar al llegar', desc: 'Efectivo, Nequi o transferencia al check-in' },
                  { key: 'permiteDeposito30',    label: 'Depósito 30% online', desc: 'El cliente paga el 30% ahora y el resto al llegar' },
                  { key: 'permiteTotal',         label: 'Pago total online (proximo)', desc: 'Preparado para la siguiente fase; hoy el comprador usa deposito online si esta activo' },
                ].map(op => {
                  const key = op.key as MetodoPagoHotelKey
                  const activo = editConfig[key] !== false
                  return (
                    <div
                      key={op.key}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition-all ${
                        activo
                          ? 'border-[#2D6A4F]/20 bg-[#F7FCF9]'
                          : 'border-gray-100 bg-gray-50/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800">{op.label}</p>
                          {activo && <span className="h-1.5 w-1.5 rounded-full bg-[#2D6A4F]" />}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{op.desc}</p>
                      </div>
                      <SwitchElegante
                        activo={activo}
                        onClick={() => setEditConfig(p => ({ ...p, [key]: !activo }))}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RNT */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                RNT — Registro Nacional de Turismo
              </label>
              <input
                value={(editConfig as any).rnt ?? ''}
                onChange={e => setEditConfig(c => ({ ...c, rnt: e.target.value }))}
                placeholder="Ej: 123456"
                className="w-full mt-1.5 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              />
              {cfg?.rntVerificado ? (
                <p className="text-xs text-blue-600 mt-1">✓ RNT verificado por AfroMercado</p>
              ) : cfg?.rnt ? (
                <p className="text-xs text-amber-600 mt-1">Pendiente de verificación</p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Ingresar el número mejora la visibilidad de tu hotel</p>
              )}
            </div>

            {/* Política de cancelación */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Política de cancelación</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Horas de cancelación gratuita</label>
                  <input type="number" min={0} max={720}
                    value={(editConfig as any).horasLibresCancelacion ?? 48}
                    onChange={e => setEditConfig(p => ({ ...p, horasLibresCancelacion: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                  <p className="text-[10px] text-gray-400 mt-1">0 = sin cancelación gratuita</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Penalización si cancela tarde (%)</label>
                  <input type="number" min={0} max={100}
                    value={(editConfig as any).pctPenalidadCancelacion ?? 0}
                    onChange={e => setEditConfig(p => ({ ...p, pctPenalidadCancelacion: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                  <p className="text-[10px] text-gray-400 mt-1">0 = sin penalización</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 mb-3">
                Ejemplo: 48 horas gratuitas + 50% penalización → si cancela con más de 48h de anticipación, reembolso total. Si cancela después, retiene el 50%.
              </div>
              <textarea value={editConfig.politicaCancelacion ?? ''} rows={2}
                onChange={e => setEditConfig(p => ({ ...p, politicaCancelacion: e.target.value }))}
                placeholder="Texto que verá el cliente al reservar. Ej: Cancelación gratuita hasta 48h antes."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>

            <button onClick={guardarConfig} disabled={guardando}
              className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] transition-colors disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        )}
        {/* ── CALENDARIO DE OCUPACIÓN ── */}
        {cfg?.activo && calendarioHabitaciones.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-6 mt-4">
            <h2 className="font-bold text-gray-900 mb-4">Calendario de ocupación</h2>
            <CalendarioOcupacion
              mes={mesCalendario}
              habitaciones={calendarioHabitaciones}
              reservas={reservasCalendario}
              onMesAnterior={() => setMesCalendario(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              onMesSiguiente={() => setMesCalendario(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            />
          </section>
        )}

        {/* ── CUPONES ── */}
        {cfg?.activo && (
          <section className="bg-white rounded-2xl shadow-sm p-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Cupones de descuento</h2>
              <button onClick={() => setMostrarFormCupon(true)}
                className="text-sm font-medium bg-[#1B4332] text-white px-4 py-2 rounded-xl hover:bg-[#2D6A4F] transition-colors">
                + Nuevo cupón
              </button>
            </div>

            {cupones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin cupones activos. Crea uno para ofrecer descuentos a tus huéspedes.</p>
            ) : (
              <div className="space-y-2">
                {cupones.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-mono font-semibold text-sm text-[#1B4332]">{c.codigo}</p>
                      <p className="text-xs text-gray-500">
                        {c.tipo === 'PORCENTAJE' ? `${c.valor}% descuento` : `$${Number(c.valor).toLocaleString('es-CO')} fijo`}
                        {c.minimoNoches ? ` · mín. ${c.minimoNoches} noches` : ''}
                        {' · '}{c.usosActuales}{c.usosMaximos ? `/${c.usosMaximos}` : ''} usos
                        {' · '}{new Date(c.fin) > new Date() ? <span className="text-emerald-600">Activo</span> : <span className="text-red-500">Vencido</span>}
                      </p>
                    </div>
                    <button onClick={() => eliminarCuponHotel(c.id).then(cargarCupones)}
                      className="text-xs text-red-400 hover:text-red-600">Desactivar</button>
                  </div>
                ))}
              </div>
            )}

            {mostrarFormCupon && (
              <FormNuevoCupon onCreado={() => { setMostrarFormCupon(false); cargarCupones() }} onCancelar={() => setMostrarFormCupon(false)} />
            )}
          </section>
        )}

        {/* ── TEMPORADAS ── */}
        {cfg?.activo && (
          <section className="bg-white rounded-2xl shadow-sm p-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">Precios por temporada</h2>
                <p className="text-xs text-gray-400 mt-0.5">Define precios especiales para fechas como Semana Santa, temporada alta o vacaciones</p>
              </div>
              <button onClick={() => setMostrarFormTemporada(true)}
                className="text-sm font-medium bg-[#1B4332] text-white px-4 py-2 rounded-xl hover:bg-[#2D6A4F] transition-colors">
                + Nueva temporada
              </button>
            </div>

            {temporadas.filter(t => t.activo).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin temporadas. Los precios base de cada habitación aplican todo el año.</p>
            ) : (
              <div className="space-y-2">
                {temporadas.filter(t => t.activo).map(t => {
                  const inicio = new Date(t.inicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                  const fin    = new Date(t.fin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                  const vencida = new Date(t.fin) < new Date()
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{t.nombre}</p>
                        <p className="text-xs text-gray-500">
                          {inicio} → {fin}
                          {t.habitacionTipo ? ` · Solo: ${t.habitacionTipo.nombre}` : ' · Todas las habitaciones'}
                          {' · '}
                          <span className="font-medium text-[#1B4332]">${Number(t.precioPorNoche).toLocaleString('es-CO')}/noche</span>
                          {vencida && <span className="text-red-400 ml-1">(vencida)</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => eliminarTemporadaHotel(t.id).then(cargarTemporadas)}
                        className="text-xs text-red-400 hover:text-red-600">
                        Quitar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {mostrarFormTemporada && (
              <FormNuevaTemporada
                habitaciones={cfg.habitaciones}
                onCreada={() => { setMostrarFormTemporada(false); cargarTemporadas() }}
                onCancelar={() => setMostrarFormTemporada(false)}
              />
            )}
          </section>
        )}
      </main>

      {/* Modal nueva/editar habitación */}
      {formHab.visible && (
        <FormHabitacion
          inicial={formHab.inicial}
          onCancelar={() => setFormHab({ visible: false })}
          onGuardar={async (datos, archivos) => {
            if (formHab.inicial?.id) {
              await actualizarHabitacion(formHab.inicial.id, datos)
            } else {
              const nueva = await agregarHabitacion(datos)
              if (archivos && archivos.length > 0) {
                await subirFotosHabitacion(nueva.id, archivos)
              }
            }
            setFormHab({ visible: false })
            cargar()
          }}
        />
      )}
    </div>
  )
}
