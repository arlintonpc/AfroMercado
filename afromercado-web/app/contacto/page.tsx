import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const CANALES = [
  {
    titulo: 'Chat de la cuenta',
    descripcion: 'Si ya iniciaste sesión, este es el canal más rápido para hablar sobre pedidos, productos o mensajes pendientes.',
    href: '/ingresar?redirect=/chat',
    accion: 'Entrar al chat',
  },
  {
    titulo: 'Seguimiento de pedidos',
    descripcion: 'Revisa el estado de tus compras, pagos y entregas desde una sola vista.',
    href: '/mis-pedidos',
    accion: 'Ver pedidos',
  },
  {
    titulo: 'Explorar productos',
    descripcion: 'Si todavía no encuentras lo que buscas, vuelve al catálogo y sigue explorando.',
    href: '/',
    accion: 'Ir al catálogo',
  },
]

export default function PaginaContacto() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-10">
        <div className="mb-8">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-2">Ayuda</p>
          <h1 className="text-3xl md:text-4xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Contacto
          </h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed">
            ¿Necesitas ayuda con un pedido, una cuenta o una publicación? Empieza por el canal que mejor encaje con
            tu caso y te llevamos al lugar correcto.
          </p>
        </div>

        <div className="grid gap-4">
          {CANALES.map((canal) => (
            <div key={canal.titulo} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                  {canal.titulo}
                </h2>
                <p className="mt-2 text-sm md:text-base text-[#1A1A1A]/65 leading-relaxed max-w-2xl">
                  {canal.descripcion}
                </p>
              </div>
              <Link
                href={canal.href}
                className="inline-flex items-center justify-center rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
              >
                {canal.accion}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="bg-[#2D6A4F] text-white rounded-2xl p-5 md:p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-widest uppercase text-white/70 mb-2">¿Eres comercio?</p>
            <h2 className="text-2xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              Gestiona tu tienda desde tu panel
            </h2>
            <p className="mt-2 text-sm text-white/75 leading-relaxed">
              Si necesitas ayuda con publicaciones, inventario o pedidos, entra a tu cuenta de comerciante y continúa
              desde allí.
            </p>
            <Link href="/comerciante" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#2D6A4F] hover:bg-[#F8F5F0] transition-colors">
              Ir al panel
            </Link>
          </section>

          <section className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 md:p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#52B788] mb-2">¿Quieres unirte?</p>
            <h2 className="text-2xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              También puedes sumarte como repartidor
            </h2>
            <p className="mt-2 text-sm text-[#1A1A1A]/65 leading-relaxed">
              Si tu duda está relacionada con entregas, revisa la ruta para solicitar acceso al panel de repartidor.
            </p>
            <Link href="/ser-repartidor" className="mt-4 inline-flex rounded-xl border border-[#1A1A1A]/10 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] transition-colors">
              Ser repartidor
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
