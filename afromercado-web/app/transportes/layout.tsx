import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export const metadata: Metadata = {
  title: 'Transporte fluvial y terrestre en el Chocó | AfroMercado',
  description:
    'Encuentra servicios de transporte fluvial, marítimo y terrestre en el Chocó. Rutas entre Quibdó, Nuquí, Bahía Solano, Istmina y más destinos del Pacífico colombiano.',
  openGraph: {
    title: 'Transporte en el Chocó | AfroMercado',
    description:
      'Servicios de transporte locales para moverse por el Chocó: lanchas, pangas y rutas terrestres operadas por la comunidad.',
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
  name: 'Transporte fluvial y terrestre en el Chocó',
  description:
    'Catálogo de servicios de transporte ofrecidos por operadores locales en el departamento del Chocó, Colombia.',
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
