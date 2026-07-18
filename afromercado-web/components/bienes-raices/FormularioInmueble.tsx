'use client'

import { useRef, useState } from 'react'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'
import {
  TIPOS_INMUEBLE,
  TIPOS_OPERACION_INMUEBLE,
  type TipoInmueble,
  type TipoOperacionInmueble,
} from '@/lib/api/bienes-raices'

/** Forma de los datos que produce el formulario, compatible con Partial<Inmueble> (crear y editar). */
export interface DatosFormularioInmueble {
  tipoInmueble: TipoInmueble
  tipoOperacion: TipoOperacionInmueble
  titulo: string
  descripcion: string
  precio: number
  areaM2?: number
  habitaciones?: number
  banos?: number
  departamento: string
  municipio: string
  vereda?: string
  direccionReferencia?: string
  folioMatricula?: string
  contactoWhatsapp?: string
}

export interface ValoresInicialesFormularioInmueble extends Partial<DatosFormularioInmueble> {
  fotoUrls?: string[]
}

interface FormularioInmuebleProps {
  valoresIniciales?: ValoresInicialesFormularioInmueble
  /** Llamado al enviar. Recibe los datos del formulario, las fotos nuevas seleccionadas y el documento de soporte (si se pidió). */
  onGuardar: (datos: DatosFormularioInmueble, fotosNuevas: File[], documento: File | null) => Promise<void>
  onCancelar?: () => void
  textoBoton?: string
  textoEnviando?: string
  /** Muestra la sección de fotos y documento de soporte. En edición normalmente no hace falta. */
  mostrarArchivos?: boolean
  /** Si true (por defecto cuando mostrarArchivos), exige seleccionar un documento antes de enviar. */
  documentoObligatorio?: boolean
}

