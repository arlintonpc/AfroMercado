import type { ReactNode } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 md:p-6 shadow-sm">
      <h2 className="text-lg md:text-xl font-semibold text-[#1A1A1A] mb-3" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        {titulo}
      </h2>
      <div className="space-y-3 text-sm md:text-base text-[#1A1A1A]/70 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

export default function PaginaTerminos() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-10">
        <div className="mb-8">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-2">Legal</p>
          <h1 className="text-3xl md:text-4xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Términos y condiciones
          </h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed">
            Estas condiciones resumen cómo funciona AfroMercado, qué puedes esperar del sitio y qué responsabilidades
            compartimos entre compradores, comercios y la plataforma.
          </p>
        </div>

        <div className="grid gap-4">
          <Bloque titulo="1. Uso de la plataforma">
            <p>
              AfroMercado conecta personas que compran con productores y comercios del Chocó. El sitio puede usarse
              solo para fines lícitos y respetando las normas de la comunidad.
            </p>
            <p>
              No está permitido publicar contenido engañoso, intentar afectar la seguridad del sitio o usar la
              plataforma para actividades que incumplan la ley.
            </p>
          </Bloque>

          <Bloque titulo="2. Cuentas, pedidos y pagos">
            <p>
              Para comprar, guardar favoritos o escribir en el chat, necesitas una cuenta válida. Debes mantener tus
              datos actualizados para que podamos gestionar pedidos, entregas y soporte.
            </p>
            <p>
              Los precios, la disponibilidad y los tiempos de despacho pueden cambiar según el inventario y el comercio
              que publica el producto. Antes de confirmar un pedido, revisa bien la información mostrada en pantalla.
            </p>
          </Bloque>

          <Bloque titulo="3. Productos y contenido">
            <p>
              Los comercios son responsables de la información que publican sobre sus productos, incluyendo fotos,
              descripciones, stock y condiciones especiales.
            </p>
            <p>
              AfroMercado puede ajustar o retirar contenido que incumpla estas condiciones, que sea fraudulento o que
              genere riesgo para los usuarios.
            </p>
          </Bloque>

          <Bloque titulo="4. Limitación de responsabilidad">
            <p>
              Hacemos lo posible por mantener la plataforma disponible y actualizada, pero no garantizamos que siempre
              esté libre de interrupciones, errores o cambios de terceros fuera de nuestro control.
            </p>
            <p>
              Cada compra se gestiona con el comercio correspondiente. Si surge un problema con un pedido, te
              ayudaremos a canalizarlo, pero la resolución final depende del caso concreto.
            </p>
          </Bloque>

          <Bloque titulo="5. Contacto">
            <p>
              Si tienes preguntas sobre estos términos, entra a nuestra página de contacto o escríbenos desde tu
              cuenta para revisar el caso con más detalle.
            </p>
          </Bloque>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/privacidad" className="rounded-xl bg-white border border-[#1A1A1A]/10 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] transition-colors">
            Ver privacidad
          </Link>
          <Link href="/contacto" className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors">
            Ir a contacto
          </Link>
          <Link href="/" className="rounded-xl border border-[#1A1A1A]/10 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]/70 hover:text-[#1A1A1A] hover:border-[#1A1A1A]/20 transition-colors">
            Volver al catálogo
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
