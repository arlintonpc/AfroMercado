import Link from 'next/link'

const reglas = [
  {
    titulo: 'Transparencia obligatoria',
    texto: 'Todo contenido pagado debe identificarse como Patrocinado, Publicidad, Promocionado o Comunidad. No se permite simular que una pauta es recomendacion organica.',
  },
  {
    titulo: 'Comercio verificado',
    texto: 'Solo pueden pautar comercios aprobados, con documentacion revisada, cuenta de dispersion verificada y productos o servicios permitidos.',
  },
  {
    titulo: 'Promesas honestas',
    texto: 'No se aceptan promesas falsas, exageradas o imposibles de cumplir sobre salud, origen, precio, stock, resultados, turismo, calidad o tiempos de entrega.',
  },
  {
    titulo: 'Respeto cultural',
    texto: 'AfroMedia protege la identidad, raiz y dignidad de las comunidades. No se aceptan mensajes discriminatorios, exotizantes, ofensivos o que usen cultura sin contexto.',
  },
  {
    titulo: 'Contenido seguro',
    texto: 'No se permite pautar productos ilegales, documentos falsos, armas, apuestas no autorizadas, contenido sexual explicito, estafas, piramides o servicios financieros no autorizados.',
  },
  {
    titulo: 'Calidad editorial',
    texto: 'Las imagenes, videos y textos deben ser legibles, reales y coherentes con el producto, finca, tienda o experiencia anunciada.',
  },
]

const causasRechazo = [
  'Producto sin stock o informacion incompleta.',
  'Imagen, video o texto que no corresponde al comercio.',
  'Promocion enganosa, precio incorrecto o condiciones ocultas.',
  'Comercio con documentacion pendiente, rechazada o suspendida.',
  'Categoria sensible sin soporte o sin autorizacion suficiente.',
  'Saturacion de cupos publicitarios para el paquete solicitado.',
]

export default function PoliticasPublicidadPage() {
  return (
    <main className="min-h-screen bg-[#F8F5F0]">
      <section className="relative overflow-hidden bg-[#101A14] px-5 py-16 text-white">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-[#52B788]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#D4A017]/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-bold text-white/70 hover:text-white">
            Teravia
          </Link>
          <p className="mt-10 text-xs font-black uppercase tracking-[0.35em] text-[#D4A017]">AfroMedia</p>
          <h1
            className="mt-4 max-w-3xl text-4xl leading-[0.98] sm:text-6xl"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Politicas de publicidad responsable.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/72">
            Estas reglas protegen la confianza del comprador, la reputacion de los comerciantes
            y el valor cultural de Teravia. Version vigente: 2026-06-27.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="h-fit rounded-3xl border border-[#D4A017]/35 bg-[#D4A017]/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9B7300]">Principio rector</p>
          <h2 className="mt-3 text-2xl font-black text-[#1A1A1A]">No se vende confianza.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/65">
            La publicidad puede dar visibilidad, pero no puede reemplazar verificacion, calidad,
            legalidad ni cumplimiento. Teravia puede rechazar, pausar o retirar pautas
            cuando exista riesgo para compradores o comunidades.
          </p>
          <Link
            href="/comerciante/publicidad"
            className="mt-5 inline-flex rounded-2xl bg-[#2D6A4F] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#245a42]"
          >
            Volver a AfroMedia
          </Link>
        </aside>

        <div className="grid gap-5">
          <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-[#1A1A1A]">Reglas principales</h2>
            <div className="mt-5 grid gap-3">
              {reglas.map((regla) => (
                <article key={regla.titulo} className="rounded-2xl bg-[#F8F5F0] p-4">
                  <h3 className="font-black text-[#1A1A1A]">{regla.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#1A1A1A]/62">{regla.texto}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-[#1A1A1A]">Causas comunes de rechazo</h2>
            <div className="mt-5 grid gap-2">
              {causasRechazo.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-[#1A1A1A]/6 bg-[#FDFBF7] p-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#C0392B]" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-[#1A1A1A]/65">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 p-5">
            <h2 className="text-2xl font-black text-[#1A1A1A]">Aceptacion del comerciante</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/65">
              Al enviar una solicitud de pauta, el comerciante confirma que la informacion es real,
              que tiene derecho a usar los textos, imagenes y videos enviados, y que acepta revision
              editorial antes de publicacion. La aprobacion de una pauta no garantiza ventas.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
