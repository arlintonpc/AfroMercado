import Image from 'next/image'

/* Fotos reales (mismas URLs sembradas en la BD). Curadas para el collage. */
const COLLAGE = [
  {
    url: 'https://images.unsplash.com/photo-1743252878695-367d69dc87a8?w=600&q=80&auto=format&fit=crop',
    alt: 'Cacao fino de aroma',
    etiqueta: 'Cacao fino',
    precio: '$32.000',
  },
  {
    url: 'https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?w=600&q=80&auto=format&fit=crop',
    alt: 'Piña perolera del Pacífico',
    etiqueta: 'Piña perolera',
    precio: '$6.000',
  },
  {
    url: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=600&q=80&auto=format&fit=crop',
    alt: 'Plátano hartón orgánico',
    etiqueta: 'Plátano hartón',
    precio: '$4.500',
  },
  {
    url: 'https://images.unsplash.com/photo-1775817590687-f1da5d70d9ad?w=600&q=80&auto=format&fit=crop',
    alt: 'Panela negra artesanal',
    etiqueta: 'Panela negra',
    precio: '$8.000',
  },
]

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-[#1a3a2a]">
      {/* Patrón decorativo de fondo */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lp" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
              <circle cx="32" cy="32" r="22" fill="none" stroke="#52B788" strokeWidth="1" />
              <circle cx="32" cy="32" r="8" fill="#52B788" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp)" />
        </svg>
      </div>

      {/* Gradiente principal */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f2419] via-[#1a3a2a] to-[#23503a]" />
      {/* Glow dorado */}
      <div className="absolute top-0 right-1/4 w-[520px] h-[520px] opacity-20 -translate-y-1/3 rounded-full bg-[#D4A017] blur-[90px]" />
      {/* Glow verde */}
      <div className="absolute bottom-0 left-0 w-72 h-72 opacity-25 -translate-x-1/4 translate-y-1/4 rounded-full bg-[#52B788] blur-[70px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">

          {/* ─── Columna texto ─────────────────────────────── */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-[#D4A017]/30 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017] animate-pulse" />
              <span className="text-[#D4A017] text-xs font-semibold tracking-widest uppercase">
                Marketplace del Pacífico
              </span>
            </div>

            {/* Título */}
            <h1 className="leading-[0.95] mb-6" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
              <span className="block text-white text-5xl md:text-6xl lg:text-[68px] font-normal">
                Del Chocó
              </span>
              <span className="block text-5xl md:text-6xl lg:text-[68px] font-normal bg-gradient-to-r from-[#D4A017] via-[#F4C842] to-[#D4A017] bg-clip-text text-transparent">
                para el mundo
              </span>
            </h1>

            <p className="text-white/65 text-base md:text-lg mb-7 leading-relaxed max-w-md">
              Productos ancestrales, artesanías y sabores auténticos directo de las
              comunidades afrocolombianas e indígenas del Chocó.
            </p>

            {/* Productores */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex">
                {[
                  { i: 'J', c: 'bg-[#52B788]' },
                  { i: 'A', c: 'bg-[#D4A017]' },
                  { i: 'M', c: 'bg-[#2D6A4F]' },
                ].map((a, idx) => (
                  <span
                    key={a.i}
                    className={`w-9 h-9 rounded-full ${a.c} ring-2 ring-[#1a3a2a] flex items-center justify-center text-white text-xs font-bold ${idx > 0 ? '-ml-2.5' : ''}`}
                  >
                    {a.i}
                  </span>
                ))}
              </div>
              <p className="text-white/55 text-sm">
                José, Ana Tulia, Marta <span className="text-white/40">y más productores</span>
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-10">
              <a
                href="#catalogo"
                className="group relative overflow-hidden bg-[#D4A017] text-[#1A1A1A] font-semibold px-7 py-3.5 rounded-full transition-all duration-300 hover:shadow-xl hover:shadow-[#D4A017]/25 hover:scale-[1.03] min-h-[48px] text-sm flex items-center"
              >
                <span className="relative z-10">Explorar productos</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </a>
              <a
                href="/comerciante/ingresar"
                className="border border-white/20 text-white/85 hover:text-white hover:border-white/40 font-medium px-7 py-3.5 rounded-full transition-all duration-200 hover:bg-white/5 min-h-[48px] text-sm backdrop-blur-sm flex items-center"
              >
                Soy comerciante →
              </a>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-7 border-t border-white/10">
              {[
                { valor: '6+', label: 'Productos' },
                { valor: '4', label: 'Productores' },
                { valor: '100%', label: 'Auténtico' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-3xl text-white font-bold" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
                    {s.valor}
                  </p>
                  <p className="text-white/40 text-xs tracking-wide uppercase mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Columna collage (desktop) ─────────────────── */}
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {COLLAGE.map((foto, idx) => (
              <figure
                key={foto.etiqueta}
                className="relative rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/30"
                style={{ aspectRatio: '3 / 4' }}
              >
                <Image
                  src={foto.url}
                  alt={foto.alt}
                  fill
                  sizes="(max-width: 1024px) 0px, 25vw"
                  className="object-cover"
                  priority={idx < 2}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <figcaption className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="text-white text-sm font-semibold drop-shadow">{foto.etiqueta}</span>
                  <span className="bg-[#D4A017] text-[#1A1A1A] text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {foto.precio}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* ─── Tira horizontal (mobile/tablet) ───────────── */}
          <div
            className="lg:hidden -mx-4 px-4 flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none' } as React.CSSProperties}
          >
            {COLLAGE.map((foto, idx) => (
              <figure
                key={foto.etiqueta}
                className="relative flex-shrink-0 w-40 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-xl"
                style={{ aspectRatio: '3 / 4' }}
              >
                <Image
                  src={foto.url}
                  alt={foto.alt}
                  fill
                  sizes="160px"
                  className="object-cover"
                  priority={idx === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <figcaption className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                  <span className="text-white text-xs font-semibold drop-shadow truncate">{foto.etiqueta}</span>
                  <span className="bg-[#D4A017] text-[#1A1A1A] text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {foto.precio}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
