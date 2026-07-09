'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

const NAV_LINKS = [
  { href: '/admin',                      label: 'Resumen'        },
  { href: '/admin/categorias',           label: 'Categorías'     },
  { href: '/admin/usuarios',             label: 'Usuarios'       },
  { href: '/admin/comercios',            label: '🏪 Comercios'   },
  { href: '/admin/comerciantes',         label: 'Comerciantes'   },
  { href: '/admin/solicitudes-repartidor', label: 'Repartidores' },
  { href: '/admin/liquidaciones',        label: 'Liquidaciones'  },
  { href: '/admin/disputas',             label: 'Reclamos'       },
  { href: '/admin/facturas',             label: 'Facturas'       },
  { href: '/admin/pqrsd',                label: 'PQRSD'          },
  { href: '/admin/empleo',               label: 'Empleo'         },
  { href: '/admin/cultura',              label: '🎭 Cultura'     },
  { href: '/admin/entregas',             label: 'Entregas'       },
  { href: '/admin/envios',              label: 'Envíos'         },
  { href: '/admin/pedidos',              label: 'Pedidos'        },
  { href: '/admin/pagos-config',         label: 'Pasarela'       },
  { href: '/admin/cupones',              label: 'Cupones'        },
  { href: '/admin/alianzas',             label: 'Alianzas'       },
  { href: '/admin/afromedia',            label: 'AfroMedia'      },
  { href: '/admin/visibilidad',          label: 'Visibilidad'    },
  { href: '/admin/campanas',             label: 'Campañas'       },
  { href: '/admin/hero',                 label: 'Hero'           },
  { href: '/admin/reportes',             label: 'Reportes'       },
  { href: '/admin/productos',            label: 'Productos'      },
  { href: '/admin/reviews',             label: 'Calificaciones' },
  { href: '/admin/hoteles',              label: '🏨 Hoteles'     },
  { href: '/admin/tours',               label: '🗺️ Tours'       },
  { href: '/admin/transportes',         label: '🛥️ Transporte'  },
  { href: '/admin/config',               label: 'Config'         },
]

/** Loader a pantalla completa mientras se valida la sesión. */
function PantallaCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F5F0]">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin text-[#2D6A4F]"
          width="32"
          height="32"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="9"
            cy="9"
            r="7"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <path
            d="M9 2a7 7 0 0 1 7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-sm text-[#1A1A1A]/50">Cargando panel…</p>
      </div>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { usuario, cargando, logout } = useAuth()

  // La página de login no está protegida (evita un bucle de redirección).
  const esRutaLogin = pathname === '/admin/ingresar'
  const esAdmin = usuario?.rol === 'ADMIN'

  useEffect(() => {
    if (cargando || esRutaLogin) return
    if (!esAdmin) {
      router.replace('/admin/ingresar')
    }
  }, [cargando, esRutaLogin, esAdmin, router])

  // La pantalla de login se renderiza con su propio chrome, sin protección.
  if (esRutaLogin) {
    return <>{children}</>
  }

  // Mientras restauramos la sesión, o si aún no hay admin (antes de redirigir).
  if (cargando || !esAdmin) {
    return <PantallaCargando />
  }

  function manejarLogout() {
    logout()
    router.replace('/admin/ingresar')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F5F0] text-[#1A1A1A]">
      {/* Topbar propio del área admin (no hereda Header/Footer públicos) */}
      <header className="sticky top-0 z-30 border-b border-[#1A1A1A]/8 bg-[#2D6A4F] text-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-3">
            <span
              className="text-2xl leading-none"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              AfroMercado
            </span>
            <span className="hidden text-sm font-medium text-white/70 sm:inline">
              Panel de administración
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">
                {usuario?.nombre}
              </p>
              <p className="text-xs leading-tight text-white/70">
                {usuario?.email}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={manejarLogout}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 active:bg-white/30"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Nav secundaria */}
      <nav className="border-b border-[#1A1A1A]/10 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap gap-1 py-2">
            {NAV_LINKS.map(({ href, label }) => {
              const activo = href === '/admin'
                ? pathname === '/admin'
                : pathname === href || pathname.startsWith(href + '/')
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activo
                        ? 'bg-[#2D6A4F]/10 text-[#2D6A4F] font-semibold'
                        : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5'
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
