'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNotificaciones } from '@/context/NotificacionContext'
import type { Notificacion } from '@/context/NotificacionContext'

const ICONOS: Record<string, string> = {
  PEDIDO_CREADO: '🛒',
  PAGO_CONFIRMADO: '✅',
  PEDIDO_LISTO: '📦',
  PEDIDO_ENTREGADO: '🎉',
  NUEVO_PEDIDO: '🛍️',
  NUEVA_OFERTA: '🏷️',
}

function tiempoRelativo(fecha: string) {
  const diff = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function CampanaNotificaciones() {
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotificaciones()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [abierto])

  function handleAbrir() {
    setAbierto((v) => !v)
  }

  function handleClickNotif(n: Notificacion) {
    if (!n.leida) marcarLeida(n.id)
    setAbierto(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleAbrir}
        aria-label="Notificaciones"
        className="relative flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#2D6A4F]/10"
      >
        <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#D4A017] text-[#1A1A1A] text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] z-50 overflow-hidden">
          {/* Encabezado */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A]/8">
            <span className="font-semibold text-sm text-[#1A1A1A]">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodasLeidas}
                className="text-xs text-[#2D6A4F] hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <ul className="max-h-80 overflow-y-auto divide-y divide-[#1A1A1A]/5">
            {notificaciones.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[#1A1A1A]/40">
                Sin notificaciones aún
              </li>
            )}
            {notificaciones.map((n) => {
              const icono = ICONOS[n.tipo] ?? '🔔'
              const Wrapper = n.url ? Link : 'div'
              return (
                <li key={n.id}>
                  <Wrapper
                    href={n.url ?? '#'}
                    onClick={() => handleClickNotif(n)}
                    className={`flex gap-3 px-4 py-3 hover:bg-[#F8F5F0] cursor-pointer transition-colors ${
                      !n.leida ? 'bg-[#2D6A4F]/5' : ''
                    }`}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{icono}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.leida ? 'font-semibold text-[#1A1A1A]' : 'text-[#1A1A1A]/80'}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-[#1A1A1A]/50 mt-0.5 line-clamp-2">{n.mensaje}</p>
                    </div>
                    <span className="text-xs text-[#1A1A1A]/35 shrink-0 mt-0.5">
                      {tiempoRelativo(n.createdAt)}
                    </span>
                  </Wrapper>
                </li>
              )
            })}
          </ul>

          {/* Pie: ver todas */}
          <div className="border-t border-[#1A1A1A]/8">
            <Link
              href="/notificaciones"
              onClick={() => setAbierto(false)}
              className="block w-full px-4 py-3 text-center text-xs font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors"
            >
              Ver todas las notificaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
