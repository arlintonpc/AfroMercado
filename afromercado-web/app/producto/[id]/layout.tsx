import type { Metadata } from 'next'

const API      = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3001/api'
const SITE     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://afromercado.vercel.app'
const OG_LOGO  = `${SITE}/og-logo.png`

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
        precio?:      string | number
        unidad?:      string
        imagenes?:    ({ url?: string } | string)[]
        fotoUrl?:     string | null
        videoPosterUrl?: string | null
        comercio?: { nombre?: string; municipio?: string }
      }
      data?: {
        nombre?:      string
        descripcion?: string
        precio?:      string | number
        unidad?:      string
        imagenes?:    ({ url?: string } | string)[]
        fotoUrl?:     string | null
        videoPosterUrl?: string | null
        comercio?: { nombre?: string; municipio?: string }
      }
    }
    const p = json.producto ?? json.data ?? {}
    const nombre   = p.nombre ?? 'Producto artesanal'
    const comercio = p.comercio?.nombre ?? 'AfroMercado'
    const municipio = p.comercio?.municipio ?? 'Chocó'
    const unidadLabel: Record<string, string> = {
      UNIDAD: 'unidad', KG: 'kg', PAQUETE: 'paquete', LITRO: 'litro', GRAMO: 'gramo'
    }
    const precioNum = p.precio ? Number(p.precio) : null
    const precioStr = precioNum
      ? `$${precioNum.toLocaleString('es-CO')}/${unidadLabel[p.unidad ?? ''] ?? 'unidad'}`
      : null
    const descripcionBase = p.descripcion?.trim()
    const descripcion = (
      descripcionBase
        ? `${precioStr ? precioStr + ' · ' : ''}${descripcionBase}`
        : `${precioStr ? precioStr + ' · ' : ''}${comercio} · ${municipio}, Chocó · Del Chocó para el mundo`
    ).slice(0, 160)

    const imagenRaw = p.imagenes?.[0]
    const imagenProducto = imagenRaw
      ? (typeof imagenRaw === 'string' ? imagenRaw : imagenRaw.url ?? null)
      : p.videoPosterUrl ?? p.fotoUrl ?? null
    const imagen = imagenProducto ?? OG_LOGO

    return {
      title:       `${nombre} · ${comercio} — AfroMercado`,
      description: descripcion,
      openGraph: {
        title:       `${nombre} · ${comercio} — AfroMercado`,
        description: descripcion,
        url:         `${SITE}/producto/${id}`,
        siteName:    'AfroMercado',
        type:        'website',
        images: [{ url: imagen, width: 800, height: 600, alt: nombre }],
      },
      twitter: {
        card:        'summary_large_image',
        title:       `${nombre} · ${comercio} — AfroMercado`,
        description: descripcion,
        images:      [imagen],
      },
    }
  } catch {
    return {
      title:       'Producto — AfroMercado',
      description: 'Descubre productos artesanales del Chocó en AfroMercado.',
      openGraph: {
        title:    'Producto — AfroMercado',
        siteName: 'AfroMercado',
        images:   [{ url: OG_LOGO, width: 800, height: 600, alt: 'AfroMercado' }],
      },
    }
  }
}

export default function ProductoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
