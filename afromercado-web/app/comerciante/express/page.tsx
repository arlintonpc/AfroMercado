'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  obtenerConfigExpress, actualizarConfigExpress, toggleAbiertoExpress,
  pedidosComercioExpress, aceptarPedidoExpress, rechazarPedidoExpress, avanzarEstadoExpress,
  festivosColombia,
  type ConfigExpress, type PedidoExpress, type ModalidadExpress, type DiaSemana, type HorarioExpress,
} from '@/lib/api/express'
import { formatearPrecio } from '@/lib/formatearPrecio'

const MUNICIPIOS_CHOCO = [
  'Quibdó','Istmina','Tadó','Condoto','Bagadó','Acandí','Bahía Solano',
  'Nuquí','Riosucio','Carmen del Darién','Bojayá','Lloró','Cértegui',
]

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

type Pestana = 'activos' | 'config' | 'historial'

export default function ExpressComerciante() {
  const [pestana, setPestana]   = useState<Pestana>('activos')
  const [config, setConfig]       = useState<ConfigExpress | null>(null)
  const [pedidos, setPedidos]     = useState<PedidoExpress[]>([])
  const [cargando, setCargando]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editConfig, setEditConfig] = useState<Partial<ConfigExpress>>({})
  const [horarios, setHorarios]   = useState<HorarioExpress[]>(HORARIO_DEFAULT)
  const [festivos, setFestivos]   = useState<string[]>([])
  const [error, setError]         = useState('')

  const cargar = useCallback(async () => {
    try {
      const [cfg, peds, fest] = await Promise.all([
        obtenerConfigExpress(),
        pedidosComercioExpress(),
        festivosColombia(),
      ])
      setConfig(cfg)
      setEditConfig(cfg)
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
      <div className="flex border-b border-gray-200 gap-1">
        {([['activos', `Activos (${activos.length})`], ['historial', 'Historial'], ['config', 'Configuración']] as [Pestana, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              pestana === id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
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
            <label className="block text-xs font-medium text-gray-600 mb-2">Municipios de entrega</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {MUNICIPIOS_CHOCO.map(mun => {
                const sel = (editConfig.municipiosEntrega ?? []).includes(mun)
                return (
                  <button
                    key={mun}
                    onClick={() => setEditConfig(prev => {
                      const list = prev.municipiosEntrega ?? []
                      return { ...prev, municipiosEntrega: sel ? list.filter(x => x !== mun) : [...list, mun] }
                    })}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      sel ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {mun}
                  </button>
                )
              })}
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
