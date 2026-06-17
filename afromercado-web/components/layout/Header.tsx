'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCarrito } from '@/context/CarritoContext'
import { useAuth } from '@/context/AuthContext'

interface HeaderProps {
  /**
   * Cantidad de items en el carrito. Si no se pasa, se usa la cantidad real
   * del carrito global (useCarrito). Se mantiene opcional por compatibilidad.
   */
  itemsCarrito?: number
}

export default function Header({ itemsCarrito }: HeaderProps) {
  const { cantidadTotal } = useCarrito()
  const { usuario, autenticado, logout } = useAuth()
  const router = useRouter()

  const badge = itemsCarrito ?? cantidadTotal

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const q = busqueda.trim()
    router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar')
  }

  // Cierra el menú de usuario al hacer click fuera.
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

  return (
    <header className="sticky top-0 z-50 bg-[#F8F5F0] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between h-14 md:h-16">

        {/* Logo */}
        <Link href="/" className="flex items-center min-h-[44px]">
          <span className="text-2xl" style={{ fontFamily: 'var(--font-dm-serif)' }}>
            <span className="text-[#2D6A4F]">Afro</span>
            <span className="text-[#D4A017]">Mercado</span>
          </span>
        </Link>

        {/* Barra de búsqueda — solo desktop */}
        <form onSubmit={buscar} className="hidden md:flex flex-1 max-w-md mx-8" role="search">
          <div className="relative w-full">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar productos del Chocó..."
              aria-label="Buscar productos"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#1A1A1A]/20 bg-white focus:outline-none focus:border-[#D4A017] text-sm"
            />
            <button type="submit" aria-label="Buscar" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#2D6A4F]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        <nav className="hidden lg:flex items-center gap-1 mr-3">
          <Link
            href="/temporada"
            className="min-h-[40px] px-3 rounded-lg text-sm font-semibold text-[#D4A017] hover:bg-[#D4A017]/10 flex items-center"
          >
            Temporada
          </Link>
        </nav>

        {/* Íconos derecha */}
        <div className="flex items-center gap-2">
          {/* Búsqueda móvil */}
          <button
            onClick={() => router.push('/buscar')}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#2D6A4F]/10"
            aria-label="Buscar"
          >
            <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Carrito */}
          <Link href="/carrito" className="relative flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#2D6A4F]/10" aria-label="Carrito">
            <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="flex items-center justify-center min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/10"
            >
              Ingresar
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuAbierto((v) => !v)}
                className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[#1A1A1A] hover:bg-[#2D6A4F]/10"
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2D6A4F] text-white text-xs font-bold uppercase">
                  {(usuario?.nombre ?? '?').charAt(0)}
                </span>
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {usuario?.nombre}
                </span>
                <svg className="hidden sm:inline w-3.5 h-3.5 text-[#1A1A1A]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuAbierto && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1 z-50"
                >
                  <div className="px-4 py-2 border-b border-[#1A1A1A]/10">
                    <p className="text-sm font-semibold text-[#1A1A1A] truncate">{usuario?.nombre}</p>
                    <p className="text-xs text-[#1A1A1A]/50 truncate">{usuario?.email}</p>
                  </div>
                  {usuario?.rol === 'ADMIN' && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="block px-4 py-2 text-sm font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/10"
                    >
                      Panel de administración
                    </Link>
                  )}
                  {usuario?.rol === 'COMERCIANTE' && (
                    <Link
                      href="/comerciante"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className="block px-4 py-2 text-sm font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/10"
                    >
                      Mi tienda
                    </Link>
                  )}
                  <Link
                    href="/perfil"
                    role="menuitem"
                    onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] hover:bg-[#2D6A4F]/10"
                  >
                    Mi perfil
                  </Link>
                  <Link
                    href="/mis-pedidos"
                    role="menuitem"
                    onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-2 text-sm text-[#1A1A1A] hover:bg-[#2D6A4F]/10"
                  >
                    Mis pedidos
                  </Link>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuAbierto(false)
                      logout()
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-[#B85A1A] hover:bg-[#2D6A4F]/10"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
