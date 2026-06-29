import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export const metadata: Metadata = {
  title: 'Tours culturales y naturales en el Chocó | AfroMercado',
  description:
    'Descubre tours guiados por el Chocó: selva, ríos, playas y cultura afrocolombiana. Reserva directamente con comunidades locales en Quibdó, Nuquí, Bahía Solano y más.',
  openGraph: {
    title: 'Tours en el Chocó | AfroMercado',
    description:
      'Explora el Pacífico colombiano con guías locales. Naturaleza, cultura y aventura en tours auténticos del Chocó.',
    type: 'website',
    url: `${SITE}/tours`,
  },
  alternates: {
    canonical: `${SITE}/tours`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE}/tours`,
  name: 'Tours culturales y naturales en el Chocó',
  description:
    'Catálogo de tours guiados ofrecidos por operadores locales en el departamento del Chocó, Colombia.',
  url: `${SITE}/tours`,
  isPartOf: { '@id': SITE },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Tours',  item: `${SITE}/tours` },
    ],
  },
}

export default function ToursLayout({ children }: { children: React.ReactNode }) {
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
