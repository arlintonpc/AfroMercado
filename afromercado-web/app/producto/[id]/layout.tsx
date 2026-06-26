import type { Metadata } from 'next'

const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3001/api'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  try {
    const res = await fetch(`${API}/productos/${id}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error('not found')
    const json = await res.json() as {
      producto?: {
        nombre?:      string
        descripcion?: string
        imagenes?:    ({ url?: string } | string)[]
        fotoUrl?:     string | null
        videoPosterUrl?: string | null
      }
      data?: {
        nombre?:      string
        descripcion?: string
        imagenes?:    ({ url?: string } | string)[]
        fotoUrl?:     string | null
        videoPosterUrl?: string | null
      }
    }
    const p = json.producto ?? json.data ?? {}
    const nombre      = p.nombre ?? 'Producto artesanal'
    const descripcion = (p.descripcion ?? 'Descubre productos artesanales del Chocó en AfroMercado.').slice(0, 160)

    const imagenRaw = p.imagenes?.[0]
    const imagen = imagenRaw
      ? (typeof imagenRaw === 'string' ? imagenRaw : imagenRaw.url ?? null)
      : p.videoPosterUrl ?? p.fotoUrl ?? null

    return {
      title:       `${nombre} — AfroMercado`,
      description: descripcion,
      openGraph: {
        title:       `${nombre} — AfroMercado`,
        description: descripcion,
        url:         `${SITE}/producto/${id}`,
        siteName:    'AfroMercado',
        type:        'website',
        ...(imagen ? { images: [{ url: imagen, width: 800, height: 600, alt: nombre }] } : {}),
      },
      twitter: {
        card:        imagen ? 'summary_large_image' : 'summary',
        title:       `${nombre} — AfroMercado`,
        description: descripcion,
        ...(imagen ? { images: [imagen] } : {}),
      },
    }
  } catch {
    return {
      title:       'Producto — AfroMercado',
      description: 'Descubre productos artesanales del Chocó en AfroMercado.',
    }
  }
}

export default function ProductoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
