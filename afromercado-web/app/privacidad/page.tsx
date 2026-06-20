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

export default function PaginaPrivacidad() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-10">
        <div className="mb-8">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-2">Legal</p>
          <h1 className="text-3xl md:text-4xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Política de privacidad
          </h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed">
            Esta página explica qué datos usamos en AfroMercado, para qué los necesitamos y cómo cuidamos tu
            información mientras navegas, compras o administras tu cuenta.
          </p>
        </div>

        <div className="grid gap-4">
          <Bloque titulo="1. Datos que usamos">
            <p>
              Podemos usar datos que tú nos das directamente, como nombre, correo, teléfono, direcciones, pedidos,
              mensajes de soporte y preferencias de navegación dentro de la cuenta.
            </p>
            <p>
              También podemos procesar información técnica básica para que el sitio funcione correctamente, como
              registros de sesión, dispositivo o actividad de uso.
            </p>
          </Bloque>

          <Bloque titulo="2. Para qué los usamos">
            <p>
              Usamos tus datos para crear y mantener tu cuenta, procesar pedidos, mostrar favoritos, enviar
              notificaciones y ayudarte cuando necesitas soporte.
            </p>
            <p>
              También pueden servir para proteger la plataforma, evitar abusos, medir el rendimiento del sitio y
              mejorar la experiencia de compra.
            </p>
          </Bloque>

          <Bloque titulo="3. Con quién se comparten">
            <p>
              Compartimos solo la información necesaria con los comercios involucrados en tu compra, con servicios de
              pago, logística o mensajería cuando hace falta para completar el pedido.
            </p>
            <p>
              No vendemos tus datos personales. Si alguna integración externa es necesaria, la usamos únicamente para
              prestar el servicio que pediste.
            </p>
          </Bloque>

          <Bloque titulo="4. Tus derechos">
            <p>
              Puedes pedir acceso, actualización o corrección de tus datos cuando corresponda. También puedes
              solicitar ayuda si crees que hay un uso incorrecto de tu información.
            </p>
            <p>
              Si quieres revisar una solicitud concreta, entra a la página de contacto o escribe desde tu cuenta para
              que podamos ayudarte caso por caso.
            </p>
          </Bloque>

          <Bloque titulo="5. Seguridad y conservación">
            <p>
              Tomamos medidas razonables para proteger la información, pero ningún sistema es completamente inmune a
              riesgos. Recomendamos cerrar sesión en dispositivos compartidos y usar contraseñas seguras.
            </p>
          </Bloque>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/terminos" className="rounded-xl bg-white border border-[#1A1A1A]/10 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] transition-colors">
            Ver términos
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
