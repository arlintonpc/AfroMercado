'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEPARTAMENTOS } from '@/lib/data/colombia'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

interface Campana {
  id:         number
  tipo:       TipoCampana
  titulo:     string
  subtitulo?: string
  imagenUrl:  string
  ctaTexto:   string
  urlDestino: string
  activa:     boolean
  prioridad:  number
  inicio:     string
  fin:        string
  montoCOP?:  number
  notas?:     string
  vistas:     number
  clics:      number
  admin:      { nombre: string }
  etiqueta:   string
  alcance:    'NACIONAL' | 'DEPARTAMENTO'
  departamento?: string | null
}

type TipoCampana = 'PUBLICIDAD' | 'SOCIAL' | 'IRRUPTOR_BIENVENIDA'
type Aviso = { tipo: 'ok' | 'error'; texto: string }
type OrdenCampana = 'RECIENTES' | 'VISTAS' | 'CLICS' | 'CTR'

function localISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const HOY    = localISO(new Date())
const SEMANA = localISO(new Date(Date.now() + 7 * 86400_000))

const FORM_INIT = {
  tipo: 'PUBLICIDAD' as TipoCampana,
  titulo: '', subtitulo: '', imagenUrl: '', ctaTexto: 'Ver más',
  urlDestino: '', inicio: HOY, fin: SEMANA,
  montoCOP: '', notas: '', prioridad: '0',
  etiqueta: 'Patrocinado',
  alcance: 'NACIONAL' as 'NACIONAL' | 'DEPARTAMENTO',
  departamento: '',
}

type CampoTexto = Exclude<keyof typeof FORM_INIT, 'tipo' | 'alcance' | 'departamento'>

function badge(c: Campana) {
  const ahora = Date.now()
  const ini = new Date(c.inicio).getTime()
  const fin = new Date(c.fin).getTime()
  if (!c.activa)   return { label: 'Desactivada', cls: 'bg-[#1A1A1A]/10 text-[#1A1A1A]/50' }
  if (ahora < ini) return { label: 'Programada',  cls: 'bg-[#2A4AB8]/10 text-[#2A4AB8]' }
  if (ahora > fin) return { label: 'Expirada',    cls: 'bg-[#C0392B]/10 text-[#C0392B]' }
  return                  { label: 'Activa',      cls: 'bg-[#52B788]/15 text-[#2D6A4F]' }
}

