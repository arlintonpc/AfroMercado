'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatearPrecio } from '@/lib/formatearPrecio'
import { useCarrito } from '@/context/CarritoContext'
import { useAuth } from '@/context/AuthContext'
import { LineaCarrito } from '@/components/carrito/LineaCarrito'
import { agruparPorComercio } from '@/components/carrito/agrupar'

export default function PaginaCarrito() {
  const router = useRouter()
  const { items, subtotal, cantidadTotal, actualizar, eliminar, cargando } = useCarrito()
  const { autenticado } = useAuth()
  const [yendo, setYendo] = useState(false)

  const grupos = agruparPorComercio(items)
  const vacio = items.length === 0

  function continuar() {
    setYendo(true)
    if (autenticado) {
      router.push('/checkout')
    } else {
      router.push('/ingresar?redirect=/checkout')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">
        <h1
          className="text-2xl md:text-3xl text-[#1A1A1A] mb-1"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Tu pedido
        </h1>
        {!vacio && (
          <p className="text-sm text-[#1A1A1A]/50 mb-6">
            {cantidadTotal} {cantidadTotal === 1 ? 'producto' : 'productos'} ·{' '}
            {grupos.length} {grupos.length === 1 ? 'productor' : 'productores'}
          </p>
        )}

        {/* Estado vacío */}
        {vacio && !cargando && (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 mt-4">
            <EmptyState
              titulo="Tu pedido está vacío"
              descripcion="Aún no has agregado productos. Descubre lo mejor del Chocó, hecho por sus productores."
            />
            <div className="flex justify-center pb-10">
              <Link href="/">
                <Button>Explorar productos</Button>
              </Link>
            </div>
          </div>
        )}

        {!vacio && (
          <div className="md:grid md:grid-cols-[1fr_320px] md:gap-6 md:items-start">
            {/* Columna items, agrupados por comercio */}
            <div className="flex flex-col gap-4">
              {grupos.map((grupo) => (
                <section
                  key={grupo.comercio}
                  className="bg-white rounded-2xl border border-[#1A1A1A]/5 overflow-hidden"
                >
                  {/* Encabezado comercio */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#2D6A4F]/5 border-b border-[#1A1A1A]/5">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2D6A4F] text-white text-xs font-bold uppercase flex-shrink-0">
                      {grupo.comercio.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#1A1A1A] truncate">
                        {grupo.comercio}
                      </p>
                      {grupo.municipio && (
                        <p className="text-xs text-[#1A1A1A]/50 truncate">
                          📍 {grupo.municipio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items del comercio */}
                  <div className="px-4 divide-y divide-[#1A1A1A]/5">
                    {grupo.items.map((item) => (
                      <LineaCarrito
                        key={item.productoId}
                        item={item}
                        onActualizar={actualizar}
                        onEliminar={eliminar}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <p className="text-xs text-[#1A1A1A]/50 px-1 flex items-start gap-1.5">
                <span aria-hidden>📦</span>
                Cada productor prepara y coordina el envío de su parte por separado.
              </p>
            </div>

            {/* Resumen */}
            <aside className="mt-6 md:mt-0 md:sticky md:top-20">
              <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-5">
                <h2 className="font-bold text-[#1A1A1A] mb-4">Resumen</h2>

                <div className="flex justify-between text-sm text-[#1A1A1A]/70 mb-2">
                  <span>Subtotal ({cantidadTotal})</span>
                  <span className="font-medium text-[#1A1A1A]">
                    {formatearPrecio(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-sm text-[#1A1A1A]/70 mb-2">
                  <span>Envío</span>
                  <span className="text-[#1A1A1A]/50">Se calcula en el siguiente paso</span>
                </div>

                <p className="text-xs text-[#1A1A1A]/45 mb-4 flex items-start gap-1.5">
                  <span aria-hidden>🚚</span>
                  Verás el costo exacto según tu ciudad antes de pagar.
                </p>

                <div className="h-px bg-[#1A1A1A]/10 my-3" />

                <div className="flex justify-between items-baseline mb-5">
                  <span className="font-semibold text-[#1A1A1A]">Total</span>
                  <span className="text-xl font-bold text-[#2D6A4F]">
                    {formatearPrecio(subtotal)}
                  </span>
                </div>

                {/* Botón en desktop / dentro del flujo normal */}
                <div className="hidden md:block">
                  <Button onClick={continuar} loading={yendo} className="w-full">
                    Continuar compra
                  </Button>
                </div>

                {!autenticado && (
                  <p className="text-xs text-[#1A1A1A]/50 text-center mt-3">
                    Te pediremos ingresar para confirmar tu pedido.
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Barra inferior móvil */}
      {!vacio && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#1A1A1A]/10 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#1A1A1A]/50">Total</p>
            <p className="text-lg font-bold text-[#2D6A4F]">{formatearPrecio(subtotal)}</p>
          </div>
          <Button onClick={continuar} loading={yendo} className="flex-1 max-w-[60%]">
            Continuar compra
          </Button>
        </div>
      )}

      <Footer />
    </div>
  )
}
