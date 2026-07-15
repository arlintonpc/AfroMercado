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
            Estas condiciones regulan el uso de Teravia y la relación entre compradores, comercios y la
            plataforma. Al crear una cuenta o realizar un pedido aceptas estos términos.
          </p>
          <p className="mt-2 text-xs text-[#1A1A1A]/45">Última actualización: 24 de junio de 2026 · Aplica legislación de la República de Colombia.</p>
        </div>

        <div className="grid gap-4">
          <Bloque titulo="1. Quiénes somos">
            <p>
              Teravia es operado por <strong><DatoLegal campo="razonSocial" /></strong>, identificada con
              NIT <strong><DatoLegal campo="nit" /></strong>, con domicilio en <strong><DatoLegal campo="direccion" /></strong>,
              correo <strong><DatoLegal campo="email" /></strong> y teléfono <strong><DatoLegal campo="telefono" /></strong>.
            </p>
            <p>
              Teravia es un <strong>marketplace</strong>: una plataforma que conecta a compradores con productores
              y comercios de toda Colombia. Actuamos como intermediarios tecnológicos; la venta se celebra entre el comprador
              y el comercio que publica cada producto.
            </p>
          </Bloque>

          <Bloque titulo="2. Uso de la plataforma">
            <p>
              Puedes usar el sitio solo para fines lícitos. No está permitido publicar contenido engañoso, suplantar a
              terceros, afectar la seguridad del sitio ni usar la plataforma para actividades que incumplan la ley.
            </p>
            <p>
              Para comprar, guardar favoritos o usar el chat necesitas una cuenta válida. Eres responsable de la
              confidencialidad de tu contraseña y de mantener tus datos actualizados.
            </p>
          </Bloque>

          <Bloque titulo="3. Precios, pedidos y pagos">
            <p>
              Los precios se muestran en pesos colombianos (COP). La disponibilidad y los tiempos de alistamiento
              dependen del comercio que publica el producto. Revisa la información en pantalla antes de confirmar.
            </p>
            <p>
              Teravia cobra una comisión sobre cada venta a los comercios (actualmente 10%). El pago se realiza por
              la pasarela digital habilitada y es confirmado automaticamente por el proveedor antes
              de que el comercio prepare el pedido. Si el pago no se completa dentro del tiempo indicado, el pedido se
              cancela y el inventario se libera.
            </p>
          </Bloque>

          <Bloque titulo="4. Envíos y entregas">
            <p>
              El envío se coordina con cada comercio según su alcance (local o nacional) y el peso del producto. Los
              tiempos son estimados y pueden variar por causas externas (clima, transporte, disponibilidad).
            </p>
          </Bloque>

          <Bloque titulo="5. Derecho de retracto y devoluciones">
            <p>
              De acuerdo con el Estatuto del Consumidor (Ley 1480 de 2011), en las compras a distancia tienes derecho
              de retracto dentro de los <strong>cinco (5) días hábiles</strong> siguientes a la entrega, salvo las
              excepciones legales (por ejemplo, productos perecederos o de consumo que se deterioran rápido, como
              alimentos frescos).
            </p>
            <p>
              Si un producto llega defectuoso o no corresponde a lo ofrecido, escríbenos por los canales de soporte y
              te ayudaremos a gestionar la solución con el comercio (cambio, reembolso o reenvío según el caso).
            </p>
          </Bloque>

          <Bloque titulo="6. Responsabilidad de los comercios">
            <p>
              Los comercios son responsables de la veracidad de la información que publican (fotos, descripciones,
              precio, stock, condiciones) y de cumplir con la entrega de los pedidos confirmados.
            </p>
            <p>
              Teravia puede ajustar, ocultar o retirar contenido o cuentas que incumplan estos términos, que sean
              fraudulentos o que generen riesgo para los usuarios.
            </p>
          </Bloque>

          <Bloque titulo="7. Limitación de responsabilidad">
            <p>
              Hacemos lo posible por mantener la plataforma disponible, pero no garantizamos que esté libre de
              interrupciones o errores. Teravia no es responsable por el incumplimiento atribuible exclusivamente a
              un comercio o a un tercero (pagos, transporte), sin perjuicio de la ayuda que brindamos para canalizar
              cada caso.
            </p>
          </Bloque>

          <Bloque titulo="8. Ley aplicable y disputas">
            <p>
              Estos términos se rigen por las leyes de la República de Colombia. Cualquier diferencia se intentará
              resolver de buena fe; en lo relativo a protección al consumidor, podrás acudir a la Superintendencia de
              Industria y Comercio (SIC).
            </p>
          </Bloque>

          <Bloque titulo="9. Cambios y contacto">
            <p>
              Podemos actualizar estos términos; publicaremos la versión vigente en esta página. Si tienes preguntas,
              entra a la página de contacto o escríbenos a <strong><DatoLegal campo="email" /></strong>.
            </p>
            <p className="text-xs text-[#1A1A1A]/45">
              Nota: este documento es una base general. Recomendamos que un abogado en Colombia lo revise y ajuste
              según tu operación. Los datos del operador (razón social, NIT, contacto) se configuran desde el panel.
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
