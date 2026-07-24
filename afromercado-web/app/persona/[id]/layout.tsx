import type { Metadata } from 'next'

const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'https://afromercado-api.onrender.com/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
const OG_LOGO = `${SITE}/og-logo.png`

interface PerfilPublicoData {
  nombre?:       string
  avatarUrl?:    string | null
  bio?:          string | null
  municipio?:    string | null
  departamento?: string | null
  totalSeguidores?: number
  totalPublicaciones?: number
}

interface Props {
  params: Promise<{ id: string }>
}

async function fetchPerfil(id: string): Promise<PerfilPublicoData | null> {
  try {
    const res = await fetch(`${API}/usuario/${id}/perfil`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const json = await res.json() as { ok?: boolean; data?: PerfilPublicoData }
    return json.data ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await fetchPerfil(id)

  if (!p?.nombre) {
    return {
      title: 'Perfil — Teravia',
      description: 'Descubre las historias y publicaciones de esta persona en Teravia.',
      openGraph: {
        title:    'Perfil — Teravia',
        siteName: 'Teravia',
        images:   [{ url: OG_LOGO, width: 800, height: 600, alt: 'Teravia' }],
      },
    }
  }

  const ubicacion = [p.municipio, p.departamento].filter(Boolean).join(', ') || 'Colombia'
  const descripcion = (
    p.bio?.trim() || `Perfil de ${p.nombre} en Teravia · ${ubicacion}`
  ).slice(0, 160)
  const imagen = p.avatarUrl ?? OG_LOGO

  return {
    title:       `${p.nombre} — Teravia`,
    description: descripcion,
    openGraph: {
      title:       `${p.nombre} — Teravia`,
      description: descripcion,
      url:         `${SITE}/persona/${id}`,
      siteName:    'Teravia',
      type:        'profile',
      images: [{ url: imagen, width: 800, height: 600, alt: p.nombre }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${p.nombre} — Teravia`,
      description: descripcion,
      images:      [imagen],
    },
  }
}

export default async function PersonaLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const p = await fetchPerfil(id)

  const jsonLd = p?.nombre ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${SITE}/persona/${id}`,
        name: `Perfil de ${p.nombre}`,
        url: `${SITE}/persona/${id}`,
        mainEntity: {
          '@type': 'Person',
          name: p.nombre,
          image: p.avatarUrl ?? undefined,
          description: p.bio ?? undefined,
          address: (p.municipio || p.departamento) ? {
            '@type': 'PostalAddress',
            addressLocality: p.municipio ?? undefined,
            addressRegion: p.departamento ?? undefined,
            addressCountry: 'CO',
          } : undefined,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Vitrina', item: `${SITE}/vitrina` },
          { '@type': 'ListItem', position: 3, name: p.nombre, item: `${SITE}/persona/${id}` },
        ],
      },
    ],
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
