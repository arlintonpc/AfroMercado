import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#2D6A4F] text-white mt-auto">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">

          {/* Logo y tagline */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-2xl mb-2" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              <span className="text-white">Afro</span>
              <span className="text-[#D4A017]">Mercado</span>
            </p>
            <p className="text-white/70 text-sm italic">Del Chocó para toda Colombia</p>
          </div>

          {/* Turismo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">Turismo</p>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <Link href="/hoteles" className="hover:text-white transition-colors">🏨 Hoteles</Link>
              <Link href="/tours" className="hover:text-white transition-colors">🗺️ Tours</Link>
              <Link href="/transportes" className="hover:text-white transition-colors">🛥️ Transporte</Link>
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">Marketplace</p>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <Link href="/buscar" className="hover:text-white transition-colors">Productos</Link>
              <Link href="/express" className="hover:text-white transition-colors">Express</Link>
              <Link href="/ser-repartidor" className="hover:text-[#D4A017] transition-colors font-medium text-[#D4A017]/90">Sé repartidor</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">Legal</p>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <Link href="/terminos" className="hover:text-white transition-colors">Términos de uso</Link>
              <Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
              <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
              <Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link>
              <Link href="/certificacion" className="hover:text-[#A7F3D0] transition-colors">✅ Productor Certificado</Link>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/20 text-center text-xs text-white/50">
          © 2026 AfroMercado. Nacido en el Chocó, hecho para toda Colombia.
        </div>
      </div>
    </footer>
  )
}
