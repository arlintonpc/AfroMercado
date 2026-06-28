'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionContext'
import { obtenerMiComercio, type Comercio } from '@/components/comerciante/api'

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

/** Pantalla de bloqueo para comercios SUSPENDIDOS. */
function PantallaSuspendido({
  motivo,
  onLogout,
}: {
  motivo: string | null | undefined
  onLogout: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F5F0] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#7B241C]/20 bg-white p-8 text-center shadow-sm">
        {/* Icono */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7B241C]/10 text-[#7B241C]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M10.3 4.5 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.5a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </div>

        <h1
          className="mt-5 text-2xl text-[#1A1A1A]"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Tu tienda ha sido suspendida
        </h1>

        {motivo ? (
          <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/60">
            <span className="font-semibold text-[#7B241C]">Motivo:</span> {motivo}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/60">
            Por favor contacta al equipo de AfroMercado para resolver la situación.
          </p>
        )}

        <p className="mt-2 text-sm text-[#1A1A1A]/50">
          Puedes actualizar tu información de perfil o escribirnos para aclarar el caso.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/comerciante/perfil"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D6A4F]/30 bg-[#52B788]/8 px-5 py-3 text-sm font-semibold text-[#2D6A4F] transition-colors hover:bg-[#52B788]/15"
          >
            Actualizar mi perfil
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1A1A1A]/10 bg-white px-5 py-3 text-sm font-semibold text-[#1A1A1A]/60 transition-colors hover:border-[#1A1A1A]/20 hover:text-[#1A1A1A]"
          >
            Cerrar sesión
          </button>
        </div>
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
  // /comerciante/perfil sigue accesible aunque el comercio esté suspendido.
  const esRutaPerfil = pathname === '/comerciante/perfil' || pathname.startsWith('/comerciante/perfil/')
  const esComerciante = usuario?.rol === 'COMERCIANTE'

  const { noLeidas } = useNotificaciones()
  const [nombreComercio, setNombreComercio] = useState<string | null>(null)
  const [comercio, setComercio] = useState<Comercio | null | undefined>(undefined)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)

  // Protección de ruta: sin sesión de comerciante → a ingresar.
  useEffect(() => {
    if (cargando || esRutaIngresar) return
    if (!esComerciante) {
      router.replace('/comerciante/ingresar')
    }
  }, [cargando, esRutaIngresar, esComerciante, router])

  // Cargar el comercio para la barra superior y la protección por estado.
  useEffect(() => {
    if (cargando || esRutaIngresar || !esComerciante) return
    let activo = true
    obtenerMiComercio()
      .then((c) => {
        if (!activo) return
        setComercio(c)
        setNombreComercio(c?.nombre ?? null)
      })
      .catch(() => {
        if (activo) setComercio(null)
        /* silencioso: la barra muestra solo "Vendedor" */
      })
    return () => {
      activo = false
    }
  }, [cargando, esRutaIngresar, esComerciante])

  // La pantalla de ingreso usa su propio diseño, sin protección ni chrome.
  useEffect(() => {
    setMenuAbierto(false)
    setMasAbierto(false)
  }, [pathname])

  if (esRutaIngresar) {
    return <>{children}</>
  }

  if (cargando) return <PantallaCargando texto="Cargando tu tienda…" />
  if (!esComerciante) return <PantallaCargando texto="Llevándote al ingreso…" />

  // Bloqueo por suspensión: mientras el comercio aún se está cargando (undefined)
  // mostramos el loader para no mostrar el chrome completo por un instante.
  // null significa que el fetch terminó pero no hay comercio (redirige el dashboard).
  // Solo bloqueamos si está SUSPENDIDO Y no es la ruta de perfil.
  if (comercio === undefined) return <PantallaCargando texto="Verificando estado de tu tienda…" />

  function manejarLogout() {
    logout()
    router.replace('/comerciante/ingresar')
  }

  // Comercio suspendido: bloquear todo excepto la ruta de perfil.
  if (comercio?.estadoRegistro === 'SUSPENDIDO' && !esRutaPerfil) {
    return (
      <PantallaSuspendido
        motivo={comercio.motivoRechazo}
        onLogout={manejarLogout}
      />
    )
  }

  const enlaces = [
    { href: '/comerciante/dashboard',      etiqueta: 'Inicio' },
    { href: '/comerciante/pedidos',        etiqueta: 'Pedidos' },
    { href: '/comerciante/express',        etiqueta: '🍽️ Express' },
    { href: '/comerciante/mis-productos',  etiqueta: 'Mis productos' },
    { href: '/comerciante/publicar',       etiqueta: 'Publicar' },
    { href: '/comerciante/ofertas',        etiqueta: 'Ofertas' },
    { href: '/comerciante/cupones',        etiqueta: 'Cupones' },
    { href: '/comerciante/publicidad',     etiqueta: 'Publicidad' },
    { href: '/comerciante/analytics',      etiqueta: 'Analíticas' },
    { href: '/comerciante/liquidaciones',  etiqueta: 'Liquidaciones' },
    { href: '/comerciante/perfil',         etiqueta: 'Mi tienda' },
    { href: '/notificaciones',             etiqueta: 'Notificaciones' },
  ]
  const enlacesPrincipales = enlaces.filter((e) =>
    [
      '/comerciante/dashboard',
      '/comerciante/pedidos',
      '/comerciante/express',
      '/comerciante/mis-productos',
      '/comerciante/publicar',
      '/comerciante/perfil',
    ].includes(e.href)
  )
  const enlacesSecundarios = enlaces.filter((e) => !enlacesPrincipales.some((p) => p.href === e.href))
  const enlaceActivo = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const secundarioActivo = enlacesSecundarios.some((e) => enlaceActivo(e.href))

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0] text-[#1A1A1A]">
      {/* Barra superior propia del vendedor */}
      <header className="sticky top-0 z-30 bg-[#2D6A4F] text-white shadow-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
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
          <nav className="hidden items-center gap-1 lg:flex">
            {enlacesPrincipales.map((e) => {
              const activo = enlaceActivo(e.href)
              const esNotif = e.href === '/notificaciones'
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setMasAbierto((v) => !v)}
                className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  secundarioActivo || masAbierto ? 'bg-white/15' : 'text-white/80 hover:bg-white/10'
                }`}
                aria-expanded={masAbierto}
              >
                Más
                {noLeidas > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D4A017] px-1 text-[10px] font-bold text-[#1A1A1A]">
                    {noLeidas > 9 ? '9+' : noLeidas}
                  </span>
                )}
              </button>
              {masAbierto && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-white/10 bg-[#1F5A42] p-2 shadow-xl">
                  {enlacesSecundarios.map((e) => {
                    const activo = enlaceActivo(e.href)
                    const esNotif = e.href === '/notificaciones'
                    return (
                      <Link
                        key={e.href}
                        href={e.href}
                        onClick={() => setMasAbierto(false)}
                        className={`relative flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                          activo ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        <span>{e.etiqueta}</span>
                        {esNotif && noLeidas > 0 && (
                          <span className="rounded-full bg-[#D4A017] px-1.5 text-[10px] font-bold text-[#1A1A1A]">
                            {noLeidas > 9 ? '9+' : noLeidas}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={manejarLogout}
              className="ml-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
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
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"
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
          <nav className="border-t border-white/15 bg-[#2D6A4F] px-4 py-2 lg:hidden">
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

      {/* Sub-barra con el nombre del comercio */}
      {nombreComercio && (
        <div className="border-b border-[#1A1A1A]/8 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
            <p className="truncate text-sm text-[#1A1A1A]/60">
              Tu tienda:{' '}
              <span className="font-semibold text-[#2D6A4F]">{nombreComercio}</span>
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
