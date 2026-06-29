'use client'

import { useState } from 'react'

const DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface Props {
  /** Fechas bloqueadas: array de strings 'YYYY-MM-DD' */
  fechasBloqueadas?: string[]
  fechaEntrada: string
  fechaSalida: string
  onChangeFechaEntrada: (d: string) => void
  onChangeFechaSalida: (d: string) => void
  checkInHora?: string
  checkOutHora?: string
}

function toYMD(d: Date) {
  return d.toISOString().split('T')[0]
}

function parseFecha(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function CalendarioReserva({
  fechasBloqueadas = [],
  fechaEntrada,
  fechaSalida,
  onChangeFechaEntrada,
  onChangeFechaSalida,
  checkInHora,
  checkOutHora,
}: Props) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [vistaAnio, setVistaAnio] = useState(() => {
    const d = fechaEntrada ? parseFecha(fechaEntrada) : hoy
    return d.getFullYear()
  })
  const [vistaMes, setVistaMes] = useState(() => {
    const d = fechaEntrada ? parseFecha(fechaEntrada) : hoy
    return d.getMonth()
  })
  // 'entrada' | 'salida' — qué estamos seleccionando
  const [modo, setModo] = useState<'entrada' | 'salida'>('entrada')

  function prevMes() {
    if (vistaMes === 0) { setVistaMes(11); setVistaAnio(a => a - 1) }
    else setVistaMes(m => m - 1)
  }

  function nextMes() {
    if (vistaMes === 11) { setVistaMes(0); setVistaAnio(a => a + 1) }
    else setVistaMes(m => m + 1)
  }

  // Genera los días del mes incluyendo huecos iniciales
  const primerDia = new Date(vistaAnio, vistaMes, 1).getDay()
  const diasEnMes = new Date(vistaAnio, vistaMes + 1, 0).getDate()

  const bloqueadoSet = new Set(fechasBloqueadas)

  function claseDia(ymd: string, esPasado: boolean, esBloqueado: boolean) {
    const esEntrada = ymd === fechaEntrada
    const esSalida  = ymd === fechaSalida
    const enRango   = fechaEntrada && fechaSalida && ymd > fechaEntrada && ymd < fechaSalida

    if (esPasado || esBloqueado) return 'text-gray-300 cursor-not-allowed'
    if (esEntrada) return 'bg-[#2D6A4F] text-white rounded-l-full font-bold cursor-pointer'
    if (esSalida)  return 'bg-[#2D6A4F] text-white rounded-r-full font-bold cursor-pointer'
    if (enRango)   return 'bg-[#2D6A4F]/15 text-[#1A1A1A] cursor-pointer'
    return 'hover:bg-gray-100 text-[#1A1A1A] rounded-full cursor-pointer'
  }

  function seleccionarDia(ymd: string) {
    const d = parseFecha(ymd)
    if (d < hoy) return
    if (bloqueadoSet.has(ymd)) return

    if (modo === 'entrada') {
      onChangeFechaEntrada(ymd)
      // Si la salida ya existe y es antes de la nueva entrada, resetear salida
      if (fechaSalida && ymd >= fechaSalida) {
        const sig = new Date(d.getTime() + 86400000)
        onChangeFechaSalida(toYMD(sig))
      }
      setModo('salida')
    } else {
      if (ymd <= fechaEntrada) {
        // Intercambiar: la fecha seleccionada pasa a ser la nueva entrada
        onChangeFechaEntrada(ymd)
        setModo('salida')
      } else {
        onChangeFechaSalida(ymd)
        setModo('entrada')
      }
    }
  }

  const celdas: (string | null)[] = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => {
      const d = i + 1
      return `${vistaAnio}-${String(vistaMes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }),
  ]

  return (
    <div className="select-none">
      {/* Selector entrada/salida */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => setModo('entrada')}
          className={`p-2 rounded-xl border text-left transition-colors ${
            modo === 'entrada' ? 'border-[#2D6A4F] bg-[#2D6A4F]/5' : 'border-gray-200'
          }`}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Check-in</p>
          <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">
            {fechaEntrada ? parseFecha(fechaEntrada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'}
          </p>
          {checkInHora && <p className="text-[10px] text-gray-400">Desde las {checkInHora}</p>}
        </button>
        <button onClick={() => setModo('salida')}
          className={`p-2 rounded-xl border text-left transition-colors ${
            modo === 'salida' ? 'border-[#2D6A4F] bg-[#2D6A4F]/5' : 'border-gray-200'
          }`}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Check-out</p>
          <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">
            {fechaSalida ? parseFecha(fechaSalida).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'}
          </p>
          {checkOutHora && <p className="text-[10px] text-gray-400">Hasta las {checkOutHora}</p>}
        </button>
      </div>

      {/* Indicador de qué estamos seleccionando */}
      <p className="text-xs text-center text-[#2D6A4F] font-medium mb-3">
        {modo === 'entrada' ? '👆 Selecciona la fecha de llegada' : '👆 Selecciona la fecha de salida'}
      </p>

      {/* Navegación mes */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMes}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-sm font-semibold text-[#1A1A1A]">{MESES[vistaMes]} {vistaAnio}</span>
        <button onClick={nextMes}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7">
        {celdas.map((ymd, i) => {
          if (!ymd) return <div key={`empty-${i}`} />
          const esPasado = parseFecha(ymd) < hoy
          const esBloqueado = bloqueadoSet.has(ymd)
          const esEntrada = ymd === fechaEntrada
          const esSalida  = ymd === fechaSalida
          const enRango   = fechaEntrada && fechaSalida && ymd > fechaEntrada && ymd < fechaSalida

          return (
            <div key={ymd} className="flex items-center justify-center p-0.5">
              <button
                onClick={() => seleccionarDia(ymd)}
                disabled={esPasado || esBloqueado}
                title={esBloqueado ? 'No disponible' : undefined}
                className={`w-8 h-8 text-xs flex items-center justify-center transition-colors relative
                  ${esPasado || esBloqueado ? 'text-gray-300 cursor-not-allowed' : ''}
                  ${(esEntrada || esSalida) ? 'bg-[#2D6A4F] text-white rounded-full font-bold' : ''}
                  ${enRango && !esEntrada && !esSalida ? 'bg-[#2D6A4F]/15 rounded-none' : ''}
                  ${!esPasado && !esBloqueado && !esEntrada && !esSalida && !enRango ? 'hover:bg-gray-100 rounded-full' : ''}
                `}>
                {Number(ymd.split('-')[2])}
                {esBloqueado && !esPasado && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full" />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-3 justify-center text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#2D6A4F] rounded-full inline-block" /> Seleccionado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#2D6A4F]/15 rounded inline-block" /> En rango</span>
        <span className="flex items-center gap-1"><span className="w-1 h-1 bg-red-400 rounded-full inline-block" /> No disponible</span>
      </div>
    </div>
  )
}
