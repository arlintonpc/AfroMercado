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
            Esta Política de Tratamiento de Datos Personales se expide conforme a la Ley 1581 de 2012 y el Decreto 1377
            de 2013 de Colombia (Habeas Data), y explica cómo recolectamos, usamos y protegemos tu información.
          </p>
          <p className="mt-2 text-xs text-[#1A1A1A]/45">Última actualización: [COMPLETAR fecha]</p>
        </div>

        <div className="grid gap-4">
          <Bloque titulo="1. Responsable del tratamiento">
            <p>
              El responsable del tratamiento de tus datos es <strong>[COMPLETAR: razón social]</strong>,
              NIT <strong>[COMPLETAR: NIT]</strong>, con domicilio en <strong>[COMPLETAR: dirección, ciudad]</strong>.
              Para asuntos de datos personales, escríbenos a <strong>[COMPLETAR: correo de protección de datos]</strong>
              o al <strong>[COMPLETAR: teléfono/WhatsApp]</strong>.
            </p>
          </Bloque>

          <Bloque titulo="2. Datos que recolectamos">
            <p>
              Datos que nos das directamente: nombre, correo, teléfono, direcciones de entrega, documento de
              identidad (cuando aplica para comercios o repartidores), pedidos, mensajes de chat y soporte.
            </p>
            <p>
              Datos técnicos para el funcionamiento del sitio: registros de sesión, dispositivo, e historial de
              navegación y búsquedas dentro de tu cuenta.
            </p>
          </Bloque>

          <Bloque titulo="3. Finalidades del tratamiento">
            <p>
              Usamos tus datos para: crear y administrar tu cuenta; procesar pedidos, pagos y entregas; mostrar
              favoritos y recomendaciones; enviar notificaciones del servicio; brindar soporte; prevenir fraude; y
              cumplir obligaciones legales.
            </p>
          </Bloque>

          <Bloque titulo="4. Autorización">
            <p>
              Al registrarte y aceptar esta política, autorizas de manera previa, expresa e informada el tratamiento de
              tus datos para las finalidades aquí descritas. Puedes revocar esta autorización en cualquier momento,
              salvo que exista un deber legal o contractual de conservarlos.
            </p>
          </Bloque>

          <Bloque titulo="5. Tus derechos como titular (Habeas Data)">
            <p>Conforme a la Ley 1581 de 2012, tienes derecho a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Conocer, actualizar y rectificar tus datos personales.</li>
              <li>Solicitar prueba de la autorización otorgada.</li>
              <li>Ser informado sobre el uso que se da a tus datos.</li>
              <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
              <li>Revocar la autorización y/o solicitar la supresión de tus datos cuando proceda.</li>
              <li>Acceder de forma gratuita a tus datos personales.</li>
            </ul>
          </Bloque>

          <Bloque titulo="6. Cómo ejercer tus derechos">
            <p>
              Envía tu consulta o reclamo a <strong>[COMPLETAR: correo de protección de datos]</strong>. Las consultas
              se atienden en un máximo de <strong>diez (10) días hábiles</strong> y los reclamos en un máximo de
              <strong> quince (15) días hábiles</strong>, conforme a la ley.
            </p>
          </Bloque>

          <Bloque titulo="7. Con quién se comparten (encargados)">
            <p>
              Compartimos solo lo necesario con los comercios de tu compra y con proveedores que nos ayudan a operar
              (pasarela/medios de pago, logística y mensajería, alojamiento del sitio y envío de notificaciones), bajo
              deberes de confidencialidad. <strong>No vendemos tus datos personales.</strong>
            </p>
          </Bloque>

          <Bloque titulo="8. Seguridad, conservación y menores">
            <p>
              Aplicamos medidas razonables (técnicas, humanas y administrativas) para proteger tu información.
              Conservamos los datos mientras tu cuenta esté activa o mientras exista una obligación legal. El servicio
              está dirigido a mayores de edad.
            </p>
            <p>
              Ningún sistema es 100% inmune a riesgos: cierra sesión en dispositivos compartidos y usa contraseñas
              seguras.
            </p>
            <p className="text-xs text-[#1A1A1A]/45">
              Nota: este documento es una base general conforme a la normativa colombiana. Antes de publicar, recomendamos
              que un abogado lo revise y complete los campos marcados.
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
