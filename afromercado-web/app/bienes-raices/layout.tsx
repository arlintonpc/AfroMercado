import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export const metadata: Metadata = {
  title: 'Bienes raíces formalizados en Colombia | Teravia',
  description:
    'Vitrina de predios, casas y lotes formalizados en comunidades de todo el país. Contacta directamente al propietario, sin intermediarios.',
  openGraph: {
    title: 'Bienes raíces en Colombia | Teravia',
    description:
      'Predios formalizados de comunidades locales: casas, lotes y fincas con documentación en regla en cada región de Colombia.',
    type: 'website',
    url: `${SITE}/bienes-raices`,
  },
  alternates: {
    canonical: `${SITE}/bienes-raices`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE}/bienes-raices`,
  name: 'Bienes raíces formalizados en Colombia',
  description:
    'Catálogo de predios, casas y lotes formalizados publicados por comunidades locales en departamentos y municipios de toda Colombia.',
  url: `${SITE}/bienes-raices`,
  isPartOf: { '@id': SITE },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Bienes raíces', item: `${SITE}/bienes-raices` },
    ],
  },
}

export default function BienesRaicesLayout({ children }: { children: React.ReactNode }) {
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
