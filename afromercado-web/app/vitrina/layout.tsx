import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export const metadata: Metadata = {
  title: 'Vitrina cultural — Comparte tu territorio | Teravia',
  description:
    'Feed social de historias, fotos y videos de comunidades afro, indígenas y campesinas de Colombia. Sigue personas y descubre la cultura viva de cada región.',
  openGraph: {
    title: 'Vitrina cultural | Teravia',
    description:
      'Historias, fotos y videos de la cultura viva de comunidades locales en todo el territorio colombiano.',
    type: 'website',
    url: `${SITE}/vitrina`,
  },
  alternates: {
    canonical: `${SITE}/vitrina`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE}/vitrina`,
  name: 'Vitrina cultural — Comparte tu territorio',
  description:
    'Feed social de publicaciones culturales compartidas por comunidades locales en departamentos y municipios de toda Colombia.',
  url: `${SITE}/vitrina`,
  isPartOf: { '@id': SITE },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Vitrina', item: `${SITE}/vitrina` },
    ],
  },
}

export default function VitrinaLayout({ children }: { children: React.ReactNode }) {
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
