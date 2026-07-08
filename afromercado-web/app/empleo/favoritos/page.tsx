'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'
import {
  misFavoritosEmpleo,
  misPostulacionesEmpleo,
  obtenerMiHojaDeVida,
  type OfertaEmpleo,
  type PostulacionEmpleo,
} from '@/lib/api/empleo'
import TarjetaOfertaEmpleo from '@/components/empleo/TarjetaOfertaEmpleo'

export default function PaginaFavoritosEmpleo() {
  const router = useRouter()
  const { usuario, autenticado, cargando: cargandoAuth } = useAuth()
  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([])
  const [cargando, setCargando] = useState(true)
  const [misPostulaciones, setMisPostulaciones] = useState<Map<number, PostulacionEmpleo>>(new Map())
  const [tieneHojaDeVida, setTieneHojaDeVida] = useState<boolean | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/empleo/favoritos')
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    misFavoritosEmpleo().then(setOfertas).catch(() => {}).finally(() => setCargando(false))
    misPostulacionesEmpleo()
      .then((lista) => setMisPostulaciones(new Map(lista.map((p) => [p.ofertaEmpleoId, p]))))
      .catch(() => {})
    obtenerMiHojaDeVida().then((h) => setTieneHojaDeVida(!!h)).catch(() => setTieneHojaDeVida(false))
  }, [autenticado, cargandoAuth])

  function alternarFavorito(id: number, favorito: boolean) {
    if (!favorito) {
      setOfertas((prev) => prev.filter((o) => o.id !== id))
    }
  }

  if (cargandoAuth || cargando) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-8 pb-12">
        <Link href="/empleo" className="text-xs text-[#2D6A4F] hover:underline">← Volver a empleo</Link>
        <h1 className="text-3xl text-[#1A1A1A] mt-2 mb-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Empleos favoritos
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-6">{ofertas.length} {ofertas.length === 1 ? 'oferta guardada' : 'ofertas guardadas'}</p>

        {ofertas.length === 0 ? (
          <EmptyState titulo="Sin favoritos aún" descripcion="Guarda ofertas tocando el corazón para revisarlas después." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ofertas.map((o) => (
              <TarjetaOfertaEmpleo
                key={o.id}
                oferta={o}
                usuarioId={usuario?.id}
                postulacion={misPostulaciones.get(o.id)}
                tieneHojaDeVida={tieneHojaDeVida}
                onPostulado={(p) => setMisPostulaciones((prev) => new Map(prev).set(o.id, p))}
                autenticado={autenticado}
                esFavorito
                onToggleFavorito={alternarFavorito}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
