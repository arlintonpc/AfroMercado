'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import { crearComercioConSesion, obtenerMiComercio, type TipoDocumento } from '@/components/comerciante/api'
import { useAuth } from '@/context/AuthContext'
import { TOKEN_KEY } from '@/lib/api/client'

const TIPOS_DOCUMENTO: { valor: TipoDocumento; etiqueta: string }[] = [
  { valor: 'CC', etiqueta: 'Cédula de Ciudadanía (CC)' },
  { valor: 'TI', etiqueta: 'Tarjeta de Identidad (TI)' },
  { valor: 'CE', etiqueta: 'Cédula de Extranjería (CE)' },
  { valor: 'PEP', etiqueta: 'Permiso Especial de Permanencia (PEP)' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
  { valor: 'NIT', etiqueta: 'NIT (empresa)' },
]

export default function RegistroComercioPage() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth, usuario, actualizarUsuario } = useAuth()

  const [verificando, setVerificando] = useState(true)
  const [listo, setListo] = useState(false)

  const [nombre, setNombre] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | ''>('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [historia, setHistoria] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/comerciante/registro-comercio')
    }
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
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
  }, [cargandoAuth, autenticado, router])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'Escribe el nombre de tu negocio.'
    if (!departamento) e.departamento = 'Elige tu departamento.'
    if (!municipio) e.municipio = 'Elige tu municipio.'
    if (!tipoDocumento) e.tipoDocumento = 'Elige el tipo de documento.'
    if (!numeroDocumento.trim()) e.numeroDocumento = 'Escribe tu número de documento.'
    else if (!/^[A-Z0-9\-]{4,20}$/i.test(numeroDocumento.trim()))
      e.numeroDocumento = 'El número de documento debe tener entre 4 y 20 caracteres.'
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
      const { token } = await crearComercioConSesion({
        nombre: nombre.trim(),
        departamento,
        municipio,
        tipoDocumento: tipoDocumento as TipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        descripcion: descripcion.trim() || undefined,
        historia: historia.trim() || undefined,
        whatsapp: whatsapp.replace(/\D/g, '') || undefined,
      })

      // Actualiza la sesión sin pedir volver a entrar: guarda el token nuevo
      // (firmado ya con el rol COMERCIANTE) y fusiona el rol en el usuario
      // que YA está cargado en el contexto, sin reconstruirlo desde la
      // respuesta del backend (que no trae email/avatarUrl/etc).
      try {
        window.localStorage.setItem(TOKEN_KEY, token)
      } catch {
        // localStorage no disponible: la sesión seguirá viva en memoria.
      }
      if (usuario) {
        actualizarUsuario({ ...usuario, rol: 'COMERCIANTE' })
      }

      setListo(true)
    } catch (err) {
      setErrorGeneral(
        err instanceof Error
          ? err.message
          : 'No pudimos guardar tu tienda. Intenta de nuevo.',
      )
      setEnviando(false)
    }
  }

  if (cargandoAuth || verificando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-base text-[#1A1A1A]/55">Un momento…</p>
      </div>
    )
  }

  if (listo) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-[#52B788]/30 bg-[#52B788]/10 px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D6A4F] text-white text-2xl">
            ✓
          </div>
          <h2
            className="text-2xl font-bold text-[#2D6A4F]"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            ¡Tu tienda ya está lista!
          </h2>
          <p className="mt-2 text-[#1A1A1A]/60 text-sm max-w-sm mx-auto">
            Ya puedes publicar tu primer producto y empezar a vender en AfroMercado.
          </p>
          <Link href="/comerciante/publicar" className="mt-5 inline-block">
            <Button size="lg">Publicar mi primer producto</Button>
          </Link>
          <div className="mt-4">
            <Link
              href="/comerciante/dashboard"
              className="text-sm font-semibold text-[#2D6A4F] underline"
            >
              Ver mi panel más tarde
            </Link>
          </div>
        </div>
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
          label="¿En qué departamento estás?"
          name="departamento"
          placeholder="Elige tu departamento"
          value={departamento}
          onChange={(v) => {
            setDepartamento(v)
            setMunicipio('')
          }}
          opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
          error={errores.departamento}
        />

        <CampoSelect
          label="¿En qué municipio estás?"
          name="municipio"
          placeholder={departamento ? 'Elige tu municipio' : 'Primero elige el departamento'}
          value={municipio}
          onChange={setMunicipio}
          opciones={municipiosDe(departamento).map((m) => ({ valor: m, etiqueta: m }))}
          error={errores.municipio}
        />

        {/* Separador de identidad */}
        <div className="border-t border-[#1A1A1A]/8 pt-1">
          <p className="text-sm font-semibold text-[#1A1A1A]/70 mb-4">
            Verificación de identidad
          </p>

          <div className="flex flex-col gap-5">
            <CampoSelect
              label="Tipo de documento"
              name="tipoDocumento"
              placeholder="Elige el tipo"
              value={tipoDocumento}
              onChange={(v) => setTipoDocumento(v as TipoDocumento | '')}
              opciones={TIPOS_DOCUMENTO}
              error={errores.tipoDocumento}
            />

            <CampoTexto
              label="Número de documento"
              name="numeroDocumento"
              placeholder="Ej: 1234567890"
              value={numeroDocumento}
              onChange={setNumeroDocumento}
              error={errores.numeroDocumento}
              hint="Tal como aparece en tu documento de identidad."
            />
          </div>
        </div>

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
