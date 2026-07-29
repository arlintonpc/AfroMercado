'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { misReservasTransporte, cancelarReservaTransporte, obtenerTicketTransporte, listarSalidasTransporte, listarAsientosSalidaTransporte, reprogramarReservaTransporte, type ReservaTransporte, type SalidaTransporte } from '@/lib/api/transporte'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import ModalReportarProblema from '@/components/disputas/ModalReportarProblema'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: '⏳ Pendiente',   color: 'bg-amber-100 text-amber-700' },
  CONFIRMADA: { label: '✅ Confirmada',  color: 'bg-green-100 text-green-700' },
  COMPLETADA: { label: '✈️ Completada',  color: 'bg-blue-100 text-blue-700'  },
  CANCELADA:  { label: '❌ Cancelada',   color: 'bg-red-100 text-red-600'    },
  RECHAZADA:  { label: '🚫 Rechazada',   color: 'bg-red-100 text-red-600'    },
}

function ModalReprogramar({ reserva, onCerrar, onExito }: { reserva: ReservaTransporte; onCerrar: () => void; onExito: (reserva: ReservaTransporte) => void }) {
  const [salidas, setSalidas] = useState<SalidaTransporte[]>([])
  const [salidaId, setSalidaId] = useState<number | null>(null)
  const [ocupados, setOcupados] = useState<string[]>([])
  const [capacidad, setCapacidad] = useState(0)
  const [puestos, setPuestos] = useState<string[]>([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const fecha = reserva.fechaViaje.slice(0, 10)

  useEffect(() => { if (reserva.ruta) listarSalidasTransporte(reserva.ruta.id, fecha).then(setSalidas).catch(() => setError('No fue posible cargar salidas')) }, [reserva.ruta, fecha])
  useEffect(() => { if (!salidaId) return; listarAsientosSalidaTransporte(salidaId).then(data => { setCapacidad(data.capacidad); setOcupados(data.ocupados); setPuestos([]) }).catch(() => setError('No fue posible cargar puestos')) }, [salidaId])
  async function confirmar() {
    if (!salidaId || puestos.length !== reserva.asientos) { setError('Selecciona una salida y todos los nuevos asientos'); return }
    setGuardando(true); setError('')
    try { onExito(await reprogramarReservaTransporte(reserva.id, salidaId, puestos)) } catch (e: any) { setError(e.message) } finally { setGuardando(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onCerrar}><div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={e => e.stopPropagation()}><div className="flex justify-between"><div><p className="text-xs font-semibold text-[#2D6A4F]">Reprogramar viaje</p><h2 className="font-bold">{reserva.ruta?.origen} - {reserva.ruta?.destino}</h2></div><button onClick={onCerrar}>x</button></div><select className="mt-4 w-full rounded-xl border p-3 text-sm" value={salidaId ?? ''} onChange={e => setSalidaId(Number(e.target.value))}><option value="">Elige una salida</option>{salidas.map(s => <option key={s.id} value={s.id}>{new Date(s.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</option>)}</select>{salidaId && <div className="mt-4"><p className="mb-2 text-xs font-semibold">Elige {reserva.asientos} asiento(s)</p><div className="grid grid-cols-4 gap-2">{Array.from({ length: capacidad }, (_, i) => String(i + 1)).map(p => <button key={p} disabled={ocupados.includes(p)} onClick={() => setPuestos(prev => prev.includes(p) ? prev.filter(x => x !== p) : prev.length < reserva.asientos ? [...prev, p] : prev)} className={`h-10 rounded-lg text-sm font-bold ${ocupados.includes(p) ? 'bg-gray-200 text-gray-400' : puestos.includes(p) ? 'bg-[#1B4332] text-white' : 'border'}`}>{p}</button>)}</div></div>}{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button onClick={confirmar} disabled={guardando} className="mt-5 w-full rounded-xl bg-[#1B4332] py-3 font-bold text-white disabled:opacity-50">{guardando ? 'Reprogramando...' : 'Confirmar cambio'}</button></div></div>
}

export default function MisReservasTransportePage() {
  const { usuario } = useAuth()
  const [reservas, setReservas] = useState<ReservaTransporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [reservaACancelar, setReservaACancelar] = useState<number | null>(null)
  const [ticket, setTicket] = useState<{ reserva: ReservaTransporte; qrDataUrl: string } | null>(null)
  const [cargandoTicket, setCargandoTicket] = useState<number | null>(null)
  const [reservaAReprogramar, setReservaAReprogramar] = useState<ReservaTransporte | null>(null)

  useEffect(() => {
    if (!usuario) return
    misReservasTransporte().then(d => { setReservas(d); setCargando(false) })
  }, [usuario])

  function cancelar(id: number) {
    setReservaACancelar(id)
  }

  async function verTicket(id: number) {
    setCargandoTicket(id)
    try { setTicket(await obtenerTicketTransporte(id)) }
    catch (e: any) { alert(e.message) }
    finally { setCargandoTicket(null) }
  }

  async function confirmarCancelar() {
    if (reservaACancelar == null) return
    const id = reservaACancelar
    setCancelando(id)
    try {
      await cancelarReservaTransporte(id)
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'CANCELADA' } : r))
    } catch (e: any) { alert(e.message) }
    finally {
      setCancelando(null)
      setReservaACancelar(null)
    }
  }

  const activas = reservas.filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado))
  const anteriores = reservas.filter(r => !['PENDIENTE', 'CONFIRMADA'].includes(r.estado))

  function TarjetaReserva({ r }: { r: ReservaTransporte }) {
    const ei = ESTADO_INFO[r.estado]
    const ruta = r.ruta
    const cfg = ruta?.configTransporte
    const [modalReportar, setModalReportar] = useState(false)
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-[#1A1A1A]">{cfg?.nombre ?? 'Transporte'}</p>
            <p className="text-sm text-gray-600">{ruta?.origen} → {ruta?.destino}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              📅 {new Date(r.fechaViaje).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              {ruta?.horario ? ` · 🕐 ${ruta.horario}` : ''}
            </p>
          </div>
          {ei && <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ei.color}`}>{ei.label}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Asientos</p>
            <p className="text-sm font-bold">{r.asientos}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xs font-bold text-[#023E8A]">{formatearPrecio(Number(r.total))}</p>
          </div>
        </div>

        {r.salida && (
          <div className="mt-3 rounded-xl bg-[#F0F7F3] px-3 py-2 text-xs text-[#1B4332]">
            <p className="font-semibold">Estado: {(r.salida.estadoOperacion ?? 'PROGRAMADA').replace('_', ' ').toLowerCase()}</p>
            {r.salida.vehiculo?.nombre && <p className="mt-1">Vehículo: {r.salida.vehiculo.nombre}</p>}
            {r.salida.conductorNombre && <p className="mt-1">Conductor: {r.salida.conductorNombre}</p>}
          </div>
        )}
        {cfg?.politicaCancelacion && <p className="mt-3 text-xs leading-4 text-gray-500">Cambios y cancelación: {cfg.politicaCancelacion}</p>}

        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="text-[10px] text-gray-400 font-mono">{r.codigo}</span>
          {r.salidaTransporteId && ['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && <button onClick={() => setReservaAReprogramar(r)} className="text-xs font-semibold text-[#2D6A4F] hover:underline">Reprogramar</button>}
          {['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && (
            <button onClick={() => verTicket(r.id)} disabled={cargandoTicket === r.id}
              className="text-xs font-semibold text-[#023E8A] hover:underline disabled:opacity-50">
              {cargandoTicket === r.id ? 'Generando...' : 'Ver pase QR'}
            </button>
          )}
          {['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && (
            <button onClick={() => cancelar(r.id)} disabled={cancelando === r.id}
              className="text-xs text-red-500 hover:underline disabled:opacity-50">
              {cancelando === r.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          )}
          {r.estado === 'COMPLETADA' && (
            <button onClick={() => setModalReportar(true)}
              className="text-xs text-[#C0392B] hover:underline">
              Reportar un problema
            </button>
          )}
        </div>

        {modalReportar && (
          <ModalReportarProblema
            moduloOrigen="TRANSPORTE"
            referenciaId={r.id}
            onCerrar={() => setModalReportar(false)}
            onExito={() => setModalReportar(false)}
          />
        )}
      </div>
    )
  }

  if (!usuario) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-4xl mb-3">🛥️</p>
        <Link href="/ingresar" className="text-sm text-[#023E8A] underline">Ingresar para ver reservas</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/transportes" className="text-[#023E8A] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A]">Mis viajes reservados</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="ml-auto h-5 bg-gray-100 rounded w-20" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 bg-gray-100 rounded-xl" />
                  <div className="h-12 bg-gray-100 rounded-xl" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : reservas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🛥️</p>
            <p>Sin reservas de transporte</p>
            <Link href="/transportes" className="text-sm text-[#023E8A] underline mt-2 block">Ver servicios</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {activas.length > 0 && <div><h2 className="text-sm font-semibold mb-3">Activas ({activas.length})</h2><div className="space-y-3">{activas.map(r => <TarjetaReserva key={r.id} r={r} />)}</div></div>}
            {anteriores.length > 0 && <div><h2 className="text-sm font-semibold text-gray-400 mb-3">Historial</h2><div className="space-y-3">{anteriores.map(r => <TarjetaReserva key={r.id} r={r} />)}</div></div>}
          </div>
        )}
      </main>

      {reservaACancelar != null && (
        <ModalConfirmacion
          titulo="Cancelar reserva"
          mensaje="¿Cancelar esta reserva?"
          onCancelar={() => setReservaACancelar(null)}
          onConfirmar={() => void confirmarCancelar()}
          confirmando={cancelando === reservaACancelar}
        />
      )}
      {ticket && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center" onClick={() => setTicket(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 text-left">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[#2D6A4F]">Pase de viaje</p><h2 className="mt-1 text-lg font-bold text-[#1A1A1A]">{ticket.reserva.ruta?.origen} - {ticket.reserva.ruta?.destino}</h2></div>
              <button className="text-xl text-gray-400" onClick={() => setTicket(null)} aria-label="Cerrar">x</button>
            </div>
            <img className="mx-auto my-5 h-52 w-52 rounded-xl border border-gray-100 p-2" src={ticket.qrDataUrl} alt={`QR de la reserva ${ticket.reserva.codigo}`} />
            <p className="font-mono text-sm font-bold text-[#023E8A]">{ticket.reserva.codigo}</p>
            <p className="mt-3 text-xs leading-5 text-gray-500">Muestralo al operador al abordar. El codigo se verifica contra el manifiesto de la salida.</p>
          </div>
        </div>
      )}
      {reservaAReprogramar && <ModalReprogramar reserva={reservaAReprogramar} onCerrar={() => setReservaAReprogramar(null)} onExito={actualizada => { setReservas(prev => prev.map(r => r.id === actualizada.id ? { ...r, ...actualizada } : r)); setReservaAReprogramar(null) }} />}
    </div>
  )
}
