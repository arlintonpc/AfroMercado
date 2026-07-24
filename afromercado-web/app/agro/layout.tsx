import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

export const metadata: Metadata = {
  title: 'Productos agro de Colombia | Teravia',
  description:
    'Compra productos agrícolas frescos y de origen directo: cacao, café, frutas y más, cultivados por comunidades de todo el país.',
  openGraph: {
    title: 'Agro en Colombia | Teravia',
    description:
      'Productos del campo colombiano vendidos directamente por productores locales en cada región del país.',
    type: 'website',
    url: `${SITE}/agro`,
  },
  alternates: {
    canonical: `${SITE}/agro`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE}/agro`,
  name: 'Productos agro de Colombia',
  description:
    'Catálogo de productos agrícolas ofrecidos por productores locales en departamentos y municipios de toda Colombia.',
  url: `${SITE}/agro`,
  isPartOf: { '@id': SITE },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Agro', item: `${SITE}/agro` },
    ],
  },
}

export default function AgroLayout({ children }: { children: React.ReactNode }) {
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
