import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/tours/${params.id}`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error()
    const { data } = await res.json()
    const foto = data.fotos?.[0]

    return {
      title: `${data.nombre} — Tour en ${data.comercio.municipio} | AfroMercado`,
      description: [
        data.descripcion?.slice(0, 120),
        `${data.duracionHoras}h · Desde $${Number(data.precioPersona).toLocaleString('es-CO')}/persona.`,
      ].filter(Boolean).join(' '),
      openGraph: {
        title: `${data.nombre} — ${data.comercio.municipio}`,
        description: data.descripcion?.slice(0, 160) ?? `Tour en ${data.comercio.municipio}, Chocó`,
        images: foto ? [{ url: foto, width: 800, height: 600 }] : [],
        type: 'website',
      },
    }
  } catch {
    return { title: 'Tour | AfroMercado' }
  }
}

export default function TourLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
