import type { Metadata } from 'next'
import { API_URL, SITE_URL, normalizarUrlMediaAbsoluta } from '@/lib/api/client'

const API = API_URL
const SITE = SITE_URL
const OG_LOGO = `${SITE_URL}/og-logo.png`

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ publicacion?: string }>
}): Promise<Metadata> {
  const resolvedParams = await searchParams
  const publicacionId = resolvedParams?.publicacion

  if (publicacionId) {
    try {
      const res = await fetch(`${API_URL}/cultura/publicaciones/${publicacionId}`, {
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
          
          const imagenRaw = pub.fotoUrl || pub.videoPosterUrl || pub.fotoUrls?.[0] || pub.producto?.fotoUrl || pub.comercio?.logoUrl
          const imagenAbsoluta = normalizarUrlMediaAbsoluta(imagenRaw, OG_LOGO)
          const videoAbsoluto = pub.videoUrl ? normalizarUrlMediaAbsoluta(pub.videoUrl) : null
          const shareUrl = `${SITE_URL}/vitrina?publicacion=${publicacionId}`

          return {
            title: `${titulo} — ${comercio} | Teravia`,
            description: descripcion,
            openGraph: {
              title: `${titulo} — ${comercio} | Teravia`,
              description: descripcion,
              url: shareUrl,
              siteName: 'Teravia',
              type: videoAbsoluto ? 'video.other' : 'article',
              images: [
                {
                  url: imagenAbsoluta,
                  width: 1200,
                  height: 630,
                  alt: titulo,
                },
              ],
              ...(videoAbsoluto
                ? {
                    videos: [
                      {
                        url: videoAbsoluto,
                        width: 1280,
                        height: 720,
                        type: 'video/mp4',
                      },
                    ],
                  }
                : {}),
            },
            twitter: {
              card: 'summary_large_image',
              title: `${titulo} — ${comercio} | Teravia`,
              description: descripcion,
              images: [imagenAbsoluta],
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
      url: `${SITE_URL}/vitrina`,
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
      canonical: `${SITE_URL}/vitrina`,
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
