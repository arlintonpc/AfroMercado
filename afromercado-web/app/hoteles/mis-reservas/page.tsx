'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { misReservasHotel, cancelarReservaHotel, consultarPoliticaCancelacion, solicitarTokenCheckin, type ReservaHotel, type PoliticaCancelacionInfo } from '@/lib/api/hotel'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useAuth } from '@/context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast, useToast } from '@/components/ui/Toast'

const ESTADO_INFO: Record<string, { label: string; color: string; paso: number }> = {
  PENDIENTE:  { label: 'â³ Esperando confirmaciÃ³n', color: 'bg-amber-100 text-amber-700',  paso: 0 },
  CONFIRMADA: { label: 'âœ… Confirmada',              color: 'bg-blue-100 text-blue-700',   paso: 1 },
  CHECKIN:    { label: 'ðŸ¨ En estadÃ­a',              color: 'bg-green-100 text-green-700', paso: 2 },
  CHECKOUT:   { label: 'ðŸ‘‹ Check-out realizado',     color: 'bg-green-100 text-green-700', paso: 3 },
  CANCELADA:  { label: 'âŒ Cancelada',               color: 'bg-red-100 text-red-600',     paso: -1 },
  RECHAZADA:  { label: 'ðŸš« Rechazada',               color: 'bg-red-100 text-red-600',     paso: -1 },
}

const PASOS = ['Solicitada', 'Confirmada', 'Check-in', 'Check-out']

