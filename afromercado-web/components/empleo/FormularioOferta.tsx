'use client'

import { useState } from 'react'
import {
  subirImagenOferta,
  CATEGORIAS_EMPLEO,
  type TipoContratoEmpleo,
  type TipoPreguntaEmpleo,
  type PreguntaOferta,
} from '@/lib/api/empleo'
import { DEPARTAMENTOS, municipiosDe } from '@/lib/data/colombia'

const TIPOS: { valor: TipoContratoEmpleo; etiqueta: string }[] = [
  { valor: 'TIEMPO_COMPLETO', etiqueta: 'Tiempo completo' },
  { valor: 'MEDIO_TIEMPO', etiqueta: 'Medio tiempo' },
  { valor: 'POR_DIAS', etiqueta: 'Por días' },
  { valor: 'TEMPORAL', etiqueta: 'Temporal' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

/** Forma de los datos que produce el formulario, compatible con Partial<OfertaEmpleo> (crear y editar). */
export interface DatosFormularioOferta {
  titulo: string
  descripcion: string
  categoria?: string
  departamento: string
  municipio: string
  tipoContrato: TipoContratoEmpleo
  salarioMin?: number
  salarioMax?: number
  salarioNegociable: boolean
  requisitos?: string
  vacantes: number
  contactoWhatsapp?: string
  fechaCierre?: string
  imagenUrl?: string | null
  preguntas: PreguntaOferta[]
}

export interface ValoresInicialesFormularioOferta extends Partial<Omit<DatosFormularioOferta, 'preguntas'>> {
  preguntas?: PreguntaOferta[]
}

interface FormularioOfertaProps {
  valoresIniciales?: ValoresInicialesFormularioOferta
  onGuardar: (datos: DatosFormularioOferta) => Promise<void>
  onCancelar?: () => void
  textoBoton?: string
  textoEnviando?: string
}

export default function FormularioOferta({
  valoresIniciales,
  onGuardar,
  onCancelar,
  textoBoton = 'Publicar oferta',
  textoEnviando = 'Publicando…',
}: FormularioOfertaProps) {
  const [titulo, setTitulo] = useState(valoresIniciales?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(valoresIniciales?.descripcion ?? '')
  const [categoria, setCategoria] = useState(valoresIniciales?.categoria ?? '')
  const [departamento, setDepartamento] = useState(valoresIniciales?.departamento ?? '')
  const [municipio, setMunicipio] = useState(valoresIniciales?.municipio ?? '')
  const [municipioOtro, setMunicipioOtro] = useState(false)
  const [tipoContrato, setTipoContrato] = useState<TipoContratoEmpleo>(valoresIniciales?.tipoContrato ?? 'TIEMPO_COMPLETO')
  const [salarioMin, setSalarioMin] = useState(valoresIniciales?.salarioMin != null ? String(valoresIniciales.salarioMin) : '')
  const [salarioMax, setSalarioMax] = useState(valoresIniciales?.salarioMax != null ? String(valoresIniciales.salarioMax) : '')
  const [salarioNegociable, setSalarioNegociable] = useState(valoresIniciales?.salarioNegociable ?? false)
  const [requisitos, setRequisitos] = useState(valoresIniciales?.requisitos ?? '')
  const [vacantes, setVacantes] = useState(valoresIniciales?.vacantes != null ? String(valoresIniciales.vacantes) : '1')
  const [contactoWhatsapp, setContactoWhatsapp] = useState(valoresIniciales?.contactoWhatsapp ?? '')
  const [fechaCierre, setFechaCierre] = useState(valoresIniciales?.fechaCierre ?? '')
  const [imagenUrl, setImagenUrl] = useState<string | null>(valoresIniciales?.imagenUrl ?? null)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [errorImagen, setErrorImagen] = useState<string | null>(null)
  const [preguntas, setPreguntas] = useState<PreguntaOferta[]>(valoresIniciales?.preguntas ?? [])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const muniOpciones = municipiosDe(departamento)
  const usarTextoMunicipio = !!departamento && (muniOpciones.length === 0 || municipioOtro)
  const [fechaMinima] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))

  function agregarPregunta() {
    setPreguntas([...preguntas, { id: crypto.randomUUID(), texto: '', tipo: 'TEXTO' }])
  }
  function actualizarPregunta(i: number, cambios: Partial<PreguntaOferta>) {
    setPreguntas(preguntas.map((p, pi) => (pi === i ? { ...p, ...cambios } : p)))
  }
  function quitarPregunta(i: number) {
    setPreguntas(preguntas.filter((_, pi) => pi !== i))
  }

  async function handleArchivoImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoImagen(true)
    setErrorImagen(null)
    try {
      const url = await subirImagenOferta(archivo)
      setImagenUrl(url)
    } catch (err) {
      setErrorImagen(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setSubiendoImagen(false)
      e.target.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !descripcion.trim() || !departamento || !municipio.trim()) {
      setError('Completa título, descripción, departamento y municipio.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await onGuardar({
        titulo,
        descripcion,
        categoria: categoria || undefined,
        departamento,
        municipio,
        tipoContrato,
        salarioMin: salarioMin ? Number(salarioMin) : undefined,
        salarioMax: salarioMax ? Number(salarioMax) : undefined,
        salarioNegociable,
        requisitos: requisitos || undefined,
        vacantes: Number(vacantes) || 1,
        contactoWhatsapp: contactoWhatsapp || undefined,
        fechaCierre: fechaCierre || undefined,
        imagenUrl,
        preguntas: preguntas
          .filter((p) => p.texto.trim())
          .map((p) => ({ ...p, opciones: p.opciones?.map((o) => o.trim()).filter(Boolean) })),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la oferta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Imagen / banner (opcional)</label>
        {imagenUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-[#1A1A1A]/12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenUrl} alt="Banner de la oferta" className="w-full h-40 object-cover" />
            <button
              type="button"
              onClick={() => setImagenUrl(null)}
              className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-xs px-2.5 py-1 hover:bg-black/75"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#1A1A1A]/20 bg-[#F8F5F0] px-3 py-6 text-sm text-[#1A1A1A]/50 cursor-pointer hover:bg-[#1A1A1A]/[0.03]">
            {subiendoImagen ? 'Subiendo imagen…' : 'Haz clic para subir una imagen'}
            <input type="file" accept="image/*" className="hidden" disabled={subiendoImagen} onChange={handleArchivoImagen} />
          </label>
        )}
        {errorImagen && <p className="text-xs text-[#C0392B] mt-1">{errorImagen}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Título</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Ayudante de pesca"
          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Descripción</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} placeholder="Describe la labor con detalle"
          className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Categoría (opcional)</label>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
          className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none">
          <option value="">Sin categoría</option>
          {CATEGORIAS_EMPLEO.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Departamento</label>
          <select
            value={departamento}
            onChange={(e) => { setDepartamento(e.target.value); setMunicipio(''); setMunicipioOtro(false) }}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none"
          >
            <option value="">Elige tu departamento…</option>
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
              <option value="">{departamento ? 'Elige tu municipio…' : 'Primero elige departamento'}</option>
              {muniOpciones.map((m) => <option key={m} value={m}>{m}</option>)}
              {departamento && <option value="__OTRO__">Otro (escribir)…</option>}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Tipo de contrato</label>
          <select value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value as TipoContratoEmpleo)}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none">
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Fecha límite para postularse (opcional)</label>
          <input type="date" value={fechaCierre} min={fechaMinima} onChange={(e) => setFechaCierre(e.target.value)}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Salario mínimo (opcional)</label>
          <input type="number" value={salarioMin} onChange={(e) => setSalarioMin(e.target.value)} placeholder="Ej: 30000" disabled={salarioNegociable}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Salario máximo (opcional)</label>
          <input type="number" value={salarioMax} onChange={(e) => setSalarioMax(e.target.value)} placeholder="Ej: 50000" disabled={salarioNegociable}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#1A1A1A]/70">
        <input type="checkbox" checked={salarioNegociable} onChange={(e) => setSalarioNegociable(e.target.checked)} />
        Salario negociable
      </label>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Requisitos (opcional)</label>
        <textarea value={requisitos} onChange={(e) => setRequisitos(e.target.value)} rows={2}
          className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Vacantes</label>
          <input type="number" min={1} value={vacantes} onChange={(e) => setVacantes(e.target.value)}
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">WhatsApp de contacto (opcional)</label>
          <input value={contactoWhatsapp} onChange={(e) => setContactoWhatsapp(e.target.value)} placeholder="3001234567"
            className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Preguntas para los postulantes (opcional)</p>
            <p className="text-xs text-[#1A1A1A]/50">El candidato deberá responderlas para poder postularse.</p>
          </div>
          <button type="button" onClick={agregarPregunta} className="text-xs text-[#2D6A4F] font-semibold hover:underline whitespace-nowrap">
            + Agregar
          </button>
        </div>
        {preguntas.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-[#1A1A1A]/8 p-3 mb-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={p.texto}
                onChange={(e) => actualizarPregunta(i, { texto: e.target.value })}
                placeholder="Ej: ¿Tienes disponibilidad para viajar?"
                className="flex-1 min-w-0 rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm"
              />
              <select
                value={p.tipo}
                onChange={(e) => actualizarPregunta(i, { tipo: e.target.value as TipoPreguntaEmpleo, opciones: [] })}
                className="rounded-lg border border-[#1A1A1A]/12 px-2 py-2 text-sm"
              >
                <option value="TEXTO">Texto libre</option>
                <option value="SI_NO">Sí o no</option>
                <option value="OPCION_MULTIPLE">Opción múltiple</option>
              </select>
              <button type="button" onClick={() => quitarPregunta(i)} className="text-xs text-[#C0392B] hover:underline px-1 whitespace-nowrap">
                Quitar
              </button>
            </div>
            {p.tipo === 'OPCION_MULTIPLE' && (
              <input
                value={p.opciones?.join(', ') ?? ''}
                onChange={(e) => actualizarPregunta(i, { opciones: e.target.value.split(',').map((o) => o.trimStart()) })}
                placeholder="Opciones separadas por coma. Ej: Básico, Intermedio, Avanzado"
                className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-[#C0392B]">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={enviando || subiendoImagen}
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
