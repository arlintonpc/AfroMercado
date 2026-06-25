'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { MUNICIPIOS_CHOCO } from '@/components/comerciante/constantes'
import {
  obtenerMiComercio,
  actualizarComercio,
  subirDocumentoComercio,
  type Comercio,
} from '@/components/comerciante/api'
import { obtenerReglasPublicas } from '@/lib/api/config'

export default function PerfilComerciantePage() {
  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [cargando, setCargando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [historia, setHistoria] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [vereda, setVereda] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [envioGratisDesde, setEnvioGratisDesde] = useState('')
  const [envioGratisPermitido, setEnvioGratisPermitido] = useState(false)

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Foto documento
  const [fotoDocumentoUrl, setFotoDocumentoUrl] = useState<string | null>(null)
  const [subiendoDoc, setSubiendoDoc] = useState(false)
  const [errorDoc, setErrorDoc] = useState<string | null>(null)
  const inputDocRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    obtenerMiComercio()
      .then((c) => {
        if (!c) return
        setComercio(c)
        setNombre(c.nombre)
        setMunicipio(c.municipio)
        setDescripcion(c.descripcion ?? '')
        setHistoria(c.historia ?? '')
        setWhatsapp(c.whatsapp ?? '')
        setLogoUrl(c.logoUrl ?? '')
        setFotoDocumentoUrl(c.fotoDocumentoUrl ?? null)
        setVereda(c.vereda ?? '')
        setEnvioGratisDesde(c.envioGratisDesde != null ? String(Number(c.envioGratisDesde)) : '')
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    obtenerReglasPublicas()
      .then((r) => setEnvioGratisPermitido(r.envioGratisVendedorPermitido))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  function validar() {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!municipio) e.municipio = 'Elige el municipio.'
    if (whatsapp) {
      const tel = whatsapp.replace(/\D/g, '')
      if (tel.length !== 10) e.whatsapp = 'El WhatsApp debe tener 10 números.'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setGuardando(true)
    try {
      const actualizado = await actualizarComercio({
        nombre: nombre.trim(),
        municipio,
        descripcion: descripcion.trim() || undefined,
        historia: historia.trim() || undefined,
        whatsapp: whatsapp.replace(/\D/g, '') || undefined,
        vereda: vereda.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        ...(envioGratisPermitido
          ? { envioGratisDesde: envioGratisDesde.trim() ? Number(envioGratisDesde) : null }
          : {}),
      })
      setComercio(actualizado)
      setAviso({ tipo: 'exito', texto: 'Datos guardados correctamente.' })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  async function subirDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoDoc(true)
    setErrorDoc(null)
    try {
      const { url } = await subirDocumentoComercio(file)
      setFotoDocumentoUrl(url)
      setAviso({ tipo: 'exito', texto: 'Foto del documento subida.' })
    } catch (err) {
      setErrorDoc(err instanceof Error ? err.message : 'No se pudo subir el archivo.')
    } finally {
      setSubiendoDoc(false)
      if (inputDocRef.current) inputDocRef.current.value = ''
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[#1A1A1A]/50">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Mi tienda
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          Así te ven los compradores. Mantenlo actualizado.
        </p>
      </div>

      {aviso && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          aviso.tipo === 'exito'
            ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {aviso.texto}
        </div>
      )}

      {/* Estado de verificación */}
      {comercio && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm',
          comercio.estadoRegistro === 'APROBADO'
            ? 'border-[#52B788]/30 bg-[#52B788]/8 text-[#2D6A4F]'
            : comercio.estadoRegistro === 'PENDIENTE_REVISION'
            ? 'border-[#D4A017]/30 bg-[#D4A017]/8 text-[#9B7300]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {comercio.estadoRegistro === 'APROBADO' && '✓ Tu tienda está aprobada y visible en el catálogo.'}
          {comercio.estadoRegistro === 'PENDIENTE_REVISION' && '⏳ Tu tienda está en revisión. El equipo la aprobará pronto.'}
          {comercio.estadoRegistro === 'RECHAZADO' && `✗ Tu tienda fue rechazada. ${comercio.motivoRechazo ?? ''}`}
          {comercio.estadoRegistro === 'SUSPENDIDO' && '⚠ Tu tienda está suspendida. Contacta al equipo.'}
        </div>
      )}

      {/* Formulario principal */}
      <form onSubmit={guardar} className="flex flex-col gap-5 rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#1A1A1A]">Información del negocio</h2>

        <CampoTexto
          label="Nombre de tu negocio"
          name="nombre"
          value={nombre}
          onChange={setNombre}
          error={errores.nombre}
        />

        <CampoSelect
          label="Municipio"
          name="municipio"
          value={municipio}
          onChange={setMunicipio}
          opciones={MUNICIPIOS_CHOCO.map((m) => ({ valor: m, etiqueta: m }))}
          error={errores.municipio}
        />

        <CampoTexto
          label="Vereda o barrio"
          name="vereda"
          placeholder="Ej: Vereda La Vuelta, Barrio Kennedy"
          value={vereda}
          onChange={setVereda}
          hint="Opcional. Ayuda a los compradores a ubicarte mejor."
        />

        <CampoTexto
          label="Una frase sobre tu negocio"
          name="descripcion"
          placeholder="Ej: Frutas frescas del campo chocoano"
          value={descripcion}
          onChange={setDescripcion}
          hint="Opcional. Corta y directa."
        />

        <CampoArea
          label="Tu historia"
          name="historia"
          rows={5}
          placeholder="Cuéntale al comprador quién eres y qué haces."
          value={historia}
          onChange={setHistoria}
          hint="Opcional. Las tiendas con historia generan más confianza."
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
          hint="Opcional. Para que los compradores te escriban directo."
        />

        <CampoTexto
          label="URL de tu logo"
          name="logoUrl"
          placeholder="https://…"
          value={logoUrl}
          onChange={setLogoUrl}
          hint="Opcional. Enlace directo a la imagen de tu logo."
        />

        {envioGratisPermitido && (
          <CampoTexto
            label="Envío gratis desde ($)"
            name="envioGratisDesde"
            type="tel"
            inputMode="numeric"
            placeholder="Ej: 80000"
            value={envioGratisDesde}
            onChange={(v) => setEnvioGratisDesde(v.replace(/\D/g, ''))}
            hint="Opcional. Si el pedido de tu tienda supera este monto, el envío sale gratis. Déjalo vacío para desactivarlo."
          />
        )}

        <Button type="submit" loading={guardando} className="w-full">
          Guardar cambios
        </Button>
      </form>

      {/* Sección de documento */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1A1A1A]">Foto de tu documento</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            El equipo la usa para verificar tu identidad. Solo la ve el administrador.
          </p>
        </div>

        {fotoDocumentoUrl && (
          <div className="relative h-40 w-full rounded-xl overflow-hidden border border-[#1A1A1A]/10">
            <Image
              src={fotoDocumentoUrl}
              alt="Foto del documento"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        )}

        {errorDoc && (
          <p className="text-sm text-[#C0392B]">{errorDoc}</p>
        )}

        <input
          ref={inputDocRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={subirDoc}
        />
        <Button
          type="button"
          variant="secondary"
          loading={subiendoDoc}
          onClick={() => inputDocRef.current?.click()}
        >
          {fotoDocumentoUrl ? 'Cambiar foto del documento' : 'Subir foto del documento'}
        </Button>
      </div>
    </div>
  )
}
