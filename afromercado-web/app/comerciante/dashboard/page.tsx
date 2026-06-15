'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  obtenerMiComercio,
  listarMisProductos,
  type Comercio,
  type ProductoComerciante,
} from '@/components/comerciante/api'
import { etiquetaUnidad } from '@/components/comerciante/constantes'

function MetricCard({
  valor,
  etiqueta,
  acento = false,
}: {
  valor: string | number
  etiqueta: string
  acento?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-4 shadow-sm">
      <p
        className={`text-3xl leading-none ${acento ? 'text-[#D4A017]' : 'text-[#2D6A4F]'}`}
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        {valor}
      </p>
      <p className="mt-2 text-sm font-medium text-[#1A1A1A]/60 leading-snug">
        {etiqueta}
      </p>
    </div>
  )
}

function FotoProducto({ producto }: { producto: ProductoComerciante }) {
  if (producto.fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={producto.fotoUrl}
        alt={producto.nombre}
        className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
      />
    )
  }
  return (
    <div
      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#52B788]/15"
      aria-hidden="true"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16l4-4a2 2 0 0 1 3 0l4 4M14 14l1-1a2 2 0 0 1 3 0l2 2M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
          stroke="#2D6A4F"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="9" r="1.4" fill="#2D6A4F" />
      </svg>
    </div>
  )
}

function FilaProducto({ producto }: { producto: ProductoComerciante }) {
  const precio = Number(producto.precio)
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-[#1A1A1A]/5 bg-white p-4 shadow-sm">
      <FotoProducto producto={producto} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-[#1A1A1A]">
            {producto.nombre}
          </h3>
          {producto.activo ? (
            <Badge variant="verde">Visible</Badge>
          ) : (
            <Badge variant="gris">Oculto</Badge>
          )}
        </div>
        <p className="mt-1 text-base text-[#1A1A1A]/70">
          <span className="font-semibold text-[#2D6A4F]">
            {formatearPrecio(precio)}
          </span>{' '}
          <span className="text-[#1A1A1A]/50">
            por {etiquetaUnidad(producto.unidad).toLowerCase()}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-[#1A1A1A]/55">
          {producto.stock > 0
            ? `Te quedan ${producto.stock} para vender`
            : 'Sin existencias'}
        </p>
      </div>
      <Link
        href={`/comerciante/productos/${producto.id}/editar`}
        className="flex-shrink-0 rounded-lg border border-[#2D6A4F] px-4 py-2 text-base font-semibold text-[#2D6A4F] transition-colors hover:bg-[#2D6A4F]/5"
      >
        Editar
      </Link>
    </li>
  )
}

function DashboardContenido() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { usuario } = useAuth()
  const publicado = searchParams.get('publicado') === '1'

  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [productos, setProductos] = useState<ProductoComerciante[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarExito, setMostrarExito] = useState(publicado)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const c = await obtenerMiComercio()
        if (!activo) return
        if (!c) {
          router.replace('/comerciante/registro-comercio')
          return
        }
        setComercio(c)
        const prods = await listarMisProductos()
        if (activo) setProductos(prods)
      } catch (err) {
        if (activo)
          setError(
            err instanceof Error
              ? err.message
              : 'No pudimos cargar tu información.',
          )
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [router])

  // Ocultar el aviso de éxito tras unos segundos.
  useEffect(() => {
    if (!mostrarExito) return
    const t = setTimeout(() => setMostrarExito(false), 6000)
    return () => clearTimeout(t)
  }, [mostrarExito])

  const primerNombre = usuario?.nombre?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso de producto publicado */}
      {mostrarExito && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-[#52B788]/40 bg-[#52B788]/15 px-4 py-3"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="#2D6A4F" />
            <path
              d="M8 12.5l2.5 2.5L16 9"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-base font-semibold text-[#2D6A4F]">
            ¡Tu producto ya está publicado!
          </p>
        </div>
      )}

      {/* Saludo */}
      <div>
        <h1
          className="text-3xl text-[#1A1A1A] leading-tight"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Hola, {primerNombre}
        </h1>
        {comercio && (
          <p className="mt-1 text-base text-[#1A1A1A]/60">
            Bienvenido a {comercio.nombre}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
        >
          {error}
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cargando ? (
          <>
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </>
        ) : (
          <>
            <MetricCard valor={productos.length} etiqueta="Productos publicados" />
            <MetricCard valor={comercio?.totalVentas ?? 0} etiqueta="Ventas" />
            <MetricCard
              acento
              valor={
                comercio && Number(comercio.calificacion) > 0
                  ? Number(comercio.calificacion).toFixed(1)
                  : '—'
              }
              etiqueta="Calificación"
            />
          </>
        )}
      </div>

      {/* Botón destacado para publicar */}
      <Link href="/comerciante/publicar" className="block">
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] px-5 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-[#245a42]">
          <span className="text-2xl leading-none">+</span>
          Publicar producto
        </div>
      </Link>

      {/* Mis productos */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-[#1A1A1A]">Mis productos</h2>

        {cargando ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : productos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2D6A4F]/30 bg-white px-6 py-10 text-center">
            <p
              className="text-xl text-[#2D6A4F]"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Aún no has publicado productos
            </p>
            <p className="mx-auto mt-2 max-w-sm text-base text-[#1A1A1A]/60">
              ¡Publica el primero y empieza a vender a todo el país!
            </p>
            <div className="mt-5 flex justify-center">
              <Link href="/comerciante/publicar">
                <Button size="lg">Publicar mi primer producto</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {productos.map((p) => (
              <FilaProducto key={p.id} producto={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-[#1A1A1A]/55">Cargando…</div>}>
      <DashboardContenido />
    </Suspense>
  )
}