function tipoBadge(tipo: TipoCampana) {
  if (tipo === 'SOCIAL') {
    return {
      label: 'Comunidad',
      cls: 'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30',
    }
  }
  if (tipo === 'IRRUPTOR_BIENVENIDA') {
    return {
      label: 'Flotante',
      cls: 'bg-[#2A4AB8]/15 text-[#2A4AB8] border-[#2A4AB8]/30',
    }
  }
  return {
    label: 'Publicidad',
    cls: 'bg-[#D4A017]/15 text-[#9A6B00] border-[#D4A017]/35',
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminCampanasPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://afromercado-api.onrender.com/api' : 'http://localhost:3001/api')

  const [campanas, setCampanas] = useState<Campana[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(FORM_INIT)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [orden, setOrden] = useState<OrdenCampana>('RECIENTES')
  const imgInputRef = useRef<HTMLInputElement>(null)
  const [campanaADesactivar, setCampanaADesactivar] = useState<{ id: number; titulo: string } | null>(null)

  function getToken() { return localStorage.getItem('afromercado_token') ?? '' }

  async function cargar() {
    setCargando(true)
    try {
      const r = await fetch(`${API_URL}/campanas`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const j = await r.json()
      if (j.ok) setCampanas(j.items)
    } catch { /* silencioso */ }
    finally { setCargando(false) }
  }

  useEffect(() => {
    let cancelado = false
    fetch(`${API_URL}/campanas`, { headers: { Authorization: `Bearer ${localStorage.getItem('afromercado_token') ?? ''}` } })
      .then(r => r.json())
      .then(j => { if (!cancelado && j.ok) setCampanas(j.items) })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [API_URL])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  async function subirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoImg(true)
    try {
      const fd = new FormData()
      fd.append('imagen', file)
      const r = await fetch(`${API_URL}/upload/imagen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.mensaje ?? 'Error al subir imagen')
      setForm(f => ({ ...f, imagenUrl: j.url }))
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al subir imagen' })
    } finally {
      setSubiendoImg(false)
      if (imgInputRef.current) imgInputRef.current.value = ''
    }
  }

  async function crear() {
    setGuardando(true)
    setAviso(null)
    try {
      const esSocial = form.tipo === 'SOCIAL'
      const r = await fetch(`${API_URL}/campanas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...form,
          montoCOP:  esSocial ? null : (form.montoCOP ? Number(form.montoCOP) : null),
          prioridad: Number(form.prioridad),
          etiqueta: form.etiqueta.trim() || undefined,
          departamento: form.alcance === 'DEPARTAMENTO' ? form.departamento : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Error al crear')
      setAviso({ tipo: 'ok', texto: `Campaña "${j.campana.titulo}" creada.` })
      setForm(FORM_INIT)
      setMostrarForm(false)
      cargar()
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error' })
    } finally { setGuardando(false) }
  }

  function desactivar(id: number, titulo: string) {
    setCampanaADesactivar({ id, titulo })
  }

  async function confirmarDesactivar() {
    if (!campanaADesactivar) return
    const { id } = campanaADesactivar
    try {
      await fetch(`${API_URL}/campanas/${id}/desactivar`, { method: 'PATCH', headers: { Authorization: `Bearer ${getToken()}` } })
      cargar()
    } catch { /* silencioso */ }
    finally { setCampanaADesactivar(null) }
  }

  function campo(field: CampoTexto) {
    return {
      value: form[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value })),
    }
  }

  function cambiarTipo(tipo: TipoCampana) {
    setForm(f => {
      const ctaActual = f.ctaTexto.trim()
      const etiquetaActual = f.etiqueta.trim()
      return {
        ...f,
        tipo,
        ctaTexto:
          tipo === 'SOCIAL' && (!ctaActual || ctaActual === 'Ver más')
            ? 'Conoce más'
            : tipo === 'PUBLICIDAD' && (ctaActual === 'Conoce más' || ctaActual === 'Apoya')
              ? 'Ver más'
              : f.ctaTexto,
        etiqueta:
          tipo === 'SOCIAL' && (!etiquetaActual || etiquetaActual === 'Patrocinado')
            ? 'Comunidad'
            : (tipo === 'PUBLICIDAD' || tipo === 'IRRUPTOR_BIENVENIDA') && etiquetaActual === 'Comunidad'
              ? 'Patrocinado'
              : f.etiqueta,
        montoCOP: tipo === 'SOCIAL' ? '' : f.montoCOP,
        prioridad: tipo === 'SOCIAL' && Number(f.prioridad) < 8 ? '8' : f.prioridad,
      }
    })
  }

  const campanasOrdenadas = useMemo(() => {
    if (orden === 'RECIENTES') return campanas
    const arr = [...campanas]
    if (orden === 'VISTAS') arr.sort((a, b) => b.vistas - a.vistas)
    else if (orden === 'CLICS') arr.sort((a, b) => b.clics - a.clics)
    else if (orden === 'CTR') arr.sort((a, b) => (b.clics / Math.max(b.vistas, 1)) - (a.clics / Math.max(a.vistas, 1)))
    return arr
  }, [campanas, orden])

  const ctr = 'w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30'

  return (
    <div className="flex flex-col gap-8">

      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
            Campañas del hero
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Publicidad pagada y campañas sociales visibles en el banner principal.
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(f => !f)}
          className="bg-[#2D6A4F] text-white font-semibold px-5 py-2.5 rounded-full hover:bg-[#245a42] transition-colors text-sm"
        >
          {mostrarForm ? 'Cancelar' : '+ Nueva campaña'}
        </button>
      </div>

      {/* Aviso */}
      {aviso && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${aviso.tipo === 'ok' ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]' : 'border-red-300/40 bg-red-50 text-red-700'}`}>
          {aviso.texto}
        </div>
      )}

      {/* Formulario nueva campaña */}
      {mostrarForm && (
        <section className="rounded-2xl border border-[#2D6A4F]/25 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-5">Nueva campaña</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Tipo */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-2">Tipo de campaña</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  {
                    valor: 'PUBLICIDAD' as TipoCampana,
                    titulo: 'Publicidad pagada',
                    desc: 'Promociona productos, tiendas o enlaces comerciales con monto cobrado.',
                  },
                  {
                    valor: 'SOCIAL' as TipoCampana,
                    titulo: 'Campaña social',
                    desc: 'Eventos, emergencias, convocatorias o historias de comunidad sin cobro.',
                  },
                  {
                    valor: 'IRRUPTOR_BIENVENIDA' as TipoCampana,
                    titulo: 'Overlay flotante',
                    desc: 'Ventana emergente al entrar al sitio, no en el listado del hero. Puede ser gratis o con cobro.',
                  },
                ]).map(op => {
                  const activo = form.tipo === op.valor
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => cambiarTipo(op.valor)}
                      className={`text-left rounded-xl border px-4 py-3 transition-all ${
                        activo
                          ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 shadow-sm'
                          : 'border-[#1A1A1A]/10 hover:border-[#2D6A4F]/35'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-[#1A1A1A]">{op.titulo}</span>
                      <span className="mt-1 block text-xs leading-snug text-[#1A1A1A]/55">{op.desc}</span>
                    </button>
                  )
                })}
              </div>
              {form.tipo === 'IRRUPTOR_BIENVENIDA' && (
                <p className="mt-2 text-xs text-[#2A4AB8]/80 leading-snug">
                  Aparece como ventana emergente al entrar al sitio (no en el collage del home). Solo se muestra
                  una a la vez (la de mayor prioridad activa), y cada visitante la ve como máximo una vez cada 48
                  horas — nunca en su primera visita. Usa una imagen en proporción 4:3 para que se vea bien recortada.
                </p>
              )}
            </div>

            {/* Alcance geográfico */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-2">Alcance</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { valor: 'NACIONAL' as const, titulo: 'Nacional', desc: 'Visible en todo el país.' },
                  { valor: 'DEPARTAMENTO' as const, titulo: 'Departamento', desc: 'Visible solo para visitantes de un departamento.' },
                ]).map(op => {
                  const activo = form.alcance === op.valor
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, alcance: op.valor, departamento: op.valor === 'NACIONAL' ? '' : f.departamento }))}
                      className={`text-left rounded-xl border px-4 py-3 transition-all ${
                        activo
                          ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 shadow-sm'
                          : 'border-[#1A1A1A]/10 hover:border-[#2D6A4F]/35'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-[#1A1A1A]">{op.titulo}</span>
                      <span className="mt-1 block text-xs leading-snug text-[#1A1A1A]/55">{op.desc}</span>
                    </button>
                  )
                })}
              </div>
              {form.alcance === 'DEPARTAMENTO' && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Departamento *</label>
                  <select
                    value={form.departamento}
                    onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
                    className={ctr}
                  >
                    <option value="">Selecciona un departamento…</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Título */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Título *</label>
              <input {...campo('titulo')} placeholder="Ej: Temporada de cacao del Chocó" className={ctr} />
            </div>

            {/* Subtítulo */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Subtítulo</label>
              <input {...campo('subtitulo')} placeholder="Ej: Directo del productor · Baudó" className={ctr} />
            </div>

            {/* Imagen — uploader visual */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Imagen de la campaña *</label>
              <div className="flex items-start gap-4">
                {/* Vista previa / botón subir */}
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  disabled={subiendoImg}
                  className={`relative flex-shrink-0 w-28 h-36 rounded-xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center text-[#1A1A1A]/40 transition-colors ${
                    form.imagenUrl ? 'border-[#2D6A4F]/40' : 'border-[#1A1A1A]/20 hover:border-[#2D6A4F]/40 bg-[#F8F5F0]'
                  } disabled:opacity-50`}
                >
                  {form.imagenUrl ? (
                    <Image src={form.imagenUrl} alt="Vista previa" fill className="object-cover" sizes="112px" />
                  ) : subiendoImg ? (
                    <span className="text-xs text-center px-2">Subiendo…</span>
                  ) : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs mt-1 text-center px-2 leading-tight">Subir imagen</span>
                    </>
                  )}
                </button>

                {/* Instrucciones */}
                <div className="flex-1">
                  <p className="text-sm text-[#1A1A1A]/70 leading-snug">
                    Haz clic en el recuadro para <strong>subir una foto</strong> desde tu computador.
                  </p>
                  <p className="text-xs text-[#1A1A1A]/40 mt-1">PNG, JPG o WEBP · máx 5 MB</p>
                  {form.imagenUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-[#2D6A4F] font-medium">✓ Imagen cargada</span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, imagenUrl: '' }))}
                        className="text-xs text-[#C0392B]/60 hover:text-[#C0392B]"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <input ref={imgInputRef} type="file" accept="image/*" onChange={subirImagen} className="hidden" />
            </div>

            {/* CTA */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Texto del botón</label>
              <input {...campo('ctaTexto')} placeholder="Ver más" className={ctr} />
              <p className="text-xs text-[#1A1A1A]/40 mt-1">Texto que aparece en el botón de la campaña.</p>
            </div>

            {/* Etiqueta del badge */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Etiqueta del badge</label>
              <input {...campo('etiqueta')} placeholder="Patrocinado" className={ctr} />
              <p className="text-xs text-[#1A1A1A]/40 mt-1">
                El texto que aparece en la esquina del anuncio (ej. Patrocinado, Comunidad, Aliado).
              </p>
            </div>

            {/* URL destino */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">¿A dónde lleva el clic? *</label>
              <input {...campo('urlDestino')} placeholder="/producto/5  ó  /catalogo" className={ctr} />
              <p className="text-xs text-[#1A1A1A]/40 mt-1 leading-snug">
                Ruta interna: <code className="bg-[#1A1A1A]/5 px-1 rounded">/producto/12</code> · <code className="bg-[#1A1A1A]/5 px-1 rounded">/catalogo</code><br />
                O enlace externo: <code className="bg-[#1A1A1A]/5 px-1 rounded">https://...</code>
              </p>
            </div>

            {/* Fechas */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Inicio *</label>
              <input type="datetime-local" {...campo('inicio')} className={ctr} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Fin *</label>
              <input type="datetime-local" {...campo('fin')} className={ctr} />
            </div>

            {/* Monto y prioridad */}
            {form.tipo !== 'SOCIAL' ? (
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Monto cobrado (COP)</label>
                <input type="number" {...campo('montoCOP')} placeholder="150000" className={ctr} />
                <p className="text-xs text-[#1A1A1A]/40 mt-1">
                  {form.tipo === 'IRRUPTOR_BIENVENIDA'
                    ? 'Déjalo vacío si es gratis para la comunidad, o registra cuánto pagó el comerciante.'
                    : 'Cuánto pagó el comerciante por este slot.'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#52B788]/25 bg-[#52B788]/10 px-3 py-2.5">
                <p className="text-sm font-semibold text-[#2D6A4F]">Sin cobro</p>
                <p className="text-xs text-[#1A1A1A]/50 mt-1 leading-snug">
                  Las campañas sociales se publican gratis y se muestran como contenido de comunidad.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Prioridad</label>
              <input type="number" min={0} max={10} {...campo('prioridad')} className={ctr} />
              <p className="text-xs text-[#1A1A1A]/40 mt-1">
                {form.tipo === 'SOCIAL'
                  ? 'Usa prioridad alta para emergencias o convocatorias urgentes.'
                  : '0 = normal, 10 = máxima. Las de mayor prioridad aparecen primero.'}
              </p>
            </div>

            {/* Notas */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 mb-1">Notas internas</label>
              <textarea {...campo('notas')} rows={2} placeholder="Quién pagó, qué acordamos, número de contacto…" className={`${ctr} resize-none`} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={crear}
              disabled={guardando || subiendoImg || !form.titulo || !form.imagenUrl || !form.urlDestino || (form.alcance === 'DEPARTAMENTO' && !form.departamento)}
              className="bg-[#2D6A4F] text-white font-semibold px-6 py-2.5 rounded-full hover:bg-[#245a42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {guardando ? 'Creando…' : 'Crear campaña'}
            </button>
            <button onClick={() => setMostrarForm(false)} className="text-sm text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors">Cancelar</button>
          </div>
        </section>
      )}

      {/* Lista de campañas */}
      <section className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A1A1A]/8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Todas las campañas</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="orden-campanas" className="text-xs font-semibold text-[#1A1A1A]/50">Ordenar por</label>
            <select
              id="orden-campanas"
              value={orden}
              onChange={e => setOrden(e.target.value as OrdenCampana)}
              className="rounded-lg border border-[#1A1A1A]/15 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
            >
              <option value="RECIENTES">Más recientes</option>
              <option value="VISTAS">Más vistas</option>
              <option value="CLICS">Más clics</option>
              <option value="CTR">Mejor CTR</option>
            </select>
          </div>
        </div>

        {cargando ? (
          <div className="p-8 text-center text-sm text-[#1A1A1A]/40">Cargando…</div>
        ) : campanas.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-2xl mb-2">📢</p>
            <p className="text-sm font-medium text-[#1A1A1A]/60">Aún no hay campañas</p>
            <p className="text-xs text-[#1A1A1A]/40 mt-1">Crea la primera para que aparezca en el hero.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]/5">
            {campanasOrdenadas.map(c => {
              const b = badge(c)
              const tb = tipoBadge(c.tipo ?? 'PUBLICIDAD')
              const ctrPct = c.clics > 0 ? ((c.clics / Math.max(c.vistas, 1)) * 100).toFixed(1) : '0'
              return (
                <div key={c.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="relative w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0EBE3]">
                    <Image src={c.imagenUrl} alt={c.titulo} fill className="object-cover" sizes="64px" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-[#1A1A1A] text-sm truncate">{c.titulo}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none border ${tb.cls}`}>{tb.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none ${b.cls}`}>{b.label}</span>
                    </div>
                    {c.subtitulo && <p className="text-xs text-[#1A1A1A]/50 truncate">{c.subtitulo}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-[#1A1A1A]/50">
                      <span>{fmt(c.inicio)} → {fmt(c.fin)}</span>
                      {c.tipo === 'SOCIAL' ? (
                        <span className="text-[#2D6A4F] font-semibold">Social · sin cobro</span>
                      ) : (
                        c.montoCOP && <span className="text-[#2D6A4F] font-semibold">${Number(c.montoCOP).toLocaleString('es-CO')}</span>
                      )}
                      <span>Admin: {c.admin.nombre}</span>
                      <span>Badge: &quot;{c.etiqueta}&quot;</span>
                      <span>{c.alcance === 'DEPARTAMENTO' ? `Depto: ${c.departamento}` : 'Nacional'}</span>
                    </div>

                    <div className="flex gap-4 mt-2">
                      <div className="text-center">
                        <p className="text-base font-bold text-[#2D6A4F] leading-none">{c.vistas.toLocaleString('es-CO')}</p>
                        <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">vistas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-[#D4A017] leading-none">{c.clics.toLocaleString('es-CO')}</p>
                        <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">clics</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-[#1A1A1A] leading-none">{ctrPct}%</p>
                        <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">CTR</p>
                      </div>
                    </div>
                  </div>

                  {c.activa && (
                    <button
                      onClick={() => desactivar(c.id, c.titulo)}
                      className="text-xs text-[#C0392B]/70 hover:text-[#C0392B] font-medium transition-colors flex-shrink-0 mt-1"
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {campanaADesactivar && (
        <ModalConfirmacion
          titulo="Desactivar campaña"
          mensaje={`¿Desactivar la campaña "${campanaADesactivar.titulo}"?`}
          onCancelar={() => setCampanaADesactivar(null)}
          onConfirmar={() => void confirmarDesactivar()}
          confirmando={false}
        />
      )}
    </div>
  )
}