function BarraProgreso({ paso }: { paso: number }) {
  if (paso < 0) return null
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1">
        {PASOS.map((p, i) => (
          <div key={p} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
            <div className={`w-4 h-4 rounded-full border-2 transition-all ${i <= paso ? 'bg-[#2D6A4F] border-[#2D6A4F]' : 'bg-white border-gray-300'}`} />
            <span className={`text-[9px] text-center leading-tight ${i <= paso ? 'text-[#2D6A4F] font-medium' : 'text-gray-400'}`}>{p}</span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-gray-200 rounded-full mt-0.5">
        <div className="absolute h-1 bg-[#2D6A4F] rounded-full transition-all duration-700" style={{ width: `${(paso / (PASOS.length - 1)) * 100}%` }} />
      </div>
    </div>
  )
}

function TarjetaReserva({ reserva, onCancelado }: { reserva: ReservaHotel; onCancelado: () => void }) {
  const router = useRouter()
  const info = ESTADO_INFO[reserva.estado] ?? { label: reserva.estado, color: 'bg-gray-100 text-gray-600', paso: -1 }
  const activa = !['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(reserva.estado)
  const [cancelando, setCancelando]   = useState(false)
  const [politica, setPolitica]       = useState<PoliticaCancelacionInfo | null>(null)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [cargandoPolitica, setCargandoPolitica] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [generandoToken, setGenerandoToken] = useState(false)

  const puedeCheckin = reserva.estado === 'CONFIRMADA' && !reserva.checkinOnlineAt
  const diasParaEntrada = Math.ceil((new Date(reserva.fechaEntrada).getTime() - Date.now()) / 86400000)
  const mostrarCheckin = puedeCheckin && diasParaEntrada <= 7

  async function iniciarCheckin() {
    setGenerandoToken(true)
    try {
      const { token } = await solicitarTokenCheckin(reserva.id)
      router.push(`/hoteles/checkin/${token}`)
    } catch { /* error silencioso */ }
    setGenerandoToken(false)
  }

  const copiarCodigo = useCallback(() => {
    navigator.clipboard.writeText(reserva.codigo).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }).catch(() => {})
  }, [reserva.codigo])

  const entrada = new Date(reserva.fechaEntrada)
  const salida  = new Date(reserva.fechaSalida)
  const noches  = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000)

  const fmtFecha = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

  async function abrirModalCancelar() {
    setModalCancelar(true)
    setCargandoPolitica(true)
    try { setPolitica(await consultarPoliticaCancelacion(reserva.id)) } catch { setPolitica(null) }
    setCargandoPolitica(false)
  }

  async function confirmarCancelacion() {
    setCancelando(true)
    try { await cancelarReservaHotel(reserva.id); setModalCancelar(false); onCancelado() } catch {}
    setCancelando(false)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${activa ? 'border-[#2D6A4F]' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-[#1A1A1A] truncate">{reserva.configHotel?.comercio.nombre ?? 'Hotel'}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-mono text-xs bg-gray-900 text-white px-2 py-0.5 rounded-md tracking-wider">
              {reserva.codigo}
            </span>
            <button
              onClick={copiarCodigo}
              title="Copiar cÃ³digo"
              className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
              {copiado
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              }
            </button>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${info.color}`}>{info.label}</span>
      </div>

      {activa && <BarraProgreso paso={info.paso} />}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-gray-400 mb-0.5">Check-in</p>
          <p className="font-medium">{fmtFecha(entrada)}</p>
          <p className="text-gray-400">{reserva.configHotel?.checkInHora}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-gray-400 mb-0.5">Check-out</p>
          <p className="font-medium">{fmtFecha(salida)}</p>
          <p className="text-gray-400">{reserva.configHotel?.checkOutHora}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p className="text-gray-600">ðŸ›ï¸ {reserva.habitacionTipo?.nombre} Â· {noches} noche{noches !== 1 ? 's' : ''}</p>
        <p className="text-gray-600">ðŸ‘¤ {reserva.huespedes} huÃ©sped{reserva.huespedes !== 1 ? 'es' : ''}</p>
      </div>

      {/* Info penalizaciÃ³n/reembolso para canceladas */}
      {reserva.estado === 'CANCELADA' && (reserva.montoPenalidad != null || reserva.montoReembolso != null) && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs space-y-0.5">
          {reserva.montoPenalidad != null && reserva.montoPenalidad > 0 && (
            <p className="text-red-600 font-medium">PenalizaciÃ³n: <span className="font-bold">{formatearPrecio(Number(reserva.montoPenalidad))}</span></p>
          )}
          {reserva.montoReembolso != null && (
            <p className="text-gray-600">Reembolso: <span className="font-bold text-gray-800">{formatearPrecio(Number(reserva.montoReembolso))}</span></p>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">{reserva.metodoPago}</span>
        <div className="text-right">
          {reserva.codigoCupon && (
            <p className="text-xs text-emerald-600 font-medium">CupÃ³n: {reserva.codigoCupon}</p>
          )}
          {reserva.montoDescuento != null && reserva.montoDescuento > 0 && (
            <p className="text-xs text-emerald-600">Ahorraste {formatearPrecio(Number(reserva.montoDescuento))}</p>
          )}
          <span className="font-bold text-[#1A1A1A]">{formatearPrecio(Number(reserva.total))}</span>
        </div>
      </div>

      {['PENDIENTE', 'CONFIRMADA'].includes(reserva.estado) && (
        <button onClick={abrirModalCancelar}
          className="mt-3 w-full text-center text-xs font-medium text-red-500 border border-red-200 rounded-xl py-2 hover:bg-red-50 transition-colors">
          Cancelar reserva
        </button>
      )}

      {mostrarCheckin && (
        <button onClick={iniciarCheckin} disabled={generandoToken}
          className="mt-3 w-full py-2 text-sm font-medium bg-[#1B4332] text-white rounded-xl disabled:opacity-50 hover:bg-[#2D6A4F] transition-colors">
          {generandoToken ? 'Preparando...' : 'âœ“ Hacer check-in online'}
        </button>
      )}
      {reserva.checkinOnlineAt && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">
          <span>âœ“</span>
          <span>Check-in realizado Â· {new Date(reserva.checkinOnlineAt).toLocaleDateString('es-CO')}</span>
        </div>
      )}

      {/* Modal confirmaciÃ³n cancelaciÃ³n */}
      {modalCancelar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalCancelar(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 mb-1">Â¿Cancelar reserva?</h3>
            <p className="text-xs text-gray-500 mb-4">CÃ³digo: <span className="font-mono font-semibold">{reserva.codigo}</span></p>

            {cargandoPolitica ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : politica ? (
              <div className={`rounded-xl p-4 mb-4 ${politica.dentroPlazoGratuito ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                {politica.dentroPlazoGratuito ? (
                  <>
                    <p className="font-bold text-emerald-700 text-sm">âœ“ CancelaciÃ³n gratuita</p>
                    <p className="text-xs text-emerald-600 mt-1">Recibes reembolso completo de <strong>{formatearPrecio(politica.montoReembolso)}</strong></p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-amber-700 text-sm">âš ï¸ CancelaciÃ³n con penalizaciÃ³n</p>
                    <p className="text-xs text-amber-600 mt-1">Faltan menos de {politica.horasRestantes < 1 ? 'una hora' : `${Math.round(politica.horasRestantes)}h`} para tu check-in.</p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600"><span>Total pagado</span><span>{formatearPrecio(Number(reserva.total))}</span></div>
                      <div className="flex justify-between text-red-600 font-medium"><span>PenalizaciÃ³n ({politica.penalizacionPct}%)</span><span>âˆ’ {formatearPrecio(politica.montoPenalidad)}</span></div>
                      <div className="flex justify-between text-gray-900 font-bold border-t border-amber-200 pt-1"><span>Te devolvemos</span><span>{formatearPrecio(politica.montoReembolso)}</span></div>
                    </div>
                    {politica.montoReembolso === 0 && <p className="text-xs text-red-600 font-semibold mt-2">Sin reembolso â€” ya no hay tiempo de reasignar la habitaciÃ³n.</p>}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 text-xs text-gray-500 text-center">No se pudo consultar la polÃ­tica. Puedes cancelar igual.</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModalCancelar(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Volver
              </button>
              <button onClick={confirmarCancelacion} disabled={cancelando}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                {cancelando ? 'Cancelandoâ€¦' : 'SÃ­, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReservasLoading() {
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/hoteles" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A] text-lg">Mis reservas</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-4 bg-gray-200 rounded w-2/5" />
              <div className="h-5 bg-gray-100 rounded w-28" />
            </div>
            <div className="flex gap-2">
              {[0,1,2,3].map(j => (
                <div key={j} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-4 h-4 rounded-full bg-gray-200" />
                  <div className="h-2 bg-gray-100 rounded w-8" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-gray-100 rounded-xl" />
              <div className="h-12 bg-gray-100 rounded-xl" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </main>
    </div>
  )
}

function MisReservasHotelContent() {
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pagoOk = searchParams.get('pago') === 'ok'
  const { mostrar: mostrarToast, toastProps } = useToast()
  const [reservas, setReservas] = useState<ReservaHotel[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (pagoOk) mostrarToast('Â¡Pago recibido! Tu reserva estÃ¡ siendo confirmada.')
  }, [pagoOk])

  async function cargar() {
    const data = await misReservasHotel()
    setReservas(data)
    setCargando(false)
  }

  useEffect(() => {
    if (cargandoAuth) return
    if (!autenticado) { router.push('/ingresar'); return }
    cargar()
  }, [autenticado, cargandoAuth])

  const activas   = reservas.filter(r => !['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(r.estado))
  const anteriores = reservas.filter(r => ['CHECKOUT', 'CANCELADA', 'RECHAZADA'].includes(r.estado))

  if (cargando) return <ReservasLoading />

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Toast {...toastProps} />
      <header className="bg-white border-b border-[#E8DCC8] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/hoteles" className="text-[#2D6A4F] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 className="font-bold text-[#1A1A1A] text-lg">Mis reservas</h1>
          {activas.length > 0 && (
            <span className="ml-auto bg-[#2D6A4F] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {activas.length} activa{activas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {reservas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">ðŸ¨</p>
            <p className="font-medium">AÃºn no tienes reservas</p>
            <Link href="/hoteles" className="mt-4 inline-block text-[#2D6A4F] underline text-sm">Ver hoteles</Link>
          </div>
        ) : (
          <>
            {activas.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Activas</h2>
                <div className="space-y-3">{activas.map(r => <TarjetaReserva key={r.id} reserva={r} onCancelado={cargar} />)}</div>
              </section>
            )}
            {anteriores.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Anteriores</h2>
                <div className="space-y-3">{anteriores.map(r => <TarjetaReserva key={r.id} reserva={r} onCancelado={cargar} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function MisReservasHotelPage() {
  return (
    <Suspense fallback={<ReservasLoading />}>
      <MisReservasHotelContent />
    </Suspense>
  )
}

