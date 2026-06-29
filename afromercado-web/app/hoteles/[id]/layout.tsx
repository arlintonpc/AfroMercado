import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://afromercado-api.onrender.com/api'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/hoteles/${params.id}`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error()
    const { data } = await res.json()
    const foto = data.habitaciones?.[0]?.fotos?.[0]
    const desde = data.habitaciones?.length > 0
      ? Math.min(...data.habitaciones.map((h: any) => Number(h.precioPorNoche)))
      : null

    return {
      title: `${data.comercio.nombre} — Hotel en ${data.comercio.municipio} | AfroMercado`,
      description: [
        data.comercio.descripcion?.slice(0, 120),
        desde ? `Desde $${desde.toLocaleString('es-CO')}/noche.` : null,
        `${data.habitaciones?.length ?? 0} tipo${data.habitaciones?.length !== 1 ? 's' : ''} de habitación.`,
      ].filter(Boolean).join(' '),
      openGraph: {
        title: `${data.comercio.nombre} — ${data.comercio.municipio}`,
        description: data.comercio.descripcion?.slice(0, 160) ?? `Hotel en ${data.comercio.municipio}, Chocó`,
        images: foto ? [{ url: foto, width: 800, height: 600 }] : [],
        type: 'website',
      },
    }
  } catch {
    return { title: 'Hotel | AfroMercado' }
  }
}

export default function HotelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
