'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCarrito } from '@/context/CarritoContext'
import { useAuth } from '@/context/AuthContext'
import { useRegion } from '@/context/RegionContext'
import { useTheme } from '@/context/ThemeContext'
import { apiFetch, normalizarUrlMedia } from '@/lib/api/client'
import { obtenerReglasPublicas } from '@/lib/api/config'
import { DEPARTAMENTOS } from '@/lib/data/colombia'
import { Utensils, Hotel, Map, Ship, Ticket, Clapperboard, Briefcase, Home, Leaf, Sparkles, MoreHorizontal } from 'lucide-react'
import ModalAvatarLightbox from '@/components/ui/ModalAvatarLightbox'
import CampanaNotificaciones from './CampanaNotificaciones'
import BuscadorGlobal from './BuscadorGlobal'

interface HeaderProps {
  itemsCarrito?: number
}

export default function Header({ itemsCarrito }: HeaderProps) {
  const { cantidadTotal } = useCarrito()
  const { usuario, autenticado, logout } = useAuth()
  const { regionActiva, elegirRegion } = useRegion()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

  const badge = itemsCarrito ?? cantidadTotal

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)
  const [avatarModalAbierto, setAvatarModalAbierto] = useState(false)
  const [regionMenuAbierto, setRegionMenuAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [busquedasRecientes, setBusquedasRecientes] = useState<string[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [reglas, setReglas] = useState<import('@/lib/api/config').ReglasPublicas | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const busquedaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    obtenerReglasPublicas()
      .then((r) => {
        setLogoUrl(r.logoUrl)
        setReglas(r)
      })
      .catch(() => {})
  }, [])

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const q = busqueda.trim()
    setMostrarSugerencias(false)
    router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar')
  }

  function seleccionarSugerencia(q: string) {
    setBusqueda(q)
    setMostrarSugerencias(false)
    router.push(`/buscar?q=${encodeURIComponent(q)}`)
  }

  const cargarBusquedasRecientes = useCallback(async () => {
    if (!autenticado) return
    try {
      const res = await apiFetch<{ ok: boolean; data: { query: string }[] }>('/productos/busquedas-recientes')
      setBusquedasRecientes((res?.data ?? []).map((b) => b.query))
    } catch { /* silencioso */ }
  }, [autenticado])

  useEffect(() => {
    if (!menuAbierto) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuAbierto])

  useEffect(() => {
    if (!regionMenuAbierto) return
    function onClick(e: MouseEvent) {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) {
        setRegionMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [regionMenuAbierto])

  useEffect(() => {
    if (!mostrarSugerencias) return
    function onClick(e: MouseEvent) {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) {
        setMostrarSugerencias(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [mostrarSugerencias])

  useEffect(() => {
    if (!masAbierto) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [masAbierto])

  // Móvil: los 4 módulos principales (documentados en CLAUDE.md) quedan visibles
  // sin scroll; el resto vive detrás de "Más" para no perder espacio ni orden.
  type EnlaceNav = { href: string; label: string; Icono: typeof Utensils; dorado?: boolean; negrita?: boolean }
  const enlacesPrimarios: EnlaceNav[] = [
    (!reglas || reglas.flagModuloExpress) && { href: '/express', label: 'Sabores', Icono: Utensils },
    (!reglas || reglas.flagModuloHoteles) && { href: '/hoteles', label: 'Hoteles', Icono: Hotel },
    (!reglas || reglas.flagModuloTours) && { href: '/tours', label: 'Tours', Icono: Map },
    (!reglas || reglas.flagModuloTransportes) && { href: '/transportes', label: 'Transp.', Icono: Ship },
  ].filter(Boolean) as EnlaceNav[]
  const enlacesSecundarios: EnlaceNav[] = [
    { href: '/cultura', label: 'Cultura', Icono: Ticket },
    (!reglas || reglas.flagModuloVitrinaReels) && { href: '/vitrina', label: 'Vitrina', Icono: Clapperboard },
    (!reglas || reglas.flagModuloEmpleo) && { href: '/empleo', label: 'Empleo', Icono: Briefcase },
    (!reglas || reglas.flagModuloInmuebles) && { href: '/bienes-raices', label: 'Bienes Raíces', Icono: Home },
    { href: '/agro', label: 'Agro', Icono: Leaf },
    { href: '/temporada', label: 'Temporada', Icono: Sparkles, dorado: true },
    { href: '/mapa', label: 'Mapa', Icono: Map, negrita: true },
  ].filter(Boolean) as EnlaceNav[]

  return (
    <header className="sticky top-0 z-50 bg-[#F8F5F0] dark:bg-[#15201A] shadow-[0_2px_8px_rgba(0,0,0,0.12)] border-b border-transparent dark:border-white/10 transition-colors">
      <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 md:px-6 flex items-center justify-between h-14 md:h-16">

        {/* Logo */}
        <Link href="/" className="flex items-center min-h-[44px]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Teravia" className="h-9 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="text-2xl" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              <span className="text-[#2D6A4F] dark:text-[#52B788]">Tera</span>
              <span className="text-[#D4A017]">via</span>
            </span>
          )}
        </Link>

        {/* Selector de región activa */}
        <div className="relative ml-2 md:ml-3 flex-shrink-0" ref={regionRef}>
          <button
            type="button"
            onClick={() => setRegionMenuAbierto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={regionMenuAbierto}
            className="flex items-center gap-1 min-h-[36px] px-2 md:px-2.5 rounded-lg text-xs md:text-sm font-semibold text-[#1B4332] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 border border-[#2D6A4F]/20 dark:border-white/20"
          >
            <span aria-hidden="true">📍</span>
            <span className="hidden sm:inline max-w-[90px] md:max-w-[140px] truncate">
              {regionActiva ?? 'Todo el país'}
            </span>
            <svg className="w-3 h-3 text-[#1A1A1A]/50 dark:text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {regionMenuAbierto && (
            <div
              role="menu"
              className="absolute left-0 mt-2 w-56 bg-white dark:bg-[#1A241F] border border-gray-100 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 z-50"
            >
              <p className="px-4 py-1.5 text-xs font-semibold text-[#1A1A1A]/40 dark:text-white/40 uppercase tracking-wide">
                Región activa
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => { elegirRegion(null); setRegionMenuAbierto(false) }}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 ${
                  regionActiva === null ? 'font-semibold text-[#D4A017]' : 'text-[#1A1A1A] dark:text-white'
                }`}
              >
                🌎 Todo el país
              </button>
              <div className="border-t border-[#1A1A1A]/10 dark:border-white/10 my-1" />
              <div className="max-h-64 overflow-y-auto">
                {DEPARTAMENTOS.map((departamento) => (
                  <button
                    key={departamento}
                    type="button"
                    role="menuitem"
                    onClick={() => { elegirRegion(departamento); setRegionMenuAbierto(false) }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 ${
                      regionActiva === departamento ? 'font-semibold text-[#D4A017]' : 'text-[#1A1A1A] dark:text-white'
                    }`}
                  >
                    {departamento}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra de búsqueda — solo desktop */}
        <div className="hidden md:flex flex-1 min-w-0 max-w-md mx-4 lg:mx-8 justify-center">
          <BuscadorGlobal />
        </div>


        {/* Íconos derecha */}
        <div className="flex items-center gap-0.5 sm:gap-2">
          {/* Búsqueda móvil */}
          <button
            onClick={() => router.push('/buscar')}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10"
            aria-label="Buscar"
          >
            <svg className="w-5 h-5 text-[#1A1A1A] dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Toggle Modo Oscuro / Claro */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 transition-colors"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <span className="text-xl" role="img" aria-label="Sol">☀️</span>
            ) : (
              <span className="text-xl" role="img" aria-label="Luna">🌙</span>
            )}
          </button>

          {/* Campana de notificaciones — solo usuarios autenticados */}
          {autenticado && <CampanaNotificaciones />}

          {/* Carrito */}
          <Link href="/carrito" className="relative flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10" aria-label="Carrito">
            <svg className="w-5 h-5 text-[#1A1A1A] dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#D4A017] text-[#1A1A1A] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {badge}
              </span>
            )}
          </Link>

          {/* Cuenta */}
          {!autenticado ? (
            <Link
              href="/ingresar"
              className="flex items-center justify-center min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10"
            >
              Ingresar
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuAbierto(!menuAbierto)}
                className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[#1A1A1A] dark:text-white hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10"
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
              >
                {(() => {
                  const avatarUrlFinal = normalizarUrlMedia(usuario?.avatarUrl)
                  return avatarUrlFinal ? (
                    <img src={avatarUrlFinal} alt={usuario?.nombre} className="w-7 h-7 rounded-full object-cover border border-[#2D6A4F]/30" />
                  ) : (
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2D6A4F] text-white text-xs font-bold uppercase">
                      {(usuario?.nombre ?? '?').charAt(0)}
                    </span>
                  )
                })()}
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {usuario?.nombre}
                </span>
                <svg className="hidden sm:inline w-3.5 h-3.5 text-[#1A1A1A]/50 dark:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuAbierto && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1A241F] border border-gray-100 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 z-50"
                >
                  <div className="px-4 py-2 border-b border-[#1A1A1A]/10 dark:border-white/10 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white truncate">{usuario?.nombre}</p>
                      <p className="text-xs text-[#1A1A1A]/50 dark:text-white/50 truncate">{usuario?.email}</p>
                    </div>
                    {usuario?.avatarUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuAbierto(false)
                          setAvatarModalAbierto(true)
                        }}
                        className="text-xs text-[#2D6A4F] hover:underline font-semibold flex-shrink-0"
                        title="Ver foto en HD"
                      >
                        Ver HD
                      </button>
                    )}
                  </div>
                  {usuario?.rol === 'ADMIN' && (
                    <Link href="/admin" role="menuitem" onClick={() => setMenuAbierto(false)}
                      className="block px-4 py-2 text-sm font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                      Panel de administración
                    </Link>
                  )}
                  {usuario?.rol === 'COMERCIANTE' && (
                    <>
                      <Link href="/comerciante" role="menuitem" onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2 text-sm font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                        Mi tienda
                      </Link>
                      <Link href="/mis-liquidaciones" role="menuitem" onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                        Mis liquidaciones
                      </Link>
                    </>
                  )}
                  {usuario?.rol === 'REPARTIDOR' && (
                    <>
                      <Link href="/repartidor" role="menuitem" onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2 text-sm font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                        Panel repartidor
                      </Link>
                      <Link href="/mis-liquidaciones" role="menuitem" onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                        Mis liquidaciones
                      </Link>
                    </>
                  )}
                  {usuario?.rol === 'COMPRADOR' && (
                    <>
                      <Link href="/comerciante/registro-comercio" role="menuitem" onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2 text-sm font-semibold text-[#D4A017] dark:text-[#F3C242] hover:bg-[#D4A017]/10 dark:hover:bg-white/10">
                        🏪 Abre tu tienda
                      </Link>
                      <Link href="/ser-repartidor" role="menuitem" onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2 text-sm font-semibold text-[#D4A017] dark:text-[#F3C242] hover:bg-[#D4A017]/10 dark:hover:bg-white/10">
                        🚴 Sé repartidor
                      </Link>
                    </>
                  )}
                  <Link href="/perfil" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    Mi perfil
                  </Link>
                  <Link href="/mis-pedidos" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    Mis pedidos
                  </Link>
                  <Link href="/mis-direcciones" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    Mis direcciones
                  </Link>
                  <Link href="/mis-favoritos" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    Mis favoritos
                  </Link>
                  <div className="border-t border-[#1A1A1A]/10 dark:border-white/10 my-1" />
                  <Link href="/hoteles/mis-reservas" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    🏨 Reservas hotel
                  </Link>
                  <Link href="/tours/mis-reservas" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    🗺️ Reservas tour
                  </Link>
                  <Link href="/transportes/mis-reservas" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    🛥️ Reservas transporte
                  </Link>
                  <Link href="/cultura/mis-reservas" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    🎭 Reservas cultura
                  </Link>
                  <Link href="/empleo/mi-hoja-de-vida" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    💼 Mi hoja de vida
                  </Link>
                  <Link href="/empleo/mis-postulaciones" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    💼 Mis postulaciones
                  </Link>
                  <Link href="/empleo/mis-ofertas" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    💼 Ofertas que publiqué
                  </Link>
                  <Link href="/empleo/favoritos" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    💼 Empleos favoritos
                  </Link>
                  <div className="border-t border-[#1A1A1A]/10 dark:border-white/10 my-1" />
                  <Link href="/chat" role="menuitem" onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] dark:text-white/90 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10">
                    Mensajes
                  </Link>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuAbierto(false); logout() }}
                    className="block w-full text-left px-4 py-2 text-sm text-[#B85A1A] dark:text-[#E87A2A] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fila Inferior móvil: solo los 4 módulos principales + botón "Más" — sin scroll oculto */}
      <div className="sm:hidden flex bg-[#2D6A4F]/5 border-t border-black/5">
        <nav className="flex w-full items-stretch" aria-label="Navegación principal">
          {enlacesPrimarios.map(({ href, label, Icono }) => (
            <Link
              key={href}
              href={href}
              className="flex-1 min-w-0 flex items-center justify-center gap-1 min-h-[36px] px-1 text-[11px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 transition-colors"
            >
              <Icono className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            aria-haspopup="menu"
            aria-expanded={masAbierto}
            className="flex-1 min-w-0 flex items-center justify-center gap-1 min-h-[36px] px-1 text-[11px] font-semibold text-[#1A1A1A]/70 dark:text-white/70 hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
            Más
          </button>
        </nav>
      </div>

      {masAbierto && (
        <div
          className="sm:hidden fixed inset-0 z-[60] bg-black/40"
          onClick={() => setMasAbierto(false)}
          role="presentation"
        >
          <div
            role="menu"
            aria-label="Más secciones"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1A241F] rounded-t-2xl pt-3 px-4 pb-6 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]"
          >
            <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20 mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {enlacesSecundarios.map(({ href, label, Icono, dorado, negrita }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setMasAbierto(false)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 transition-colors ${
                    dorado ? 'text-[#D4A017]' : negrita ? 'text-[#1B4332] dark:text-[#52B788] font-bold' : 'text-[#2D6A4F] dark:text-[#52B788]'
                  }`}
                >
                  <Icono className="w-5 h-5" />
                  <span className="text-xs font-semibold text-center leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fila Inferior desktop/tablet: Menú de Navegación Completo (distribuido, sin scroll) */}
      <div className="hidden sm:flex bg-[#2D6A4F]/5 border-t border-black/5">
        <div className="w-full max-w-6xl mx-auto px-2 md:px-6">
          <nav className="flex items-center gap-2 lg:justify-between py-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }} aria-label="Navegación principal">
            {(!reglas || reglas.flagModuloExpress) && (
              <Link href="/express" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Utensils className="w-4 h-4" /> Sabores
              </Link>
            )}
            {(!reglas || reglas.flagModuloHoteles) && (
              <Link href="/hoteles" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Hotel className="w-4 h-4" /> Hoteles
              </Link>
            )}
            {(!reglas || reglas.flagModuloTours) && (
              <Link href="/tours" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Map className="w-4 h-4" /> Tours
              </Link>
            )}
            {(!reglas || reglas.flagModuloTransportes) && (
              <Link href="/transportes" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Ship className="w-4 h-4" /> Transporte
              </Link>
            )}
            <Link href="/cultura" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
              <Ticket className="w-4 h-4" /> Cultura
            </Link>
            {(!reglas || reglas.flagModuloVitrinaReels) && (
              <Link href="/vitrina" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Clapperboard className="w-4 h-4" /> Vitrina
              </Link>
            )}
            {(!reglas || reglas.flagModuloEmpleo) && (
              <Link href="/empleo" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Briefcase className="w-4 h-4" /> Empleo
              </Link>
            )}
            {(!reglas || reglas.flagModuloInmuebles) && (
              <Link href="/bienes-raices" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
                <Home className="w-4 h-4" /> Bienes Raíces
              </Link>
            )}
            <Link href="/agro" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#2D6A4F] dark:text-[#52B788] hover:bg-[#2D6A4F]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
              <Leaf className="w-4 h-4" /> Agro
            </Link>
            <Link href="/temporada" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-semibold text-[#D4A017] hover:bg-[#D4A017]/10 flex items-center gap-1.5 transition-colors">
              <Sparkles className="w-4 h-4" /> Temporada
            </Link>
            <Link href="/mapa" className="flex-shrink-0 min-h-[36px] px-2 rounded-lg text-[13px] font-bold text-[#1B4332] dark:text-[#52B788] hover:bg-[#1B4332]/10 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors">
              <Map className="w-4 h-4" /> Mapa
            </Link>
          </nav>
        </div>
      </div>

      <ModalAvatarLightbox
        isOpen={avatarModalAbierto}
        onClose={() => setAvatarModalAbierto(false)}
        src={normalizarUrlMedia(usuario?.avatarUrl)}
        nombre={usuario?.nombre ?? 'Usuario'}
        subtitulo={usuario?.email}
      />
    </header>
  )
}
