import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export const metadata: Metadata = {
  title: 'Transporte fluvial y terrestre en Colombia | AfroMercado',
  description:
    'Encuentra servicios de transporte fluvial, marítimo y terrestre en toda Colombia. Rutas entre municipios operadas por comunidades locales.',
  openGraph: {
    title: 'Transporte en Colombia | AfroMercado',
    description:
      'Servicios de transporte locales para moverse por el territorio: lanchas, buses, chivas y rutas terrestres operadas por la comunidad.',
    type: 'website',
    url: `${SITE}/transportes`,
  },
  alternates: {
    canonical: `${SITE}/transportes`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE}/transportes`,
  name: 'Transporte fluvial y terrestre en Colombia',
  description:
    'Catálogo de servicios de transporte ofrecidos por operadores locales en departamentos y municipios de toda Colombia.',
  url: `${SITE}/transportes`,
  isPartOf: { '@id': SITE },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio',      item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Transportes', item: `${SITE}/transportes` },
    ],
  },
}

export default function TransportesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
