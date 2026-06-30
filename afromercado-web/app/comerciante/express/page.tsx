'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  obtenerConfigExpress, actualizarConfigExpress, toggleAbiertoExpress,
  pedidosComercioExpress, aceptarPedidoExpress, rechazarPedidoExpress, avanzarEstadoExpress,
  festivosColombia, obtenerMenuComercioExpress,
  listarSeccionesExpress, crearSeccionExpress, actualizarSeccionExpress,
  eliminarSeccionExpress, asignarSeccionProducto,
  listarCuponesExpress, crearCuponExpress, eliminarCuponExpress, obtenerEstadisticasExpress,
  type ConfigExpress, type PedidoExpress, type ModalidadExpress, type DiaSemana, type HorarioExpress,
  type MenuSeccion, type MenuComercioExpress, type CuponExpress, type EstadisticasExpress,
} from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { obtenerToken } from '@/lib/api/client'
import { obtenerMiComercio } from '@/components/comerciante/api'
import { MUNICIPIOS_POR_DEPARTAMENTO } from '@/components/comerciante/constantes'

const DIAS: { dia: DiaSemana; label: string }[] = [
  { dia: 'LUNES',     label: 'Lunes' },
  { dia: 'MARTES',    label: 'Martes' },
  { dia: 'MIERCOLES', label: 'Miércoles' },
  { dia: 'JUEVES',    label: 'Jueves' },
  { dia: 'VIERNES',   label: 'Viernes' },
  { dia: 'SABADO',    label: 'Sábado' },
  { dia: 'DOMINGO',   label: 'Domingo' },
  { dia: 'FESTIVO',   label: '🎉 Festivos' },
]

const HORARIO_DEFAULT: HorarioExpress[] = DIAS.map(({ dia }) => ({
  dia,
  abierto:  !['DOMINGO'].includes(dia),
  apertura: '07:00',
  cierre:   '20:00',
}))

const MODALIDAD_LABEL: Record<ModalidadExpress, string> = {
  DOMICILIO: '🛵 Domicilio',
  RECOGER:   '🏃 Recoger',
  MESA:      '🪑 Mesa',
}

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:      'bg-yellow-100 text-yellow-800',
  ACEPTADO:       'bg-blue-100 text-blue-800',
  EN_PREPARACION: 'bg-purple-100 text-purple-800',
  LISTO:          'bg-orange-100 text-orange-800',
  EN_CAMINO:      'bg-indigo-100 text-indigo-800',
  ENTREGADO:      'bg-green-100 text-green-800',
  CANCELADO:      'bg-red-100 text-red-800',
  RECHAZADO:      'bg-gray-100 text-gray-700',
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:      'Pendiente',
  ACEPTADO:       'Aceptado',
  EN_PREPARACION: 'En preparación',
  LISTO:          'Listo',
  EN_CAMINO:      'En camino',
  ENTREGADO:      'Entregado',
  CANCELADO:      'Cancelado',
  RECHAZADO:      'Rechazado',
}

const ACCION_AVANZAR: Record<string, string> = {
  ACEPTADO:       'Iniciar preparación',
  EN_PREPARACION: 'Marcar listo',
  LISTO:          'En camino',
  EN_CAMINO:      'Marcar entregado',
}

type Pestana = 'activos' | 'config' | 'historial' | 'menu' | 'cupones' | 'estadisticas'

