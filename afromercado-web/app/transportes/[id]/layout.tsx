import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/transportes/${params.id}`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error()
    const { data } = await res.json()
    const foto = data.fotos?.[0]
    const rutas = data.rutas?.filter((r: any) => r.activo) ?? []

    return {
      title: `${data.nombre} — Transporte fluvial en ${data.comercio.municipio} | AfroMercado`,
      description: [
        data.descripcion?.slice(0, 120),
        rutas.length > 0 ? `${rutas.length} ruta${rutas.length !== 1 ? 's' : ''} disponible${rutas.length !== 1 ? 's' : ''}.` : null,
      ].filter(Boolean).join(' '),
      openGraph: {
        title: `${data.nombre} — ${data.comercio.municipio}`,
        description: data.descripcion?.slice(0, 160) ?? `Transporte fluvial en ${data.comercio.municipio}, Chocó`,
        images: foto ? [{ url: foto, width: 800, height: 600 }] : [],
        type: 'website',
      },
    }
  } catch {
    return { title: 'Transporte | AfroMercado' }
  }
}

export default function TransporteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
