'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  obtenerMiHotel, actualizarMiHotel, agregarHabitacion, actualizarHabitacion, eliminarHabitacion,
  reservasHotelero, cambiarEstadoReserva, ocupacionHotel, subirFotosHabitacion, subirVideoHabitacion,
  quitarVideoHabitacion,
  listarBloqueos, crearBloqueo, eliminarBloqueo,
  listarCuponesHotel, crearCuponHotel, eliminarCuponHotel,
  listarTemporadasHotel, crearTemporadaHotel, eliminarTemporadaHotel,
  obtenerEstadisticasHotel,
  type ConfigHotel, type HabitacionTipo, type ReservaHotel, type EstadoReservaHotel, type BloqueoFecha, type CuponHotel, type TemporadaHotel, type EstadisticasHotel,
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

function esVideo(url: string): boolean {
  return url.includes('/video/upload/') || /\.(mp4|webm|mov|avi)$/i.test(url)
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
  habitaciones: HabitacionTipo[]
  reservas: ReservaHotel[]
  onMesAnterior: () => void
  onMesSiguiente: () => void
}) {
  const diasEnMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const dias = Array.from({ length: diasEnMes }, (_, i) => i + 1)

  const mesNombre = mes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  function getReservaInfo(habId: number, dia: number): ReservaHotel | null {
    const fecha = new Date(mes.getFullYear(), mes.getMonth(), dia)
    return reservas.find(r =>
      r.habitacionTipoId === habId &&
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
                  const r = getReservaInfo(h.id, dia)
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Ingresos 6 meses', valor: formatearPrecio(stats.ingresoTotal6m), color: 'text-[#1B4332]' },
          { label: `Reservas ${mesActual}`, valor: String(stats.reservasMesActual), color: 'text-blue-600' },
          { label: 'Reservas 6 meses', valor: String(stats.totalReservas6m), color: 'text-gray-800' },
          { label: 'Ocupación promedio', valor: `${stats.tasaOcupacionPromedio}%`, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.valor}</p>
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
                  <div key={mes} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-12 text-right capitalize">{label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div className="h-full bg-[#2D6A4F] rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, ingreso > 0 ? 4 : 0)}%` }}>
                        {ingreso > 0 && <span className="text-[10px] text-white font-medium">{formatearPrecio(ingreso)}</span>}
                      </div>
                    </div>
                    {ingreso === 0 && <span className="text-xs text-gray-300">$0</span>}
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
  const [ocupacion, setOcupacion]   = useState<{ habitaciones: HabitacionTipo[]; reservas: ReservaHotel[] } | null>(null)
  const [tab, setTab]               = useState<'reservas' | 'habitaciones' | 'config' | 'ocupacion' | 'bloqueos'>('reservas')
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
  const [filtroEstado, setFiltroEstado] = useState('')
  const primerasCarga               = useRef(true)

  const reservasRef = useRef<ReservaHotel[]>([])

  const cargar = useCallback(async () => {
    try {
      const [hotelData, reservasData] = await Promise.all([
        obtenerMiHotel(),
        reservasHotelero(),
      ])
      setCfg(hotelData)
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
    } catch {}
  }

  useEffect(() => {
    if (tab === 'ocupacion') cargarOcupacion()
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
    } catch (e: any) { setError(e.message) }
  }

  const reservasFiltradas = filtroEstado ? reservas.filter(r => r.estado === filtroEstado) : reservas
  const pendientes = reservas.filter(r => r.estado === 'PENDIENTE').length

  if (cargando) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
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

      <main className="max-w-2xl mx-auto px-4 py-4 pb-16">
        {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
        {exito && <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">{exito}</div>}

        {/* ── DASHBOARD ESTADÍSTICAS (backend) ── */}
        <section className="bg-white rounded-2xl shadow-sm p-6 mb-5">
          <h2 className="font-bold text-gray-900 mb-4">Estadísticas</h2>
          <DashboardEstadisticas />
        </section>

        {/* ── ESTADÍSTICAS ── */}
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

          const reservasActivas = reservas.filter(r =>
            r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA' || r.estado === 'CHECKIN'
          ).length

          const capacidadTotal = (cfg?.habitaciones ?? []).reduce((acc, h) => acc + h.cantidad, 0) * 30
          const tasaOcupacion = capacidadTotal > 0
            ? Math.round((reservasActivas / capacidadTotal) * 100)
            : 0

          const reseñasPendientes = reservas.filter(r => r.estado === 'CHECKOUT' && !r.review).length

          const tarjetas = [
            {
              icono: '📅',
              valor: reservasMes.length,
              etiqueta: 'Reservas este mes',
            },
            {
              icono: '💰',
              valor: ingresosMes >= 1_000_000
                ? `$${(ingresosMes / 1_000_000).toFixed(1)}M`
                : ingresosMes >= 1_000
                ? `$${Math.round(ingresosMes / 1_000)}K`
                : `$${ingresosMes}`,
              etiqueta: 'Ingresos este mes',
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
          ]

          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {tarjetas.map((t, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-1">
                  <span className="text-xl" style={{ color: '#1B4332' }}>{t.icono}</span>
                  <span className="text-3xl font-black text-gray-900 leading-none">{t.valor}</span>
                  <span className="text-xs text-gray-400 font-medium">{t.etiqueta}</span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ── RESERVAS ── */}
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
              reservasFiltradas.map(res => {
                const info = ESTADO_RESERVA[res.estado]
                const trans = TRANSICIONES[res.estado] ?? []
                const entrada = new Date(res.fechaEntrada)
                const salida  = new Date(res.fechaSalida)
                const noches  = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000)

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
              })
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
                  { key: 'permiteTotal',         label: 'Pago total online', desc: 'El cliente paga el 100% al reservar' },
                ].map(op => (
                  <div key={op.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{op.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{op.desc}</p>
                    </div>
                    <button type="button"
                      onClick={() => setEditConfig(p => ({ ...p, [op.key]: !(p as any)[op.key] }))}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${(editConfig as any)[op.key] !== false ? 'bg-[#2D6A4F]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${(editConfig as any)[op.key] !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
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
        {cfg?.activo && (cfg.habitaciones?.length ?? 0) > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-6 mt-4">
            <h2 className="font-bold text-gray-900 mb-4">Calendario de ocupación</h2>
            <CalendarioOcupacion
              mes={mesCalendario}
              habitaciones={cfg.habitaciones}
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
