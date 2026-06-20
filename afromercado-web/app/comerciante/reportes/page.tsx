'use client'

import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const CARDS = [
  {
    href: '/comerciante/reportes/ventas',
    emoji: '💰',
    titulo: 'Reporte de ventas',
    descripcion: 'Historial completo de tus ventas, filtros por fecha y exportación a Excel.',
    color: 'from-[#2D6A4F]/10 to-[#52B788]/5',
    border: 'border-[#52B788]/30',
  },
  {
    href: '/comerciante/reportes/productos',
    emoji: '📦',
    titulo: 'Reporte de productos',
    descripcion: 'Rendimiento por producto: unidades vendidas, vistas, conversión y stock.',
    color: 'from-[#D4A017]/10 to-[#D4A017]/5',
    border: 'border-[#D4A017]/30',
  },
  {
    href: '/comerciante/reportes/resenas',
    emoji: '⭐',
    titulo: 'Reseñas de productos',
    descripcion: 'Calificaciones que tus compradores dejaron en cada producto.',
    color: 'from-amber-500/10 to-amber-400/5',
    border: 'border-amber-400/30',
  },
]

export default function ReportesHubPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-10">
        <Link
          href="/comerciante/dashboard"
          className="text-xs text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors"
        >
          ← Panel
        </Link>
        <h1
          className="text-3xl text-[#1A1A1A] mt-1 mb-1"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Reportes
        </h1>
        <p className="text-sm text-[#1A1A1A]/50 mb-8">
          Analiza el desempeño de tu tienda en detalle.
        </p>

        <div className="flex flex-col gap-4">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`bg-gradient-to-br ${card.color} border ${card.border} rounded-3xl p-6 flex items-start gap-5 hover:shadow-md transition-shadow group`}
            >
              <span className="text-4xl flex-shrink-0">{card.emoji}</span>
              <div>
                <p className="text-base font-bold text-[#1A1A1A] group-hover:text-[#2D6A4F] transition-colors">
                  {card.titulo}
                </p>
                <p className="text-sm text-[#1A1A1A]/55 mt-0.5">{card.descripcion}</p>
              </div>
              <svg
                className="ml-auto flex-shrink-0 text-[#1A1A1A]/25 group-hover:text-[#2D6A4F] transition-colors mt-0.5"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
