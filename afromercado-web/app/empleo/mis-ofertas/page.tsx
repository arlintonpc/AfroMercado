'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import {
  misOfertasEmpleo,
  cambiarEstadoOfertaEmpleo,
  actualizarOferta,
  postulacionesDeOferta,
  cambiarEstadoPostulacion,
  type OfertaEmpleo,
  type PostulacionEmpleo,
  type EstadoPostulacionEmpleo,
} from '@/lib/api/empleo'
import FormularioOferta, { type DatosFormularioOferta, type ValoresInicialesFormularioOferta } from '@/components/empleo/FormularioOferta'

const ESTADO_OFERTA_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador', PUBLICADA: 'Publicada', PAUSADA: 'Pausada', CERRADA: 'Cerrada',
}
const MODERACION_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Esperando revisión', color: 'bg-amber-100 text-amber-700' },
  APROBADA: { label: 'Aprobada', color: 'bg-green-100 text-green-700' },
  RECHAZADA: { label: 'No aprobada', color: 'bg-red-100 text-red-600' },
}
const ESTADO_POSTULACION_LABEL: Record<EstadoPostulacionEmpleo, string> = {
  ENVIADA: 'Enviada', VISTA: 'Vista', PRESELECCIONADO: 'Preseleccionado', RECHAZADA: 'Rechazada', CONTRATADO: 'Contratado', RETIRADA: 'Retirada',
}

