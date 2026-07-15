'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionContext'

function PantallaCargando({ texto = 'Un momento…' }: { texto?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F5F0]">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin text-[#2D6A4F]"
          width="36"
          height="36"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-base text-[#1A1A1A]/55">{texto}</p>
      </div>
    </div>
  )
}

export default function RepartidorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { usuario, cargando, logout } = useAuth()
  const { noLeidas } = useNotificaciones()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const esRepartidor = usuario?.rol === 'REPARTIDOR'

  useEffect(() => {
    if (cargando) return
    if (!esRepartidor) {
      router.replace('/')
    }
  }, [cargando, esRepartidor, router])

  if (cargando) return <PantallaCargando texto="Cargando panel…" />
  if (!esRepartidor) return <PantallaCargando texto="Redirigiendo…" />

  function manejarLogout() {
    logout()
    router.replace('/')
  }

  const enlaces = [
    { href: '/repartidor', etiqueta: 'Panel' },
    { href: '/notificaciones', etiqueta: 'Notificaciones' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0] text-[#1A1A1A]">
      <header className="sticky top-0 z-30 bg-[#2D6A4F] text-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
          {/* Logo / nombre */}
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="text-xl leading-none"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Teravia
            </span>
            <span className="hidden text-sm text-white/70 sm:inline">· Repartidor</span>
          </div>

          {/* Navegación desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            {enlaces.map((e) => {
              const activo = pathname === e.href
              const esNotif = e.href === '/notificaciones'
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className={`relative rounded-lg px-3 py-2 text-base font-semibold transition-colors ${
                    activo ? 'bg-white/15' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {e.etiqueta}
                  {esNotif && noLeidas > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D4A017] px-1 text-[10px] font-bold text-[#1A1A1A]">
                      {noLeidas > 9 ? '9+' : noLeidas}
                    </span>
                  )}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={manejarLogout}
              className="ml-1 rounded-lg px-3 py-2 text-base font-semibold text-white/80 hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </nav>

          {/* Botón hamburguesa móvil */}
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            aria-label="Menú"
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 md:hidden"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuAbierto ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Menú desplegable móvil */}
        {menuAbierto && (
          <nav className="border-t border-white/15 bg-[#2D6A4F] px-4 py-2 md:hidden">
            {enlaces.map((e) => {
              const esNotif = e.href === '/notificaciones'
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  onClick={() => setMenuAbierto(false)}
                  className="relative block rounded-lg px-3 py-3 text-base font-semibold text-white/90 hover:bg-white/10"
                >
                  {e.etiqueta}
                  {esNotif && noLeidas > 0 && (
                    <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D4A017] px-1 text-[10px] font-bold text-[#1A1A1A]">
                      {noLeidas > 9 ? '9+' : noLeidas}
                    </span>
                  )}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false)
                manejarLogout()
              }}
              className="block w-full rounded-lg px-3 py-3 text-left text-base font-semibold text-white/90 hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
