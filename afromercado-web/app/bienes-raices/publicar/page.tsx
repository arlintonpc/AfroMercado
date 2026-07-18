'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import { crearInmueble, subirFotoInmueble, subirDocumentoSoporteInmueble } from '@/lib/api/bienes-raices'
import FormularioInmueble, { type DatosFormularioInmueble } from '@/components/bienes-raices/FormularioInmueble'

export default function PaginaPublicarInmueble() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [exito, setExito] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/bienes-raices/publicar')
  }, [cargandoAuth, autenticado, router])

  async function guardar(datos: DatosFormularioInmueble, fotos: File[], documento: File | null) {
    const inmueble = await crearInmueble(datos)
    if (fotos.length > 0) {
      await subirFotoInmueble(inmueble.id, fotos)
    }
    if (documento) {
      await subirDocumentoSoporteInmueble(inmueble.id, documento)
    }
    setExito(true)
  }

  if (exito) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-semibold text-[#1A1A1A]">¡Tu publicación fue enviada!</p>
            <p className="text-sm text-[#1A1A1A]/55 mt-1">
              Un administrador la revisará antes de que sea visible al público — normalmente toma entre 24 y 48 horas.
            </p>
            <button
              type="button"
              onClick={() => router.push('/bienes-raices/mis-publicaciones')}
              className="mt-5 inline-block rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors"
            >
              Ver mis publicaciones
            </button>
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
          Publicar predio
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-6">
          Publica una vitrina de tu predio formalizado. Un administrador revisará el documento de soporte antes de que quede visible. El contacto siempre es directo por WhatsApp — aquí no se procesan pagos ni transacciones.
        </p>

        <FormularioInmueble
          onGuardar={guardar}
          textoBoton="Enviar publicación para revisión"
          textoEnviando="Enviando…"
          mostrarArchivos
          documentoObligatorio
        />
      </main>
      <Footer />
    </div>
  )
}
