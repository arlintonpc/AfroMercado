'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import { crearOfertaEmpleo, cambiarEstadoOfertaEmpleo } from '@/lib/api/empleo'
import FormularioOferta, { type DatosFormularioOferta } from '@/components/empleo/FormularioOferta'

export default function PaginaPublicarEmpleo() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [exito, setExito] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/empleo/publicar')
  }, [cargandoAuth, autenticado, router])

  async function guardar(datos: DatosFormularioOferta) {
    const oferta = await crearOfertaEmpleo(datos)
    await cambiarEstadoOfertaEmpleo(oferta.id, 'PUBLICADA')
    setExito(true)
    setTimeout(() => router.push('/empleo/mis-ofertas'), 1500)
  }

  if (exito) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-semibold text-[#1A1A1A]">¡Oferta enviada!</p>
            <p className="text-sm text-[#1A1A1A]/55 mt-1">Un administrador la revisará antes de publicarla.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <h1 className="text-3xl text-[#1A1A1A] mb-1" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Publicar empleo o servicio
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-6">Tu publicación pasará por una breve revisión antes de quedar visible.</p>

        <FormularioOferta onGuardar={guardar} textoBoton="Publicar" textoEnviando="Publicando…" />
      </main>
      <Footer />
    </div>
  )
}
