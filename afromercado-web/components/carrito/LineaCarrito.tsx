'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatearPrecio } from '@/lib/formatearPrecio'
import type { CarritoItem } from '@/types/carrito'

/**
 * Una línea de producto dentro del carrito: foto/placeholder, nombre,
 * precio unitario, selector +/- con tope de stock, subtotal y eliminar.
 */
export function LineaCarrito({
  item,
  onActualizar,
  onEliminar,
  editable = true,
}: {
  item: CarritoItem
  onActualizar?: (productoId: string, cantidad: number) => void | Promise<void>
  onEliminar?: (productoId: string) => void | Promise<void>
  editable?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const producto = item.producto
  const precio = producto?.precio ?? 0
  const stock = producto?.stock ?? 99
  const subtotal = precio * item.cantidad
  const mostrarPlaceholder = !producto?.fotoUrl || imgError

  async function cambiar(delta: number) {
    if (!onActualizar || ocupado) return
    const nueva = item.cantidad + delta
    if (nueva < 1 || nueva > stock) return
    setOcupado(true)
    try {
      await onActualizar(item.productoId, nueva)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminar() {
    if (!onEliminar || ocupado) return
    setOcupado(true)
    try {
      await onEliminar(item.productoId)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex gap-3 py-4">
      {/* Foto */}
      <Link
        href={`/producto/${item.productoId}`}
        className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-[#2D6A4F]/10"
      >
        {mostrarPlaceholder ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a3a2a] to-[#2D6A4F]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
        ) : (
          <Image
            src={producto!.fotoUrl!}
            alt={producto?.nombre ?? 'Producto'}
            fill
            sizes="80px"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </Link>

      {/* Detalle */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link
          href={`/producto/${item.productoId}`}
          className="font-semibold text-[#1A1A1A] leading-snug line-clamp-2 hover:text-[#2D6A4F] transition-colors"
        >
          {producto?.nombre ?? 'Producto'}
        </Link>
        <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
          {formatearPrecio(precio)}
          {producto?.unidad ? ` · por ${producto.unidad}` : ''}
        </p>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          {editable ? (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => cambiar(-1)}
                disabled={ocupado || item.cantidad <= 1}
                className="w-9 h-9 rounded-l-lg border border-[#1A1A1A]/15 bg-white flex items-center justify-center text-[#1A1A1A] disabled:opacity-30 hover:bg-[#F8F5F0] transition-colors"
                aria-label="Reducir cantidad"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span className="w-10 h-9 border-t border-b border-[#1A1A1A]/15 bg-white flex items-center justify-center font-semibold text-sm text-[#1A1A1A]">
                {item.cantidad}
              </span>
              <button
                type="button"
                onClick={() => cambiar(1)}
                disabled={ocupado || item.cantidad >= stock}
                className="w-9 h-9 rounded-r-lg border border-[#1A1A1A]/15 bg-white flex items-center justify-center text-[#1A1A1A] disabled:opacity-30 hover:bg-[#F8F5F0] transition-colors"
                aria-label="Aumentar cantidad"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          ) : (
            <span className="text-sm text-[#1A1A1A]/60">Cantidad: {item.cantidad}</span>
          )}

          <span className="font-bold text-[#1A1A1A] whitespace-nowrap">
            {formatearPrecio(subtotal)}
          </span>
        </div>
      </div>

      {/* Eliminar */}
      {editable && onEliminar && (
        <button
          type="button"
          onClick={eliminar}
          disabled={ocupado}
          className="self-start w-9 h-9 flex items-center justify-center rounded-lg text-[#1A1A1A]/40 hover:text-[#C0392B] hover:bg-[#C0392B]/10 transition-colors disabled:opacity-40"
          aria-label={`Eliminar ${producto?.nombre ?? 'producto'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default LineaCarrito
