'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { toggleFavoritoCultura } from '@/lib/api/cultura'

interface BotonFavoritoCulturaProps {
  eventoId: number
  esFavorito: boolean
  /** Se llama tras un toggle exitoso con el nuevo estado, para que el padre mantenga su lista/Set sincronizado. */
  onChange?: (esFavorito: boolean) => void
  /** 'tarjeta': botón circular pequeño superpuesto sobre una imagen. 'detalle': botón más grande para una barra de acciones. */
  variante?: 'tarjeta' | 'detalle'
  className?: string
}

/**
 * Botón de favorito con toggle optimista (mismo patrón que FavoritoContext para productos):
 * actualiza la UI de inmediato y revierte si la petición falla.
 *
 * Decisión de diseño — usuario sin sesión: el corazón se muestra siempre (para que el usuario
 * descubra la función), pero al hacer clic sin sesión se redirige a `/ingresar?redirect=...`
 * en vez de intentar la llamada a la API. Es más descubrible que ocultar el botón por completo
 * (como hace TarjetaProducto), y evita una llamada que el backend rechazaría con 401.
 */
export default function BotonFavoritoCultura({
  eventoId,
  esFavorito,
  onChange,
  variante = 'tarjeta',
  className = '',
}: BotonFavoritoCulturaProps) {
  const { autenticado } = useAuth()
  const router = useRouter()
  const [marcado, setMarcado] = useState(esFavorito)
  const [enVuelo, setEnVuelo] = useState(false)

  // Sincroniza si el padre actualiza el prop externamente (p.ej. tras cargar `misFavoritosCultura`).
  useEffect(() => {
    if (!enVuelo) setMarcado(esFavorito)
  }, [esFavorito, enVuelo])

  async function manejarClic(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!autenticado) {
      router.push(`/ingresar?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/cultura')}`)
      return
    }

    if (enVuelo) return
    const anterior = marcado
    const optimista = !anterior
    setMarcado(optimista)
    setEnVuelo(true)
    try {
      const { esFavorito: resultado } = await toggleFavoritoCultura(eventoId)
      setMarcado(resultado)
      onChange?.(resultado)
    } catch {
      setMarcado(anterior)
    } finally {
      setEnVuelo(false)
    }
  }

  const tamano = variante === 'detalle' ? 'w-11 h-11' : 'w-8 h-8'
  const iconoTamano = variante === 'detalle' ? 'w-5 h-5' : 'w-4 h-4'
  const fondo = variante === 'detalle'
    ? 'bg-white border border-[#1A1A1A]/10 shadow-sm hover:bg-[#F8F5F0]'
    : 'bg-white/85 backdrop-blur shadow-sm hover:bg-white'

  return (
    <button
      type="button"
      onClick={manejarClic}
      aria-label={marcado ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-pressed={marcado}
      title={marcado ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      className={`inline-flex ${tamano} flex-shrink-0 items-center justify-center rounded-full transition-colors ${fondo} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={iconoTamano}
        fill={marcado ? '#E53E3E' : 'none'}
        stroke={marcado ? '#E53E3E' : '#1A1A1A'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}