export default function FormularioInmueble({
  valoresIniciales,
  onGuardar,
  onCancelar,
  textoBoton = 'Publicar',
  textoEnviando = 'Enviando…',
  mostrarArchivos = true,
  documentoObligatorio = true,
}: FormularioInmuebleProps) {
  const [tipoInmueble, setTipoInmueble] = useState<TipoInmueble>(valoresIniciales?.tipoInmueble ?? 'CASA')
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacionInmueble>(valoresIniciales?.tipoOperacion ?? 'VENTA')
  const [titulo, setTitulo] = useState(valoresIniciales?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(valoresIniciales?.descripcion ?? '')
  const [precio, setPrecio] = useState(valoresIniciales?.precio != null ? String(valoresIniciales.precio) : '')
  const [areaM2, setAreaM2] = useState(valoresIniciales?.areaM2 != null ? String(valoresIniciales.areaM2) : '')
  const [habitaciones, setHabitaciones] = useState(valoresIniciales?.habitaciones != null ? String(valoresIniciales.habitaciones) : '')
  const [banos, setBanos] = useState(valoresIniciales?.banos != null ? String(valoresIniciales.banos) : '')
  const [departamento, setDepartamento] = useState(valoresIniciales?.departamento ?? '')
  const [municipio, setMunicipio] = useState(valoresIniciales?.municipio ?? '')
  const [municipioOtro, setMunicipioOtro] = useState(false)
  const [vereda, setVereda] = useState(valoresIniciales?.vereda ?? '')
  const [direccionReferencia, setDireccionReferencia] = useState(valoresIniciales?.direccionReferencia ?? '')
  const [folioMatricula, setFolioMatricula] = useState(valoresIniciales?.folioMatricula ?? '')
  const [contactoWhatsapp, setContactoWhatsapp] = useState(valoresIniciales?.contactoWhatsapp ?? '')

  const [fotos, setFotos] = useState<File[]>([])
  const [fotosPreview, setFotosPreview] = useState<string[]>(valoresIniciales?.fotoUrls ?? [])
  const [documento, setDocumento] = useState<File | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputFotosRef = useRef<HTMLInputElement>(null)

  const esLote = tipoInmueble === 'LOTE'
  const muniOpciones = municipiosDe(departamento)
  const usarTextoMunicipio = !!departamento && (muniOpciones.length === 0 || municipioOtro)

  function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setFotos((prev) => [...prev, ...files])
    setFotosPreview((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
    if (inputFotosRef.current) inputFotosRef.current.value = ''
  }

  function quitarFotoNueva(i: number) {
    const yaSubidas = fotosPreview.length - fotos.length
    if (i < yaSubidas) return // no quitamos fotos ya subidas desde aquí
    setFotos((prev) => prev.filter((_, idx) => idx !== i - yaSubidas))
    setFotosPreview((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (archivo) setDocumento(archivo)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!titulo.trim() || !descripcion.trim() || !precio || !departamento || !municipio.trim()) {
      setError('Completa título, descripción, precio, departamento y municipio.')
      return
    }
    if (mostrarArchivos && documentoObligatorio && !documento) {
      setError('Debes subir tu documento de soporte (escritura, folio de matrícula o certificado catastral) para poder publicar.')
      return
    }

    setEnviando(true)
    try {
      await onGuardar(
        {
          tipoInmueble,
          tipoOperacion,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          precio: Number(precio),
          areaM2: areaM2 ? Number(areaM2) : undefined,
          habitaciones: !esLote && habitaciones ? Number(habitaciones) : undefined,
          banos: !esLote && banos ? Number(banos) : undefined,
          departamento,
          municipio: municipio.trim(),
          vereda: vereda.trim() || undefined,
          direccionReferencia: direccionReferencia.trim() || undefined,
          folioMatricula: folioMatricula.trim() || undefined,
          contactoWhatsapp: contactoWhatsapp.trim() || undefined,
        },
        fotos,
        documento,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Tipo de inmueble</label>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_INMUEBLE.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipoInmueble(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                tipoInmueble === t.value ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/12 hover:border-[#1B4332]'
              }`}
            >
              {t.icono} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Tipo de operación</label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_OPERACION_INMUEBLE.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipoOperacion(t.value)}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                tipoOperacion === t.value ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'border-[#1A1A1A]/12 text-[#1A1A1A]/60 hover:bg-[#F8F5F0]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Título</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Casa de dos plantas cerca al río"
          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Descripción</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} placeholder="Describe el predio con detalle: acceso, construcción, servicios cercanos…"
          className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">
            Precio {tipoOperacion === 'ARRIENDO' && <span className="text-[#1A1A1A]/40 font-normal">(por mes)</span>}
          </label>
          <input type="number" min={0} value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Ej: 80000000"
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Área (m²) <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span></label>
          <input type="number" min={0} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder="Ej: 120"
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
      </div>

      {!esLote && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Habitaciones <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span></label>
            <input type="number" min={0} value={habitaciones} onChange={(e) => setHabitaciones(e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Baños <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span></label>
            <input type="number" min={0} value={banos} onChange={(e) => setBanos(e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Departamento</label>
          <select
            value={departamento}
            onChange={(e) => { setDepartamento(e.target.value); setMunicipio(''); setMunicipioOtro(false) }}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none"
          >
            <option value="">Elige el departamento…</option>
            {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Municipio</label>
          {usarTextoMunicipio ? (
            <div className="flex flex-col gap-1">
              <input
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Escribe el municipio"
                disabled={!departamento}
                className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 disabled:opacity-50"
              />
              {muniOpciones.length > 0 && (
                <button type="button" onClick={() => { setMunicipioOtro(false); setMunicipio('') }} className="self-start text-xs text-[#2D6A4F] hover:underline">
                  Elegir de la lista
                </button>
              )}
            </div>
          ) : (
            <select
              value={municipio}
              disabled={!departamento}
              onChange={(e) => {
                if (e.target.value === '__OTRO__') { setMunicipioOtro(true); setMunicipio('') }
                else setMunicipio(e.target.value)
              }}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50"
            >
              <option value="">{departamento ? 'Elige el municipio…' : 'Primero elige departamento'}</option>
              {muniOpciones.map((m) => <option key={m} value={m}>{m}</option>)}
              {departamento && <option value="__OTRO__">Otro (escribir)…</option>}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Vereda <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span></label>
          <input value={vereda} onChange={(e) => setVereda(e.target.value)}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">WhatsApp de contacto</label>
          <input value={contactoWhatsapp} onChange={(e) => setContactoWhatsapp(e.target.value)} placeholder="3001234567"
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">
          Referencia de ubicación <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
        </label>
        <input value={direccionReferencia} onChange={(e) => setDireccionReferencia(e.target.value)} placeholder="Ej: cerca a la escuela, 10 min del pueblo"
          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        <p className="text-xs text-[#1A1A1A]/40 mt-1">Solo es una referencia general, no se muestra como una dirección exacta.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">
          Folio de matrícula inmobiliaria <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span>
        </label>
        <input value={folioMatricula} onChange={(e) => setFolioMatricula(e.target.value)} placeholder="Ej: 160-12345"
          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
        <p className="text-xs text-[#2D6A4F] mt-1">Si lo agregas, tu publicación genera más confianza.</p>
      </div>

      {mostrarArchivos && (
        <>
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1.5">Fotos <span className="text-[#1A1A1A]/40 font-normal">(opcional)</span></label>
            <div className="flex flex-wrap gap-2">
              {fotosPreview.map((url, i) => (
                <div key={url + i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#1A1A1A]/12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i >= fotosPreview.length - fotos.length && (
                    <button
                      type="button"
                      onClick={() => quitarFotoNueva(i)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 text-white text-[10px] w-5 h-5 flex items-center justify-center hover:bg-black/75"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <label className="w-20 h-20 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-[#1A1A1A]/20 bg-[#F8F5F0] text-xs text-[#1A1A1A]/50 cursor-pointer hover:bg-[#1A1A1A]/[0.03] text-center">
                + Agregar
                <input ref={inputFotosRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/8 p-4">
            <p className="text-sm font-semibold text-[#1A1A1A]">
              Documento de soporte {documentoObligatorio && <span className="text-[#C0392B]">· obligatorio</span>}
            </p>
            <p className="text-xs text-[#6B4E0D] mt-1 leading-relaxed">
              Sube tu escritura pública, folio de matrícula o certificado catastral. Es privado — solo lo verá un administrador para verificar tu predio antes de publicarlo. Nunca se muestra públicamente.
            </p>
            {documento ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white border border-[#1A1A1A]/10 px-3 py-2">
                <span className="text-xs text-[#1A1A1A]/70 truncate">📄 {documento.name}</span>
                <button type="button" onClick={() => setDocumento(null)} className="text-xs text-[#C0392B] hover:underline shrink-0">
                  Quitar
                </button>
              </div>
            ) : (
              <label className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#D4A017]/50 bg-white px-3 py-3 text-xs text-[#6B4E0D] cursor-pointer hover:bg-[#D4A017]/5">
                Haz clic para subir tu documento (PDF o imagen)
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleDocumento} />
              </label>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-[#C0392B]">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={enviando}
          className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors disabled:opacity-50">
          {enviando ? textoEnviando : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} disabled={enviando}
            className="rounded-xl border border-[#1A1A1A]/15 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors disabled:opacity-50">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
