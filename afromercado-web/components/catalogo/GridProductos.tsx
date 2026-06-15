import type { Producto } from '@/types/producto'
import TarjetaProducto from './TarjetaProducto'

interface GridProductosProps {
  productos: Producto[]
  cargando: boolean
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-card overflow-hidden flex flex-col">
      <div className="skeleton w-full" style={{ aspectRatio: '4/3' }} />
      <div className="p-3 flex flex-col gap-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-5 w-1/3 rounded mt-1" />
        <div className="skeleton h-11 w-full rounded-lg mt-2" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center gap-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#52B788"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <p
        className="font-sans text-base text-gray-500"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        No hay productos disponibles
      </p>
    </div>
  )
}

export default function GridProductos({ productos, cargando }: GridProductosProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {cargando ? (
        Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
      ) : productos.length === 0 ? (
        <EmptyState />
      ) : (
        productos.map((producto) => (
          <TarjetaProducto key={producto.id} producto={producto} />
        ))
      )}
    </div>
  )
}
