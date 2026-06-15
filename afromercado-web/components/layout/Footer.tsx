import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#2D6A4F] text-white mt-auto">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="flex flex-col md:flex-row md:justify-between gap-6 text-center md:text-left">

          {/* Logo y tagline */}
          <div>
            <p className="text-2xl mb-2" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              <span className="text-white">Afro</span>
              <span className="text-[#D4A017]">Mercado</span>
            </p>
            <p className="text-white/70 text-sm italic">Del Chocó para el mundo</p>
          </div>

          {/* Links */}
          <div className="flex flex-col md:flex-row gap-4 items-center md:items-end text-sm text-white/70">
            <Link href="/terminos" className="hover:text-white transition-colors min-h-[44px] flex items-center">Términos</Link>
            <Link href="/privacidad" className="hover:text-white transition-colors min-h-[44px] flex items-center">Privacidad</Link>
            <Link href="/contacto" className="hover:text-white transition-colors min-h-[44px] flex items-center">Contacto</Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/20 text-center text-xs text-white/50">
          © 2026 AfroMercado. Hecho con amor en el Chocó.
        </div>
      </div>
    </footer>
  )
}
