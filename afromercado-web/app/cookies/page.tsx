import type { ReactNode } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { DatoLegal } from '@/components/legal/DatoLegal'

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

export default function PaginaCookies() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-10">
        <div className="mb-8">
          <p className="text-[#52B788] text-xs font-semibold tracking-widest uppercase mb-2">Legal</p>
          <h1 className="text-3xl md:text-4xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Política de cookies
          </h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed">
            Esta página explica, de forma honesta y específica a cómo funciona AfroMercado, qué usamos para
            mantener tu sesión y qué no.
          </p>
          <p className="mt-2 text-xs text-[#1A1A1A]/45">Última actualización: 4 de julio de 2026</p>
        </div>

        <div className="grid gap-4">
          <Bloque titulo="1. AfroMercado no usa cookies propias">
            <p>
              A diferencia de la mayoría de sitios, AfroMercado <strong>no guarda cookies propias</strong> para
              mantener tu sesión ni para rastrear tu navegación. Cuando inicias sesión, guardamos tu token de
              acceso en el <strong>almacenamiento local de tu navegador</strong> (<code>localStorage</code>), no en
              una cookie. Esto significa que cerrar el navegador no te desconecta automáticamente, y que ese token
              nunca se envía a otros sitios.
            </p>
          </Bloque>

          <Bloque titulo="2. Cookies técnicas de terceros (infraestructura)">
            <p>
              Los proveedores que usamos para alojar y operar la plataforma (por ejemplo, el hosting del sitio y
              el servicio de monitoreo de errores) pueden establecer cookies técnicas propias, estrictamente
              necesarias para su funcionamiento (por ejemplo, balanceo de carga o protección contra abuso). No
              usamos estas cookies para publicidad ni para armar un perfil de tus intereses.
            </p>
          </Bloque>

          <Bloque titulo="3. No hay cookies de publicidad ni de terceros con fines de rastreo">
            <p>
              Hoy AfroMercado no integra Google Analytics, píxeles de redes sociales, ni ninguna cookie de
              publicidad o rastreo entre sitios. Si esto cambia en el futuro, actualizaremos esta página antes de
              activar cualquier herramienta nueva.
            </p>
          </Bloque>

          <Bloque titulo="4. Cómo controlar el almacenamiento local">
            <p>
              Puedes borrar el token guardado cerrando sesión desde tu cuenta, o eliminando los datos de
              navegación del sitio desde la configuración de tu navegador. Ten en cuenta que esto cerrará tu
              sesión activa.
            </p>
          </Bloque>

          <Bloque titulo="5. Preguntas">
            <p>
              Si tienes dudas sobre esta política, escríbenos a <strong><DatoLegal campo="email" /></strong>.
              También puedes revisar nuestra <Link href="/privacidad" className="text-[#2D6A4F] underline">Política de privacidad</Link> para
              entender cómo tratamos tus datos personales en general.
            </p>
            <p className="text-xs text-[#1A1A1A]/45">
              Nota: este documento describe el comportamiento técnico actual del sitio. Si se agregan nuevas
              herramientas de terceros que usen cookies, esta página se actualizará antes de activarlas.
            </p>
          </Bloque>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/privacidad" className="rounded-xl bg-white border border-[#1A1A1A]/10 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] transition-colors">
            Ver privacidad
          </Link>
          <Link href="/terminos" className="rounded-xl bg-white border border-[#1A1A1A]/10 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] transition-colors">
            Ver términos
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
