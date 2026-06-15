'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { MUNICIPIOS_CHOCO } from '@/components/comerciante/constantes'
import { crearComercio, obtenerMiComercio } from '@/components/comerciante/api'

export default function RegistroComercioPage() {
  const router = useRouter()

  const [verificando, setVerificando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [historia, setHistoria] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Si ya tiene comercio, no debe quedarse aquí: lo enviamos al panel.
  useEffect(() => {
    let activo = true
    obtenerMiComercio()
      .then((c) => {
        if (!activo) return
        if (c) router.replace('/comerciante/dashboard')
        else setVerificando(false)
      })
      .catch(() => {
        if (activo) setVerificando(false)
      })
    return () => {
      activo = false
    }
  }, [router])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'Escribe el nombre de tu negocio.'
    if (!municipio) e.municipio = 'Elige tu municipio.'
    if (whatsapp) {
      const tel = whatsapp.replace(/\D/g, '')
      if (tel.length !== 10) e.whatsapp = 'El WhatsApp debe tener 10 números.'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function manejarSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setErrorGeneral(null)
    if (enviando) return
    if (!validar()) return

    setEnviando(true)
    try {
      await crearComercio({
        nombre: nombre.trim(),
        municipio,
        descripcion: descripcion.trim() || undefined,
        historia: historia.trim() || undefined,
        whatsapp: whatsapp.replace(/\D/g, '') || undefined,
      })
      router.replace('/comerciante/dashboard')
    } catch (err) {
      setErrorGeneral(
        err instanceof Error
          ? err.message
          : 'No pudimos guardar tu tienda. Intenta de nuevo.',
      )
      setEnviando(false)
    }
  }

  if (verificando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-base text-[#1A1A1A]/55">Un momento…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6">
        <h1
          className="text-3xl text-[#2D6A4F] leading-tight"
          style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
        >
          Cuéntanos de tu negocio
        </h1>
        <p className="mt-2 text-base text-[#1A1A1A]/65 leading-relaxed">
          Así los compradores te van a conocer. Solo te tomará un minuto.
        </p>
      </div>

      <form
        onSubmit={manejarSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm"
        noValidate
      >
        <CampoTexto
          label="Nombre de tu negocio"
          name="nombre"
          placeholder="Ej: Frutas Doña Rosa"
          value={nombre}
          onChange={setNombre}
          error={errores.nombre}
        />

        <CampoSelect
          label="¿En qué municipio estás?"
          name="municipio"
          placeholder="Elige tu municipio"
          value={municipio}
          onChange={setMunicipio}
          opciones={MUNICIPIOS_CHOCO.map((m) => ({ valor: m, etiqueta: m }))}
          error={errores.municipio}
        />

        <CampoTexto
          label="Una frase sobre tu negocio"
          name="descripcion"
          placeholder="Ej: Frutas frescas del campo"
          value={descripcion}
          onChange={setDescripcion}
          hint="Opcional. Algo corto que diga qué vendes."
        />

        <CampoArea
          label="Tu historia"
          name="historia"
          rows={5}
          placeholder="Cuéntale al comprador quién eres y cómo cultivas o elaboras tus productos."
          value={historia}
          onChange={setHistoria}
          hint="Opcional, pero ayuda a que confíen en ti y te compren más."
        />

        <CampoTexto
          label="Tu WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="numeric"
          placeholder="300 123 4567"
          value={whatsapp}
          onChange={setWhatsapp}
          error={errores.whatsapp}
          hint="Opcional. Para que los compradores te escriban."
        />

        {errorGeneral && (
          <div
            role="alert"
            className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
          >
            {errorGeneral}
          </div>
        )}

        <Button type="submit" size="lg" loading={enviando} className="w-full">
          Guardar mi tienda
        </Button>
      </form>
    </div>
  )
}
