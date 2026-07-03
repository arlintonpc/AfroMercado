'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import BadgeProductorCertificado from '@/components/ui/BadgeProductorCertificado'

const CRITERIOS = [
  { icono: '📍', titulo: 'Origen verificado', desc: 'El productor debe ser residente del municipio y departamento donde dice operar, en cualquier parte de Colombia.' },
  { icono: '🛍️', titulo: 'Productos auténticos', desc: 'Los productos deben ser elaborados, cultivados o comercializados directamente por el productor, sin intermediarios externos.' },
  { icono: '📞', titulo: 'Contacto validado', desc: 'Número de WhatsApp y datos de contacto verificados por el equipo AfroMercado mediante llamada directa.' },
  { icono: '⭐', titulo: 'Historial limpio', desc: 'Sin reportes de incumplimiento de pedidos, entregas falsas o comportamiento irregular en la plataforma.' },
  { icono: '📷', titulo: 'Fotos reales', desc: 'Las fotografías de productos y servicios deben ser originales y representar fielmente lo que se ofrece.' },
  { icono: '🔄', titulo: 'Renovación anual', desc: 'La certificación se revisa cada 12 meses para garantizar que los estándares se mantengan.' },
]

const CRITERIOS_ETNICO = [
  { icono: '🌿', titulo: 'Comunidad reconocida', desc: 'El productor pertenece a una comunidad afrocolombiana, indígena, raizal o campesina reconocida en su territorio.' },
  { icono: '🎥', titulo: 'Verificación reforzada', desc: 'Además de la validación estándar, el equipo AfroMercado confirma el vínculo comunitario por videollamada o llamada.' },
  { icono: '🏺', titulo: 'Historia y origen', desc: 'El producto o servicio tiene una historia territorial y cultural que se muestra en el perfil del comercio.' },
]

export default function CertificacionPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FAF8F5]">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <BadgeProductorCertificado size="lg" mostrarTooltip={false} />
            <h1
              className="text-3xl md:text-4xl font-bold mt-5 mb-3"
              style={{ fontFamily: 'var(--font-dm-serif)' }}
            >
              Programa de Productores Certificados
            </h1>
            <p className="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
              Garantizamos la autenticidad y origen de cada comerciante en AfroMercado, en cualquier departamento de Colombia.
            </p>
          </div>
        </div>

        {/* Criterios */}
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2
            className="text-2xl font-bold text-[#1A1A1A] mb-8 text-center"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            Criterios de certificación
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {CRITERIOS.map(c => (
              <div key={c.titulo} className="bg-white rounded-2xl border border-[#E8DCC8] p-5">
                <span className="text-2xl">{c.icono}</span>
                <h3 className="font-bold text-[#1A1A1A] mt-2 mb-1">{c.titulo}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Sello adicional: comunidad étnica y territorial */}
          <div className="mt-10 bg-white rounded-2xl border border-[#F4C842]/40 p-6">
            <div className="flex items-center gap-3 mb-2">
              <BadgeProductorCertificado size="md" variante="etnico" mostrarTooltip={false} />
            </div>
            <h3 className="font-bold text-[#1A1A1A] mb-1 text-lg" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Sello de Comunidad Étnica y Territorial
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Un reconocimiento adicional y opcional para productores que pertenecen a comunidades afrocolombianas, indígenas,
              raizales o campesinas reconocidas. No reemplaza al &ldquo;Productor Certificado&rdquo; — se otorga sobre esa base, después
              de una verificación reforzada del vínculo comunitario y territorial.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {CRITERIOS_ETNICO.map(c => (
                <div key={c.titulo} className="rounded-xl bg-[#FDF6E3] p-4">
                  <span className="text-xl">{c.icono}</span>
                  <h4 className="font-bold text-[#1A1A1A] text-sm mt-1 mb-0.5">{c.titulo}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Proceso */}
          <div className="mt-10 bg-white rounded-2xl border border-[#E8DCC8] p-6">
            <h3 className="font-bold text-[#1A1A1A] mb-5 text-lg" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Proceso de certificación
            </h3>
            <div className="space-y-4">
              {[
                { num: '1', titulo: 'Solicitud', desc: 'Envías tu solicitud por WhatsApp con tus datos y municipio.' },
                { num: '2', titulo: 'Revisión', desc: 'El equipo AfroMercado verifica tu información en 2-5 días hábiles.' },
                { num: '3', titulo: 'Validación', desc: 'Te contactamos por WhatsApp para confirmar datos e identidad.' },
                { num: '4', titulo: 'Certificación', desc: 'Tu perfil recibe el badge "Productor Certificado" visible para todos los compradores.' },
              ].map(paso => (
                <div key={paso.num} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {paso.num}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1A1A1A] text-sm">{paso.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{paso.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 bg-[#1B4332] rounded-2xl p-8 text-center text-white">
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              ¿Eres productor en Colombia?
            </h3>
            <p className="text-white/70 mb-5 text-sm">
              Solicita tu certificación y destaca tu comercio ante miles de compradores en todo el país.
            </p>
            <a
              href="https://wa.me/573000000000?text=Hola%2C%20quiero%20solicitar%20la%20certificaci%C3%B3n%20de%20Productor%20Certificado%20en%20AfroMercado"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#20b858] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Solicitar certificación
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
