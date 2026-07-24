import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
const OG_LOGO = `${SITE}/og-logo.png`

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ publicacion?: string }>
}): Promise<Metadata> {
  const resolvedParams = await searchParams
  const publicacionId = resolvedParams?.publicacion

  if (publicacionId) {
    try {
      const res = await fetch(`${API}/cultura/publicaciones/${publicacionId}`, {
        next: { revalidate: 60 },
      })
      if (res.ok) {
        const json = await res.json()
        const pub = json.data || json.publicacion || json
        if (pub) {
          const titulo = pub.titulo || pub.producto?.nombre || pub.comercio?.nombre || 'Publicación Territorial'
          const municipio = pub.municipio || pub.comercio?.municipio || 'Chocó'
          const comercio = pub.comercio?.nombre || pub.autor?.nombre || 'Teravia'
          const descripcionRaw = pub.descripcion || `Mira esta publicación de ${comercio} en ${municipio} a través de Teravia.`
          const descripcion = `${comercio} · ${municipio} — ${descripcionRaw}`.slice(0, 160)
          const imagen = pub.fotoUrl || pub.videoPosterUrl || pub.producto?.fotoUrl || pub.comercio?.logoUrl || OG_LOGO
          const shareUrl = `${SITE}/vitrina?publicacion=${publicacionId}`

          return {
            title: `${titulo} — ${comercio} | Teravia`,
            description: descripcion,
            openGraph: {
              title: `${titulo} — ${comercio} | Teravia`,
              description: descripcion,
              url: shareUrl,
              siteName: 'Teravia',
              type: 'article',
              images: [
                {
                  url: imagen,
                  width: 1200,
                  height: 630,
                  alt: titulo,
                },
              ],
            },
            twitter: {
              card: 'summary_large_image',
              title: `${titulo} — ${comercio} | Teravia`,
              description: descripcion,
              images: [imagen],
            },
            alternates: {
              canonical: shareUrl,
            },
          }
        }
      }
    } catch {
      // Fallback a metadata estática si falla la consulta
    }
  }

  return {
    title: 'Vitrina cultural — Comparte tu territorio | Teravia',
    description:
      'Feed social de historias, fotos y videos de comunidades afro, indígenas y campesinas de Colombia. Sigue personas y descubre la cultura viva de cada región.',
    openGraph: {
      title: 'Vitrina cultural | Teravia',
      description:
        'Historias, fotos y videos de la cultura viva de comunidades locales en todo el territorio colombiano.',
      type: 'website',
      url: `${SITE}/vitrina`,
      images: [
        {
          url: OG_LOGO,
          width: 1200,
          height: 630,
          alt: 'Vitrina Cultural Teravia',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Vitrina cultural | Teravia',
      description:
        'Historias, fotos y videos de la cultura viva de comunidades locales en todo el territorio colombiano.',
      images: [OG_LOGO],
    },
    alternates: {
      canonical: `${SITE}/vitrina`,
    },
  }
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