export default function ExpressComerciante() {
  const [pestana, setPestana]   = useState<Pestana>('activos')
  const [config, setConfig]           = useState<ConfigExpress | null>(null)
  const [pedidos, setPedidos]         = useState<PedidoExpress[]>([])
  const [cargando, setCargando]       = useState(true)
  const [pedidosNuevos, setPedidosNuevos] = useState(0)
  const pedidosRef                    = useRef<PedidoExpress[]>([])
  const primerasCarga                 = useRef(true)
  const [comercioDep, setComercioDep] = useState('Chocó')
  const [comercioMun, setComercioMun] = useState('')
  const [busqMunicipio, setBusqMunicipio] = useState('')
  const [municipioCustom, setMunicipioCustom] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editConfig, setEditConfig] = useState<Partial<ConfigExpress>>({})
  const [horarios, setHorarios]   = useState<HorarioExpress[]>(HORARIO_DEFAULT)
  const [festivos, setFestivos]   = useState<string[]>([])
  const [error, setError]         = useState('')
  const [secciones, setSecciones]         = useState<MenuSeccion[]>([])
  const [productosExpress, setProductosExpress] = useState<MenuComercioExpress['productos']>([])
  const [miComercioId, setMiComercioId]   = useState<number | null>(null)
  const miComercioIdRef = useRef<number | null>(null)
  const [nuevaSeccion, setNuevaSeccion]   = useState({ nombre: '', icono: '🍽️' })
  const [cargandoMenu, setCargandoMenu]   = useState(false)
  const [editandoSeccion, setEditandoSeccion] = useState<number | null>(null)
  const [editSeccionNombre, setEditSeccionNombre] = useState('')
  const [editSeccionIcono, setEditSeccionIcono]   = useState('')
  const [cupones, setCupones]           = useState<CuponExpress[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasExpress | null>(null)
  const [cargandoStats, setCargandoStats] = useState(false)
  const [nuevoCupon, setNuevoCupon]     = useState({
    codigo: '', tipo: 'PORCENTAJE' as 'PORCENTAJE' | 'VALOR_FIJO',
    valor: '', minimoSubtotal: '', usosMaximos: '',
    inicio: new Date().toISOString().split('T')[0],
    fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  })
  const [guardandoCupon, setGuardandoCupon] = useState(false)
  const [errorCupon, setErrorCupon]         = useState('')

  const cargar = useCallback(async () => {
    try {
      const [cfg, peds, fest, comercio] = await Promise.all([
        obtenerConfigExpress(),
        pedidosComercioExpress(),
        festivosColombia(),
        obtenerMiComercio().catch(() => null),
      ])
      if (comercio) {
        const dep = (comercio as any).departamento ?? 'Chocó'
        setComercioDep(dep)
        setComercioMun(comercio.municipio ?? '')
        const cid = (comercio as any).id ?? null
        setMiComercioId(cid)
        miComercioIdRef.current = cid
      }
      listarSeccionesExpress().then(setSecciones).catch(() => {})
      setConfig(cfg)
      // Solo inicializar editConfig en la primera carga — no pisar cambios no guardados
      if (primerasCarga.current) {
        setEditConfig(cfg)
        primerasCarga.current = false
      }
      // Detectar pedidos PENDIENTE nuevos vs los que ya teníamos
      const prevIds = new Set(pedidosRef.current.map(p => p.id))
      const nuevos = peds.filter(p => p.estado === 'PENDIENTE' && !prevIds.has(p.id))
      if (nuevos.length > 0 && pedidosRef.current.length > 0) {
        setPedidosNuevos(n => n + nuevos.length)
        // Alerta sonora con Web Audio API (sin archivo externo)
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          ;[0, 150, 300].forEach(delay => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.3, ctx.currentTime + delay / 1000)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.3)
            osc.start(ctx.currentTime + delay / 1000)
            osc.stop(ctx.currentTime + delay / 1000 + 0.3)
          })
        } catch {}
      }
      pedidosRef.current = peds
      setPedidos(peds)
      setFestivos(fest.festivos)
      // Mezclar horarios guardados con defaults
      if (cfg.horarios && cfg.horarios.length > 0) {
        const merged = HORARIO_DEFAULT.map(def => {
          const guardado = cfg.horarios!.find(h => h.dia === def.dia)
          return guardado ? { ...guardado } : def
        })
        setHorarios(merged)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 20_000)
    return () => clearInterval(interval)
  }, [cargar])

  // SSE: recarga inmediata cuando llega notificación de nuevo pedido
  useEffect(() => {
    const token = obtenerToken()
    if (!token) return
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'
    const es = new EventSource(`${API}/notificaciones/stream?token=${encodeURIComponent(token)}`)
    es.addEventListener('notificacion', (e) => {
      try {
        const notif = JSON.parse((e as MessageEvent).data)
        if (notif?.tipo === 'NUEVO_PEDIDO_EXPRESS' || notif?.url?.includes('express')) {
          cargar()
        }
      } catch {}
    })
    return () => es.close()
  }, [])

  async function cargarMenuExpressPropio() {
    const id = miComercioIdRef.current ?? miComercioId
    if (!id) return
    setCargandoMenu(true)
    try {
      const menu = await obtenerMenuComercioExpress(id)
      if (menu) setProductosExpress(menu.productos)
    } catch {}
    finally { setCargandoMenu(false) }
  }

  async function toggleAbierto() {
    if (!config) return
    try {
      const updated = await toggleAbiertoExpress(!config.abierto)
      setConfig(updated)
    } catch (e: any) { setError(e.message) }
  }

  async function guardarConfig() {
    setGuardando(true)
    try {
      const updated = await actualizarConfigExpress({ ...editConfig, horarios })
      setConfig(updated)
      setEditConfig(updated)
      setError('')
    } catch (e: any) { setError(e.message) }
    finally { setGuardando(false) }
  }

  function actualizarHorario(dia: DiaSemana, campo: keyof HorarioExpress, valor: any) {
    setHorarios(prev => prev.map(h => h.dia === dia ? { ...h, [campo]: valor } : h))
  }

  async function aceptar(id: number) {
    try {
      const updated = await aceptarPedidoExpress(id)
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    } catch (e: any) { setError(e.message) }
  }

  async function rechazar(id: number) {
    const motivo = prompt('Motivo del rechazo (opcional):') ?? undefined
    try {
      const updated = await rechazarPedidoExpress(id, motivo)
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    } catch (e: any) { setError(e.message) }
  }

  async function avanzar(id: number) {
    try {
      const updated = await avanzarEstadoExpress(id)
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    } catch (e: any) { setError(e.message) }
  }

  const activos   = pedidos.filter(p => !['ENTREGADO','CANCELADO','RECHAZADO'].includes(p.estado))
  const historial = pedidos.filter(p =>  ['ENTREGADO','CANCELADO','RECHAZADO'].includes(p.estado))

  if (cargando) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos Express</h1>
          <p className="text-sm text-gray-500">Gestiona tu servicio de comida en tiempo real</p>
        </div>
        {config && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={toggleAbierto}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                config.abierto
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {config.abierto ? '🟢 Módulo activo' : '⏸ Módulo pausado'}
            </button>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              (config as any).abiertoAhora
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-600'
            }`}>
              {(config as any).abiertoAhora ? '● Abierto ahora' : '● Cerrado según horario'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Deuda de efectivo */}
      {config && Number(config.deudaEfectivoActual) > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 text-sm text-yellow-800">
          ⚠️ Deuda por pedidos en efectivo: <strong>{formatearPrecio(Number(config.deudaEfectivoActual))}</strong>
          {' '}— Límite: {formatearPrecio(Number(config.limiteCreditoEfectivo))}.
          Contacta a AfroMercado para saldarla.
        </div>
      )}

      {/* Pestañas */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        {([
          ['activos', `Activos (${activos.length})`],
          ['historial', 'Historial'],
          ['menu', '🗂️ Menú'],
          ['cupones', '🎟️ Cupones'],
          ['estadisticas', '📊 Stats'],
          ['config', 'Configuración'],
        ] as [Pestana, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setPestana(id)
              if (id === 'activos') setPedidosNuevos(0)
              if (id === 'menu') {
                listarSeccionesExpress().then(setSecciones).catch(() => {})
                cargarMenuExpressPropio()
              }
              if (id === 'cupones') listarCuponesExpress().then(setCupones).catch(() => {})
              if (id === 'estadisticas') {
                setCargandoStats(true)
                obtenerEstadisticasExpress().then(setEstadisticas).catch(() => {}).finally(() => setCargandoStats(false))
              }
            }}
            className={`relative px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              pestana === id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {id === 'activos' && pedidosNuevos > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {pedidosNuevos}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVOS ── */}
      {pestana === 'activos' && (
        <div className="space-y-3">
          {activos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🍽️</div>
              <p>No hay pedidos activos</p>
            </div>
          )}
          {activos.map(p => <TarjetaPedido key={p.id} pedido={p} onAceptar={aceptar} onRechazar={rechazar} onAvanzar={avanzar} />)}
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {pestana === 'historial' && (
        <div className="space-y-3">
          {historial.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p>Sin historial todavía</p>
            </div>
          )}
          {historial.map(p => <TarjetaPedido key={p.id} pedido={p} onAceptar={aceptar} onRechazar={rechazar} onAvanzar={avanzar} />)}
        </div>
      )}

      {/* ── MENÚ ── */}
      {pestana === 'menu' && (
        <div className="space-y-6">

          {/* Secciones existentes */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Secciones del menú</h2>
              <span className="text-xs text-gray-400">{secciones.length} sección{secciones.length !== 1 ? 'es' : ''}</span>
            </div>

            {secciones.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">
                Aún no has creado secciones. Las secciones organizan tu menú para los clientes.
              </p>
            )}

            <div className="space-y-2">
              {secciones.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  {editandoSeccion === s.id ? (
                    <>
                      <input
                        value={editSeccionIcono}
                        onChange={e => setEditSeccionIcono(e.target.value)}
                        className="w-12 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-lg"
                      />
                      <input
                        value={editSeccionNombre}
                        onChange={e => setEditSeccionNombre(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={async () => {
                          await actualizarSeccionExpress(s.id, { nombre: editSeccionNombre, icono: editSeccionIcono })
                          const updated = await listarSeccionesExpress()
                          setSecciones(updated)
                          setEditandoSeccion(null)
                        }}
                        className="text-xs bg-[#2D6A4F] text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Guardar
                      </button>
                      <button onClick={() => setEditandoSeccion(null)} className="text-xs text-gray-400 px-2 py-1.5">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">{s.icono}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{s.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {productosExpress.filter(p => p.menuSeccionId === s.id).length} productos
                        </p>
                      </div>
                      {/* Reordenar */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={async () => {
                            const prev = secciones[idx - 1]
                            await actualizarSeccionExpress(s.id, { orden: prev.orden })
                            await actualizarSeccionExpress(prev.id, { orden: s.orden })
                            setSecciones(await listarSeccionesExpress())
                          }}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                        >▲</button>
                        <button
                          disabled={idx === secciones.length - 1}
                          onClick={async () => {
                            const next = secciones[idx + 1]
                            await actualizarSeccionExpress(s.id, { orden: next.orden })
                            await actualizarSeccionExpress(next.id, { orden: s.orden })
                            setSecciones(await listarSeccionesExpress())
                          }}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                        >▼</button>
                      </div>
                      <button
                        onClick={() => {
                          setEditandoSeccion(s.id)
                          setEditSeccionNombre(s.nombre)
                          setEditSeccionIcono(s.icono)
                        }}
                        className="text-xs text-[#2D6A4F] border border-[#2D6A4F] px-2 py-1 rounded-lg"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar la sección "${s.nombre}"? Los productos quedarán sin sección.`)) return
                          await eliminarSeccionExpress(s.id)
                          setSecciones(await listarSeccionesExpress())
                          setProductosExpress(prev => prev.map(p => p.menuSeccionId === s.id ? { ...p, menuSeccionId: null } : p))
                        }}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Crear nueva sección */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Nueva sección</p>
              <div className="flex gap-2">
                <input
                  value={nuevaSeccion.icono}
                  onChange={e => setNuevaSeccion(p => ({ ...p, icono: e.target.value }))}
                  placeholder="🥤"
                  className="w-14 border border-gray-200 rounded-xl px-2 py-2 text-center text-lg"
                />
                <input
                  value={nuevaSeccion.nombre}
                  onChange={e => setNuevaSeccion(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Bebidas, Postres, Platos fuertes…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  disabled={!nuevaSeccion.nombre.trim()}
                  onClick={async () => {
                    if (!nuevaSeccion.nombre.trim()) return
                    await crearSeccionExpress(nuevaSeccion)
                    setSecciones(await listarSeccionesExpress())
                    setNuevaSeccion({ nombre: '', icono: '🍽️' })
                  }}
                  className="bg-[#2D6A4F] text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
                >
                  + Crear
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">El ícono puede ser un emoji. Ej: 🥤 Bebidas, 🍮 Postres, 🥗 Ensaladas</p>
            </div>
          </div>

          {/* Asignar secciones a productos */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Organizar productos por sección</h2>
              <button
                onClick={cargarMenuExpressPropio}
                className="text-xs text-[#2D6A4F] border border-[#2D6A4F] px-3 py-1 rounded-lg"
              >
                Recargar
              </button>
            </div>

            {cargandoMenu ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : productosExpress.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <p className="text-2xl mb-2">🥘</p>
                <p>No tienes productos Express activos.</p>
                <p className="mt-1">Ve a <a href="/comerciante/mis-productos" className="text-[#2D6A4F] underline">Mis productos</a> y activa &quot;Express&quot; en los que quieras mostrar aquí.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {productosExpress.map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    {p.fotoUrl ? (
                      <img src={p.fotoUrl} alt={p.nombre} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#F0EBE3] flex items-center justify-center text-sm flex-shrink-0">🥘</div>
                    )}
                    <p className="flex-1 text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                    <select
                      value={p.menuSeccionId ?? ''}
                      onChange={async e => {
                        const val = e.target.value === '' ? null : Number(e.target.value)
                        await asignarSeccionProducto(p.id, val)
                        setProductosExpress(prev => prev.map(x => x.id === p.id ? { ...x, menuSeccionId: val } : x))
                      }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    >
                      <option value="">Sin sección</option>
                      {secciones.map(s => (
                        <option key={s.id} value={s.id}>{s.icono} {s.nombre}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── ESTADÍSTICAS ── */}
      {pestana === 'estadisticas' && (
        <div className="space-y-5">
          {cargandoStats || !estadisticas ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { label: 'Hoy', data: estadisticas.hoy, color: 'bg-blue-50 border-blue-100' },
                  { label: 'Esta semana', data: estadisticas.semana, color: 'bg-green-50 border-green-100' },
                  { label: 'Este mes', data: estadisticas.mes, color: 'bg-purple-50 border-purple-100' },
                ] as const).map(({ label, data, color }) => (
                  <div key={label} className={`rounded-2xl border p-3 ${color}`}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                    <p className="text-lg font-bold text-gray-800">{data.pedidos}</p>
                    <p className="text-xs text-gray-500">pedidos</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">${data.ingresos.toLocaleString('es-CO')}</p>
                    <p className="text-xs text-gray-400">ingresos</p>
                  </div>
                ))}
              </div>

              {/* Horas pico */}
              {estadisticas.horasPico.some(h => h > 0) && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Horas pico (últimos 30 días)</h3>
                  <div className="flex items-end gap-1 h-16">
                    {estadisticas.horasPico.map((count, hora) => {
                      const max = Math.max(...estadisticas.horasPico, 1)
                      const h = hora % 12 || 12
                      const ampm = hora < 12 ? 'a' : 'p'
                      return (
                        <div key={hora} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-[#2D6A4F] rounded-t transition-all"
                            style={{ height: `${(count / max) * 56}px`, minHeight: count > 0 ? 4 : 0 }}
                            title={`${hora}h: ${count} pedidos`}
                          />
                          {(hora % 6 === 0) && (
                            <span className="text-[9px] text-gray-400">{h}{ampm}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Top productos */}
              {estadisticas.topProductos.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Productos más pedidos</h3>
                  <div className="space-y-3">
                    {estadisticas.topProductos.map((item, idx) => (
                      <div key={item.producto.id} className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm font-bold w-5">{idx + 1}</span>
                        {item.producto.fotoUrl ? (
                          <img src={item.producto.fotoUrl} alt={item.producto.nombre} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">🥘</div>
                        )}
                        <p className="flex-1 text-sm font-medium text-gray-800 truncate">{item.producto.nombre}</p>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#1B4332]">{item.cantidad}</p>
                          <p className="text-xs text-gray-400">unid.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Últimos pedidos */}
              {estadisticas.ultimosPedidos.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">Últimos pedidos</h3>
                  <div className="space-y-2">
                    {estadisticas.ultimosPedidos.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="font-mono text-xs text-gray-500">{p.codigo}</span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${ESTADO_COLOR[p.estado]}`}>
                            {ESTADO_LABEL[p.estado]}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-700">${Number(p.total).toLocaleString('es-CO')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sin datos */}
              {estadisticas.mes.pedidos === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">📊</p>
                  <p>Aún no hay datos de pedidos entregados.</p>
                  <p className="text-sm mt-1">Las estadísticas aparecerán cuando tengas pedidos completados.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CUPONES ── */}
      {pestana === 'cupones' && (
        <div className="space-y-5">

          {/* Lista de cupones */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Cupones activos</h2>
              <span className="text-xs text-gray-400">{cupones.filter(c => c.activo).length} activos</span>
            </div>

            {cupones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No hay cupones creados. Crea uno abajo para que tus clientes obtengan descuentos.
              </p>
            ) : (
              <div className="space-y-3">
                {cupones.map(c => {
                  const vencido = new Date(c.fin) < new Date()
                  return (
                    <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                      !c.activo || vencido ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-green-50 border-green-100'
                    }`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#1B4332]">{c.codigo}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.tipo === 'PORCENTAJE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {c.tipo === 'PORCENTAJE' ? `${Number(c.valor)}% OFF` : `-$${Number(c.valor).toLocaleString('es-CO')}`}
                          </span>
                          {vencido && <span className="text-xs text-red-500 font-medium">Vencido</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          {c.minimoSubtotal && <p>Mínimo: ${Number(c.minimoSubtotal).toLocaleString('es-CO')}</p>}
                          <p>
                            {new Date(c.inicio).toLocaleDateString('es-CO')} → {new Date(c.fin).toLocaleDateString('es-CO')}
                          </p>
                          <p>Usos: {c.usosActuales}{c.usosMaximos ? ` / ${c.usosMaximos}` : ''}</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Desactivar el cupón ${c.codigo}?`)) return
                          await eliminarCuponExpress(c.id)
                          setCupones(prev => prev.map(x => x.id === c.id ? { ...x, activo: false } : x))
                        }}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg flex-shrink-0"
                      >
                        Desactivar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Crear cupón */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Crear cupón</h2>

            {errorCupon && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errorCupon}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Código *</label>
                <input
                  value={nuevoCupon.codigo}
                  onChange={e => setNuevoCupon(p => ({ ...p, codigo: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                  placeholder="Ej: BEBIDA20, LAUNCH10…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select
                  value={nuevoCupon.tipo}
                  onChange={e => setNuevoCupon(p => ({ ...p, tipo: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="PORCENTAJE">% Porcentaje</option>
                  <option value="VALOR_FIJO">$ Valor fijo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Valor * {nuevoCupon.tipo === 'PORCENTAJE' ? '(%)' : '($)'}
                </label>
                <input
                  type="number" min={1} max={nuevoCupon.tipo === 'PORCENTAJE' ? 100 : undefined}
                  value={nuevoCupon.valor}
                  onChange={e => setNuevoCupon(p => ({ ...p, valor: e.target.value }))}
                  placeholder={nuevoCupon.tipo === 'PORCENTAJE' ? '20' : '5000'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subtotal mínimo ($)</label>
                <input
                  type="number" min={0}
                  value={nuevoCupon.minimoSubtotal}
                  onChange={e => setNuevoCupon(p => ({ ...p, minimoSubtotal: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Límite de usos</label>
                <input
                  type="number" min={1}
                  value={nuevoCupon.usosMaximos}
                  onChange={e => setNuevoCupon(p => ({ ...p, usosMaximos: e.target.value }))}
                  placeholder="Sin límite"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio *</label>
                <input
                  type="date"
                  value={nuevoCupon.inicio}
                  onChange={e => setNuevoCupon(p => ({ ...p, inicio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin *</label>
                <input
                  type="date"
                  value={nuevoCupon.fin}
                  onChange={e => setNuevoCupon(p => ({ ...p, fin: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              disabled={guardandoCupon || !nuevoCupon.codigo.trim() || !nuevoCupon.valor}
              onClick={async () => {
                if (!nuevoCupon.codigo.trim() || !nuevoCupon.valor) return
                setGuardandoCupon(true)
                setErrorCupon('')
                try {
                  await crearCuponExpress({
                    codigo: nuevoCupon.codigo.trim(),
                    tipo: nuevoCupon.tipo,
                    valor: Number(nuevoCupon.valor),
                    minimoSubtotal: nuevoCupon.minimoSubtotal ? Number(nuevoCupon.minimoSubtotal) : undefined,
                    usosMaximos: nuevoCupon.usosMaximos ? Number(nuevoCupon.usosMaximos) : undefined,
                    inicio: nuevoCupon.inicio,
                    fin: nuevoCupon.fin,
                  })
                  const updated = await listarCuponesExpress()
                  setCupones(updated)
                  setNuevoCupon({
                    codigo: '', tipo: 'PORCENTAJE', valor: '', minimoSubtotal: '', usosMaximos: '',
                    inicio: new Date().toISOString().split('T')[0],
                    fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                  })
                } catch (e: any) {
                  setErrorCupon(e?.message ?? 'Error al crear el cupón')
                } finally {
                  setGuardandoCupon(false)
                }
              }}
              className="w-full bg-[#2D6A4F] text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {guardandoCupon ? 'Creando...' : '🎟️ Crear cupón'}
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIGURACIÓN ── */}
      {pestana === 'config' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-gray-800">Configuración del servicio Express</h2>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="activo"
              checked={editConfig.activo ?? false}
              onChange={e => setEditConfig(prev => ({ ...prev, activo: e.target.checked }))}
              className="w-4 h-4 accent-green-600"
            />
            <label htmlFor="activo" className="text-sm font-medium">Módulo Express activo</label>
          </div>

          {/* Editor de horarios por día */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-3">Horario por día</label>
            <div className="space-y-2">
              {DIAS.map(({ dia, label }) => {
                const h = horarios.find(x => x.dia === dia) ?? { dia, abierto: false, apertura: '07:00', cierre: '20:00' }
                return (
                  <div key={dia} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    h.abierto ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    {/* Toggle abierto */}
                    <button
                      onClick={() => actualizarHorario(dia, 'abierto', !h.abierto)}
                      className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${
                        h.abierto ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        h.abierto ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>

                    {/* Nombre día */}
                    <span className={`text-sm font-medium w-24 flex-shrink-0 ${h.abierto ? 'text-gray-800' : 'text-gray-400'}`}>
                      {label}
                    </span>

                    {h.abierto ? (
                      <div className="flex items-center gap-2 flex-1">
                        {/* Chip 24h */}
                        <button
                          onClick={() => {
                            const es24h = h.apertura === '00:00' && h.cierre === '23:59'
                            actualizarHorario(dia, 'apertura', es24h ? '07:00' : '00:00')
                            actualizarHorario(dia, 'cierre',   es24h ? '20:00' : '23:59')
                          }}
                          className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 transition-colors ${
                            h.apertura === '00:00' && h.cierre === '23:59'
                              ? 'bg-amber-400 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-amber-100'
                          }`}
                        >
                          24h
                        </button>
                        <input
                          type="time"
                          value={h.apertura}
                          disabled={h.apertura === '00:00' && h.cierre === '23:59'}
                          onChange={e => actualizarHorario(dia, 'apertura', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm flex-1 min-w-0 disabled:opacity-40"
                        />
                        <span className="text-gray-400 text-xs flex-shrink-0">a</span>
                        <input
                          type="time"
                          value={h.cierre}
                          disabled={h.apertura === '00:00' && h.cierre === '23:59'}
                          onChange={e => actualizarHorario(dia, 'cierre', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm flex-1 min-w-0 disabled:opacity-40"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Cerrado</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Festivos del año */}
          {festivos.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Festivos Colombia {new Date().getFullYear()} ({festivos.length} días)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-200">
                {festivos.map(f => (
                  <span key={f} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                    {new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                En días festivos se aplica el horario de la fila 🎉 Festivos
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tiempo de preparación (minutos)</label>
            <input
              type="number" min={5} max={120}
              value={editConfig.tiempoPrepMinutos ?? 20}
              onChange={e => setEditConfig(prev => ({ ...prev, tiempoPrepMinutos: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Costo de envío base ($)</label>
            <input
              type="number" min={0}
              value={Number(editConfig.costoEnvioBase ?? 3000)}
              onChange={e => setEditConfig(prev => ({ ...prev, costoEnvioBase: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Modalidades de entrega</label>
            <div className="flex flex-wrap gap-2">
              {(['DOMICILIO', 'RECOGER', 'MESA'] as ModalidadExpress[]).map(m => {
                const sel = (editConfig.modalidades ?? []).includes(m)
                return (
                  <button
                    key={m}
                    onClick={() => setEditConfig(prev => {
                      const list = prev.modalidades ?? []
                      return { ...prev, modalidades: sel ? list.filter(x => x !== m) : [...list, m] }
                    })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      sel ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {MODALIDAD_LABEL[m]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Municipios de entrega</label>
            <p className="text-xs text-gray-400 mb-3">
              Toca para seleccionar / deseleccionar. 📍 = tu municipio.
            </p>

            {/* Buscador */}
            <input
              type="text"
              value={busqMunicipio}
              onChange={e => setBusqMunicipio(e.target.value)}
              placeholder={`Buscar en ${comercioDep}...`}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-green-400"
            />

            {/* Lista única: municipios del departamento + extras fuera del depto */}
            {(() => {
              const deptoMunicipios = MUNICIPIOS_POR_DEPARTAMENTO[comercioDep] ?? []
              const seleccionados = editConfig.municipiosEntrega ?? []
              // Extras: seleccionados que no están en la lista del depto
              const extras = seleccionados.filter(m => !deptoMunicipios.includes(m))
              const filtrados = deptoMunicipios.filter(m =>
                !busqMunicipio || m.toLowerCase().includes(busqMunicipio.toLowerCase())
              )
              const toggle = (mun: string) => setEditConfig(prev => {
                const list = prev.municipiosEntrega ?? []
                const ya = list.includes(mun)
                return { ...prev, municipiosEntrega: ya ? list.filter(x => x !== mun) : [...list, mun] }
              })
              return (
                <>
                  <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pb-1">
                    {filtrados.map(mun => {
                      const sel = seleccionados.includes(mun)
                      const esPrincipal = mun === comercioMun
                      return (
                        <button key={mun} onClick={() => toggle(mun)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            sel
                              ? 'bg-green-600 text-white border-green-600'
                              : esPrincipal
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {esPrincipal ? '📍 ' : ''}{mun}
                        </button>
                      )
                    })}
                  </div>

                  {/* Municipios de otros departamentos ya agregados */}
                  {extras.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-1.5">Otros departamentos:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {extras.map(mun => (
                          <button key={mun} onClick={() => toggle(mun)}
                            className="px-3 py-1 rounded-full text-xs font-medium border bg-green-600 text-white border-green-600 transition-colors"
                          >
                            {mun} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Agregar municipio de otro departamento */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={municipioCustom}
                onChange={e => setMunicipioCustom(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter' || !municipioCustom.trim()) return
                  const m = municipioCustom.trim()
                  setEditConfig(prev => {
                    const list = prev.municipiosEntrega ?? []
                    return { ...prev, municipiosEntrega: list.includes(m) ? list : [...list, m] }
                  })
                  setMunicipioCustom('')
                }}
                placeholder="Agregar ciudad de otro departamento…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
              <button
                onClick={() => {
                  const m = municipioCustom.trim()
                  if (!m) return
                  setEditConfig(prev => {
                    const list = prev.municipiosEntrega ?? []
                    return { ...prev, municipiosEntrega: list.includes(m) ? list : [...list, m] }
                  })
                  setMunicipioCustom('')
                }}
                className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
              >
                + Agregar
              </button>
            </div>
          </div>

          <button
            onClick={guardarConfig}
            disabled={guardando}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      )}
    </div>
  )
}

function TarjetaPedido({
  pedido, onAceptar, onRechazar, onAvanzar,
}: {
  pedido: PedidoExpress
  onAceptar: (id: number) => void
  onRechazar: (id: number) => void
  onAvanzar: (id: number) => void
}) {
  const expiresIn = pedido.estado === 'PENDIENTE'
    ? Math.max(0, Math.round((new Date(pedido.expiresAt).getTime() - Date.now()) / 1000))
    : null

  const nombreCliente = (() => {
    const c = pedido.cliente
    if (!c) return 'Cliente'
    const n = c.nombre?.trim()
    // Si el nombre parece un email, usar la parte antes del @
    if (!n || n.includes('@')) return c.email?.split('@')[0] ?? 'Cliente'
    return n
  })()

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      {/* Cabecera: código + estado */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="font-semibold text-sm tracking-wide text-gray-700">{pedido.codigo}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_COLOR[pedido.estado]}`}>
          {ESTADO_LABEL[pedido.estado]}
        </span>
      </div>

      {/* Info del cliente */}
      <div className="bg-gray-50 rounded-xl px-3 py-2 space-y-0.5">
        <p className="text-sm font-semibold text-gray-800">👤 {nombreCliente}</p>
        {pedido.cliente?.telefono && (
          <a href={`tel:${pedido.cliente.telefono}`}
            className="text-xs text-blue-600 hover:underline block">
            📞 {pedido.cliente.telefono}
          </a>
        )}
        {pedido.cliente?.email && (
          <p className="text-xs text-gray-500">{pedido.cliente.email}</p>
        )}
        <p className="text-xs text-gray-500 pt-0.5">
          {MODALIDAD_LABEL[pedido.modalidad]} · {pedido.metodoPago}
          {pedido.tiempoEstimadoMin ? ` · ~${pedido.tiempoEstimadoMin} min` : ''}
        </p>
      </div>

      {pedido.direccionTexto && (
        <p className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          📍 {pedido.direccionTexto}
        </p>
      )}

      {pedido.notaCliente && (
        <p className="text-xs bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-yellow-800">
          📝 {pedido.notaCliente}
        </p>
      )}

      <div className="space-y-1">
        {pedido.items.map(item => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>{item.cantidad}× {item.producto?.nombre ?? `Producto #${item.productoId}`}</span>
            <span className="text-gray-500">{formatearPrecio(Number(item.subtotal))}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
          <span>Total</span>
          <span>{formatearPrecio(Number(pedido.total))}</span>
        </div>
      </div>

      {expiresIn !== null && (
        <p className={`text-xs font-semibold ${expiresIn < 60 ? 'text-red-600' : 'text-orange-600'}`}>
          ⏱ Tiempo para aceptar: {expiresIn}s
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {pedido.estado === 'PENDIENTE' && (
          <>
            <button
              onClick={() => onAceptar(pedido.id)}
              className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              ✓ Aceptar
            </button>
            <button
              onClick={() => onRechazar(pedido.id)}
              className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              ✗ Rechazar
            </button>
          </>
        )}
        {ACCION_AVANZAR[pedido.estado] && (
          <button
            onClick={() => onAvanzar(pedido.id)}
            className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            {ACCION_AVANZAR[pedido.estado]} →
          </button>
        )}
      </div>
    </div>
  )
}
