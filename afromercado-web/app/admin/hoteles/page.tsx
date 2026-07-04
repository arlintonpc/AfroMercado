'use client'

import { useEffect, useState } from 'react'
import { adminListarHoteles, adminCambiarEstadoHotel, adminVerificarRntHotel, adminReservasHotel, type HotelAdmin, type ReservaHotel } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-700',
  CONFIRMADA: 'bg-green-100 text-green-700',
  CHECKIN:    'bg-blue-100 text-blue-700',
  CHECKOUT:   'bg-gray-100 text-gray-600',
  CANCELADA:  'bg-red-100 text-red-600',
  RECHAZADA:  'bg-red-100 text-red-600',
}

export default function AdminHotelesPage() {
  const [hoteles, setHoteles] = useState<HotelAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos')
  const [verReservas, setVerReservas] = useState<HotelAdmin | null>(null)
  const [reservas, setReservas] = useState<ReservaHotel[]>([])
  const [cargandoReservas, setCargandoReservas] = useState(false)

  useEffect(() => {
    adminListarHoteles().then(d => { setHoteles(d); setCargando(false) })
  }, [])

  async function toggleEstado(hotel: HotelAdmin) {
    const actualizado = await adminCambiarEstadoHotel(hotel.id, !hotel.activo)
    setHoteles(prev => prev.map(h => h.id === hotel.id ? { ...h, activo: actualizado.activo } : h))
  }

  async function toggleRnt(hotel: HotelAdmin) {
    const actualizado = await adminVerificarRntHotel(hotel.id, !hotel.rntVerificado)
    setHoteles(prev => prev.map(h => h.id === hotel.id ? { ...h, rntVerificado: actualizado.rntVerificado } : h))
  }

  async function abrirReservas(hotel: HotelAdmin) {
    setVerReservas(hotel)
    setCargandoReservas(true)
    try {
      const data = await adminReservasHotel(hotel.id)
      setReservas(data)
    } finally {
      setCargandoReservas(false)
    }
  }

  const filtrados = hoteles.filter(h => {
    if (filtroActivo === 'activos' && !h.activo) return false
    if (filtroActivo === 'inactivos' && h.activo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return h.comercio.nombre.toLowerCase().includes(q) || h.comercio.municipio.toLowerCase().includes(q)
    }
    return true
  })

  const stats = {
    total: hoteles.length,
    activos: hoteles.filter(h => h.activo).length,
    reservas: hoteles.reduce((s, h) => s + (h._count?.reservas ?? 0), 0),
    habitaciones: hoteles.reduce((s, h) => s + h.habitaciones.length, 0),
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">🏨 Hoteles & Hospedaje</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de hoteles registrados en AfroMercado</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total hoteles', val: stats.total, color: 'text-[#2D6A4F]' },
          { label: 'Activos', val: stats.activos, color: 'text-green-600' },
          { label: 'Total reservas', val: stats.reservas, color: 'text-blue-600' },
          { label: 'Tipos habitación', val: stats.habitaciones, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o municipio…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]" />
        <div className="flex gap-1">
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button key={f} onClick={() => setFiltroActivo(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize border transition-colors ${
                filtroActivo === f ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay hoteles con esos filtros</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Hotel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Ubicación</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Habitaciones</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Reservas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">RNT</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(h => (
                  <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[#1A1A1A]">{h.comercio.nombre}</p>
                        <p className="text-xs text-gray-400">ID #{h.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {h.comercio.municipio}{h.comercio.departamento ? `, ${h.comercio.departamento}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="font-medium">{h.habitaciones.length} tipos</p>
                        {h.habitaciones.length > 0 && (
                          <p className="text-xs text-gray-400">
                            desde {formatearPrecio(Math.min(...h.habitaciones.map(hab => Number(hab.precioPorNoche))))}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => abrirReservas(h)}
                        className="font-medium text-blue-600 hover:underline">
                        {h._count?.reservas ?? 0} ver
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {h.activo ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.rntVerificado ? 'bg-blue-100 text-blue-700' : h.rnt ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {h.rntVerificado ? '✓ Verificado' : h.rnt ? 'Pendiente' : 'Sin RNT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col gap-1.5 items-end">
                        <button onClick={() => toggleEstado(h)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                            h.activo
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'
                          }`}>
                          {h.activo ? 'Suspender' : 'Activar'}
                        </button>
                        <button onClick={() => toggleRnt(h)} disabled={!h.rnt}
                          title={!h.rnt ? 'El hotel aún no registró su número de RNT' : undefined}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            h.rntVerificado
                              ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                              : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                          }`}>
                          {h.rntVerificado ? 'Quitar verificación' : 'Verificar RNT'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal reservas */}
      {verReservas && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#1A1A1A]">Reservas — {verReservas.comercio.nombre}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{reservas.length} reservas totales</p>
              </div>
              <button onClick={() => setVerReservas(null)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {cargandoReservas ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reservas.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Sin reservas registradas</p>
              ) : (
                <div className="space-y-3">
                  {reservas.map(r => (
                    <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{r.nombreHuesped ?? (r as any).cliente?.nombre}</p>
                          <p className="text-xs text-gray-500">{r.habitacionTipo?.nombre ?? '—'}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {r.fechaEntrada.split('T')[0]} → {r.fechaSalida.split('T')[0]}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado] ?? 'bg-gray-100'}`}>
                            {r.estado}
                          </span>
                          <p className="text-xs font-bold text-[#2D6A4F] mt-1">{formatearPrecio(Number(r.total))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
