'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  obtenerMiHotel, actualizarMiHotel, agregarHabitacion, actualizarHabitacion, eliminarHabitacion,
  reservasHotelero, cambiarEstadoReserva, ocupacionHotel,
  type ConfigHotel, type HabitacionTipo, type ReservaHotel, type EstadoReservaHotel,
} from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { obtenerToken } from '@/lib/api/client'

const SERVICIOS_OPCIONES = ['wifi', 'desayuno', 'parking', 'piscina', 'restaurante', 'aire', 'gym', 'spa', 'bar', 'mascotas']
const SERVICIOS_LABELS: Record<string, string> = {
  wifi: '📶 WiFi', desayuno: '🍳 Desayuno', parking: '🅿️ Parqueadero', piscina: '🏊 Piscina',
  restaurante: '🍽️ Restaurante', aire: '❄️ Aire acond.', gym: '💪 Gym', spa: '💆 Spa', bar: '🍸 Bar', mascotas: '🐾 Mascotas',
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

function FormHabitacion({ inicial, onGuardar, onCancelar }: {
  inicial?: Partial<HabitacionTipo>
  onGuardar: (datos: Partial<HabitacionTipo>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState<Partial<HabitacionTipo>>({
    nombre: '', descripcion: '', capacidad: 2, precioPorNoche: 80000, cantidad: 1,
    fotos: [], serviciosExtra: [], ...inicial,
  })
  const [fotoUrl, setFotoUrl] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleGuardar() {
    if (!form.nombre?.trim() || !form.precioPorNoche) { setError('Nombre y precio son obligatorios'); return }
    setGuardando(true); setError('')
    try { await onGuardar(form) } catch (e: any) { setError(e.message) }
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
              <label className="block text-xs font-medium text-gray-600 mb-1">URLs de fotos</label>
              <div className="flex gap-2">
                <input value={fotoUrl} onChange={e => setFotoUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && fotoUrl.trim()) { setForm(p => ({ ...p, fotos: [...(p.fotos ?? []), fotoUrl.trim()] })); setFotoUrl('') }}}
                  placeholder="https://…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
                <button onClick={() => { if (fotoUrl.trim()) { setForm(p => ({ ...p, fotos: [...(p.fotos ?? []), fotoUrl.trim()] })); setFotoUrl('') }}}
                  className="px-3 bg-gray-100 rounded-xl text-sm">+</button>
              </div>
              {(form.fotos ?? []).length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(form.fotos ?? []).map((f, i) => (
                    <div key={i} className="relative">
                      <img src={f} alt="" className="w-16 h-16 object-cover rounded-lg" />
                      <button onClick={() => setForm(p => ({ ...p, fotos: (p.fotos ?? []).filter((_, j) => j !== i) }))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Servicios extra */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Servicios incluidos</label>
              <div className="flex flex-wrap gap-1.5">
                {['TV', 'Baño privado', 'Balcón', 'Vista al mar', 'Minibar', 'Caja fuerte', 'Secador de pelo'].map(s => {
                  const sel = (form.serviciosExtra ?? []).includes(s)
                  return (
                    <button key={s} onClick={() => setForm(p => {
                      const list = p.serviciosExtra ?? []
                      return { ...p, serviciosExtra: sel ? list.filter(x => x !== s) : [...list, s] }
                    })} className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${sel ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {s}
                    </button>
                  )
                })}
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

export default function ComercianteHotelesPage() {
  const [cfg, setCfg]               = useState<ConfigHotel | null>(null)
  const [reservas, setReservas]     = useState<ReservaHotel[]>([])
  const [ocupacion, setOcupacion]   = useState<{ habitaciones: HabitacionTipo[]; reservas: ReservaHotel[] } | null>(null)
  const [tab, setTab]               = useState<'reservas' | 'habitaciones' | 'config' | 'ocupacion'>('reservas')
  const [cargando, setCargando]     = useState(true)
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState('')
  const [editConfig, setEditConfig] = useState<Partial<ConfigHotel>>({})
  const [formHab, setFormHab]       = useState<{ visible: boolean; inicial?: Partial<HabitacionTipo> }>({ visible: false })
  const [filtroEstado, setFiltroEstado] = useState('')
  const primerasCarga               = useRef(true)

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
      setReservas(reservasData)
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
              <div className="flex flex-wrap gap-2">
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
              </div>
            </div>

            {/* Política de cancelación */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Política de cancelación</label>
              <textarea value={editConfig.politicaCancelacion ?? ''} rows={3}
                onChange={e => setEditConfig(p => ({ ...p, politicaCancelacion: e.target.value }))}
                placeholder="Ej: Cancelación gratuita hasta 24h antes. Después se cobra el 50%."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F] resize-none" />
            </div>

            <button onClick={guardarConfig} disabled={guardando}
              className="w-full bg-[#2D6A4F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#40916C] transition-colors disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        )}
      </main>

      {/* Modal nueva/editar habitación */}
      {formHab.visible && (
        <FormHabitacion
          inicial={formHab.inicial}
          onCancelar={() => setFormHab({ visible: false })}
          onGuardar={async datos => {
            if (formHab.inicial?.id) {
              await actualizarHabitacion(formHab.inicial.id, datos)
            } else {
              await agregarHabitacion(datos)
            }
            setFormHab({ visible: false })
            cargar()
          }}
        />
      )}
    </div>
  )
}