function PanelPostulaciones({ ofertaId, vacantes }: { ofertaId: number; vacantes: number }) {
  const [postulaciones, setPostulaciones] = useState<PostulacionEmpleo[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  useEffect(() => {
    postulacionesDeOferta(ofertaId).then(setPostulaciones).finally(() => setCargando(false))
  }, [ofertaId])

  function toggleExpandido(id: number) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function cambiar(id: number, estado: EstadoPostulacionEmpleo) {
    setProcesandoId(id)
    try {
      const actualizada = await cambiarEstadoPostulacion(id, estado)
      setPostulaciones((prev) => prev.map((p) => (p.id === id ? actualizada : p)))
    } finally {
      setProcesandoId(null)
    }
  }

  if (cargando) return <p className="text-xs text-[#1A1A1A]/40 mt-2">Cargando postulaciones…</p>
  if (postulaciones.length === 0) return <p className="text-xs text-[#1A1A1A]/40 mt-2">Sin postulaciones todavía.</p>

  const contratados = postulaciones.filter((p) => p.estado === 'CONTRATADO').length

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-[#1A1A1A]/50">{contratados} de {vacantes} vacante(s) cubiertas</p>
      {postulaciones.map((p) => (
        <div key={p.id} className="rounded-lg border border-[#1A1A1A]/8 bg-[#F8F5F0] p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-[#2D6A4F] flex items-center justify-center">
                {p.fotoSnapUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.fotoSnapUrl} alt={p.postulante?.nombre ?? ''} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xs font-bold">{p.postulante?.nombre?.charAt(0).toUpperCase() ?? '?'}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-[#1A1A1A] truncate">{p.postulante?.nombre}</p>
            </div>
            <span className="text-xs font-semibold text-[#1A1A1A]/50">{ESTADO_POSTULACION_LABEL[p.estado]}</span>
          </div>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">{p.postulante?.telefono ?? p.postulante?.email}</p>
          {p.mensaje && <p className="text-sm text-[#1A1A1A]/65 mt-1">{p.mensaje}</p>}
          {p.habilidadesSnap.length > 0 && <p className="text-xs text-[#1A1A1A]/45 mt-1">Habilidades: {p.habilidadesSnap.join(', ')}</p>}
          <div className="flex items-center gap-3 mt-1.5">
            {p.cvSnapUrl && (
              <a href={p.cvSnapUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#2D6A4F] hover:underline">
                📄 Descargar CV adjuntado
              </a>
            )}
            <button
              type="button"
              onClick={() => toggleExpandido(p.id)}
              className="text-xs font-semibold text-[#2D6A4F] hover:underline"
            >
              {expandidos.has(p.id) ? 'Ocultar hoja de vida ▴' : 'Ver hoja de vida completa ▾'}
            </button>
          </div>
          {expandidos.has(p.id) && (
            <div className="mt-2 pt-2 border-t border-[#1A1A1A]/10 flex flex-col gap-2">
              {p.resumenPerfilSnap && <p className="text-xs text-[#1A1A1A]/65">{p.resumenPerfilSnap}</p>}
              {p.disponibilidadSnap && (
                <p className="text-xs text-[#1A1A1A]/50"><span className="font-semibold">Disponibilidad:</span> {p.disponibilidadSnap}</p>
              )}
              {p.experienciaSnap.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]/70 mb-1">Experiencia</p>
                  {p.experienciaSnap.map((exp, i) => (
                    <div key={i} className="text-xs text-[#1A1A1A]/60 mb-1">
                      <span className="font-semibold">{exp.cargo}</span> — {exp.empresa} ({exp.desde}{exp.hasta ? ` a ${exp.hasta}` : ' - actual'})
                      {exp.descripcion && <p className="mt-0.5">{exp.descripcion}</p>}
                    </div>
                  ))}
                </div>
              )}
              {p.educacionSnap.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]/70 mb-1">Educación</p>
                  {p.educacionSnap.map((ed, i) => (
                    <p key={i} className="text-xs text-[#1A1A1A]/60">
                      {ed.titulo} — {ed.institucion}{ed.anio ? ` (${ed.anio})` : ''}
                    </p>
                  ))}
                </div>
              )}
              {!p.resumenPerfilSnap && !p.disponibilidadSnap && p.experienciaSnap.length === 0 && p.educacionSnap.length === 0 && (
                <p className="text-xs text-[#1A1A1A]/40 italic">No completó más detalles en su hoja de vida.</p>
              )}
            </div>
          )}
          {p.respuestas.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5">
              {p.respuestas.map((r) => (
                <p key={r.preguntaId} className="text-xs text-[#1A1A1A]/60">
                  <span className="font-semibold">{r.texto}:</span> {r.respuesta}
                </p>
              ))}
            </div>
          )}
          {p.estado === 'RETIRADA' ? (
            <p className="text-xs text-[#1A1A1A]/40 mt-2 italic">El postulante retiró esta postulación.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(['VISTA', 'PRESELECCIONADO', 'CONTRATADO', 'RECHAZADA'] as EstadoPostulacionEmpleo[]).map((e) => (
                <button key={e} onClick={() => cambiar(p.id, e)} disabled={procesandoId === p.id || p.estado === e}
                  className="rounded-full border border-[#1A1A1A]/12 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 disabled:opacity-40">
                  {ESTADO_POSTULACION_LABEL[e]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ofertaAValoresIniciales(oferta: OfertaEmpleo): ValoresInicialesFormularioOferta {
  return {
    titulo: oferta.titulo,
    descripcion: oferta.descripcion,
    categoria: oferta.categoria ?? undefined,
    departamento: oferta.departamento ?? undefined,
    municipio: oferta.municipio,
    tipoContrato: oferta.tipoContrato,
    salarioMin: oferta.salarioMin != null ? Number(oferta.salarioMin) : undefined,
    salarioMax: oferta.salarioMax != null ? Number(oferta.salarioMax) : undefined,
    salarioNegociable: oferta.salarioNegociable,
    requisitos: oferta.requisitos ?? undefined,
    vacantes: oferta.vacantes,
    contactoWhatsapp: oferta.contactoWhatsapp ?? undefined,
    fechaCierre: oferta.fechaCierre ? oferta.fechaCierre.slice(0, 10) : undefined,
    imagenUrl: oferta.imagenUrl,
    preguntas: oferta.preguntas,
  }
}

function TarjetaOferta({ oferta, onCambiado }: { oferta: OfertaEmpleo; onCambiado: () => void }) {
  const [expandido, setExpandido] = useState(false)
  const [editando, setEditando] = useState(false)
  const [procesando, setProcesando] = useState(false)

  async function cambiar(estado: 'PUBLICADA' | 'PAUSADA' | 'CERRADA') {
    setProcesando(true)
    try {
      await cambiarEstadoOfertaEmpleo(oferta.id, estado)
      onCambiado()
    } finally {
      setProcesando(false)
    }
  }

  async function guardarEdicion(datos: DatosFormularioOferta) {
    await actualizarOferta(oferta.id, datos)
    setEditando(false)
    onCambiado()
  }

  const moderacion = MODERACION_LABEL[oferta.estadoModeracion]
  const vencida = oferta.estado === 'PUBLICADA' && !!oferta.fechaCierre && new Date(oferta.fechaCierre) < new Date()

  if (editando) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">Editando: {oferta.titulo}</p>
        <FormularioOferta
          valoresIniciales={ofertaAValoresIniciales(oferta)}
          onGuardar={guardarEdicion}
          onCancelar={() => setEditando(false)}
          textoBoton="Guardar cambios"
          textoEnviando="Guardando…"
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-[#1A1A1A]">{oferta.titulo}</p>
          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
            {oferta.municipio} · {vencida ? 'Vencida' : ESTADO_OFERTA_LABEL[oferta.estado]} · {oferta.vacantes} vacante(s) · {oferta._count?.postulaciones ?? 0} postulación(es)
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${moderacion.color}`}>{moderacion.label}</span>
      </div>

      {oferta.estadoModeracion === 'RECHAZADA' && oferta.motivoRechazoModeracion && (
        <p className="text-xs text-red-600 mt-2">{oferta.motivoRechazoModeracion}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {oferta.estado === 'BORRADOR' && (
          <>
            <button onClick={() => cambiar('PUBLICADA')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245a42] disabled:opacity-50">
              Publicar
            </button>
            <button onClick={() => setEditando(true)} disabled={procesando} className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0] disabled:opacity-50">
              Editar
            </button>
          </>
        )}
        {oferta.estado === 'PUBLICADA' && (
          <>
            <button onClick={() => cambiar('PAUSADA')} disabled={procesando} className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0] disabled:opacity-50">
              Pausar
            </button>
            <button onClick={() => cambiar('CERRADA')} disabled={procesando} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
              Cerrar
            </button>
          </>
        )}
        {oferta.estado === 'PAUSADA' && (
          <button onClick={() => cambiar('PUBLICADA')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245a42] disabled:opacity-50">
            Reanudar
          </button>
        )}
        <button onClick={() => setExpandido(!expandido)} className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0]">
          {expandido ? 'Ocultar postulaciones' : 'Ver postulaciones'}
        </button>
      </div>

      {expandido && <PanelPostulaciones ofertaId={oferta.id} vacantes={oferta.vacantes} />}
    </div>
  )
}

export default function PaginaMisOfertasEmpleo() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [ofertas, setOfertas] = useState<OfertaEmpleo[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/empleo/mis-ofertas')
  }, [cargandoAuth, autenticado, router])

  function cargar() {
    setCargando(true)
    misOfertasEmpleo().then(setOfertas).finally(() => setCargando(false))
  }

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    cargar()
  }, [autenticado, cargandoAuth])

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-6 py-8 pb-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Mis ofertas</h1>
          <Link href="/empleo/publicar" className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors">
            + Nueva oferta
          </Link>
        </div>

        {cargando || cargandoAuth ? (
          <div className="h-32 rounded-2xl bg-white border border-[#1A1A1A]/8 animate-pulse" />
        ) : ofertas.length === 0 ? (
          <p className="text-sm text-[#1A1A1A]/55">Todavía no has publicado ninguna oferta.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {ofertas.map((o) => <TarjetaOferta key={o.id} oferta={o} onCambiado={cargar} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
