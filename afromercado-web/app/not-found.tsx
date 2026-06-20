import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center px-4 text-center">
      <p
        className="text-8xl font-bold text-[#2D6A4F]/20 select-none"
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        404
      </p>
      <h1
        className="text-2xl text-[#1A1A1A] mt-4"
        style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
      >
        Página no encontrada
      </h1>
      <p className="text-sm text-[#1A1A1A]/55 mt-2 max-w-sm">
        La dirección que buscas no existe o fue movida. Regresa al inicio para explorar el marketplace.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
      >
        Ir al inicio
      </Link>
    </div>
  )
}
