'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { misFavoritosCultura, type EventoCultural } from '@/lib/api/cultura'
import TarjetaEventoCultural from '@/components/cultura/TarjetaEventoCultural'
import {
  CulturaHero,
  CulturaPageContainer,
  CulturaShell,
  CulturaSkeletonGrid,
  CulturaStateCard,
} from '@/components/cultura/CulturaUI'

export default function FavoritosCulturaPage() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [eventos, setEventos] = useState<EventoCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/cultura/favoritos')
  }, [cargandoAuth, autenticado, router])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setEventos(await misFavoritosCultura())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar tus favoritos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    cargar()
  }, [autenticado, cargandoAuth, cargar])

  function manejarFavoritoCambio(eventoId: number, esFavorito: boolean) {
    if (esFavorito) return
    setEventos((prev) => prev.filter((ev) => ev.id !== eventoId))
  }

  if (cargandoAuth || (cargando && autenticado)) {
    return (
      <CulturaShell>
        <CulturaPageContainer className="space-y-6">
          <CulturaSkeletonGrid items={3} />
        </CulturaPageContainer>
      </CulturaShell>
    )
  }

  if (!autenticado) return null

  return (
    <CulturaShell>
      <CulturaPageContainer className="space-y-6">
        <CulturaHero
          eyebrow="Cultura"
          title="Tus eventos favoritos"
          description="Los eventos culturales que guardaste para no perderlos de vista."
        />

        {error ? (
          <CulturaStateCard
            tone="error"
            icon="⚠️"
            title="No pudimos cargar tus favoritos"
            description={error}
            action={
              <button onClick={cargar} className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]">
                Reintentar
              </button>
            }
          />
        ) : eventos.length === 0 ? (
          <CulturaStateCard
            icon="🎭"
            title="Aún no tienes favoritos"
            description="Toca el corazón en cualquier evento de la agenda para guardarlo aquí."
            action={
              <Link href="/cultura" className="inline-block rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245a42]">
                Ver la agenda cultural
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {eventos.map((ev) => (
              <TarjetaEventoCultural
                key={ev.id}
                ev={ev}
                esFavorito
                onFavoritoChange={manejarFavoritoCambio}
              />
            ))}
          </div>
        )}
      </CulturaPageContainer>
    </CulturaShell>
  )
}
