'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { obtenerMiComercio } from '@/components/comerciante/api'

/** Loader a pantalla completa mientras validamos la sesión. */
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

export default function ComercianteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { usuario, cargando, logout } = useAuth()

  const esRutaIngresar = pathname === '/comerciante/ingresar'
  const esComerciante = usuario?.rol === 'COMERCIANTE'

  const [nombreComercio, setNombreComercio] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Protección de ruta: sin sesión de comerciante → a ingresar.
  useEffect(() => {
    if (cargando || esRutaIngresar) return
    if (!esComerciante) {
      router.replace('/comerciante/ingresar')
    }
  }, [cargando, esRutaIngresar, esComerciante, router])

  // Cargar el nombre del comercio para la barra superior.
  useEffect(() => {
    if (cargando || esRutaIngresar || !esComerciante) return
    let activo = true
    obtenerMiComercio()
      .then((c) => {
        if (activo) setNombreComercio(c?.nombre ?? null)
      })
      .catch(() => {
        /* silencioso: la barra muestra solo "Vendedor" */
      })
    return () => {
      activo = false
    }
  }, [cargando, esRutaIngresar, esComerciante])

  // La pantalla de ingreso usa su propio diseño, sin protección ni chrome.
  if (esRutaIngresar) {
    return <>{children}</>
  }

  if (cargando) return <PantallaCargando texto="Cargando tu tienda…" />
  if (!esComerciante) return <PantallaCargando texto="Llevándote al ingreso…" />

  function manejarLogout() {
    logout()
    router.replace('/comerciante/ingresar')
  }

  const enlaces = [
    { href: '/comerciante/dashboard', etiqueta: 'Inicio' },
    { href: '/comerciante/pedidos', etiqueta: 'Pedidos' },
    { href: '/comerciante/analytics', etiqueta: 'Analíticas' },
    { href: '/comerciante/publicar', etiqueta: 'Publicar producto' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0] text-[#1A1A1A]">
      {/* Barra superior propia del vendedor */}
      <header className="sticky top-0 z-30 bg-[#2D6A4F] text-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="text-xl leading-none"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              AfroMercado
            </span>
            <span className="hidden text-sm text-white/70 sm:inline">· Vendedor</span>
          </div>

          {/* Navegación en pantallas grandes */}
          <nav className="hidden items-center gap-1 md:flex">
            {enlaces.map((e) => {
              const activo = pathname === e.href
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className={`rounded-lg px-3 py-2 text-base font-semibold transition-colors ${
                    activo ? 'bg-white/15' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {e.etiqueta}
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

          {/* Botón de menú en móvil */}
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
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setMenuAbierto(false)}
                className="block rounded-lg px-3 py-3 text-base font-semibold text-white/90 hover:bg-white/10"
              >
                {e.etiqueta}
              </Link>
            ))}
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

      {/* Sub-barra con el nombre del comercio */}
      {nombreComercio && (
        <div className="border-b border-[#1A1A1A]/8 bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-2">
            <p className="truncate text-sm text-[#1A1A1A]/60">
              Tu tienda:{' '}
              <span className="font-semibold text-[#2D6A4F]">{nombreComercio}</span>
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
