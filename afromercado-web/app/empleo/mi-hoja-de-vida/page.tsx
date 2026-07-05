'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import { subirAvatar } from '@/lib/api/usuario'
import {
  obtenerMiHojaDeVida,
  guardarHojaDeVida,
  subirCvHojaDeVida,
  type ExperienciaItem,
  type EducacionItem,
} from '@/lib/api/empleo'

const EXPERIENCIA_VACIA: ExperienciaItem = { empresa: '', cargo: '', desde: '', hasta: '', descripcion: '' }
const EDUCACION_VACIA: EducacionItem = { institucion: '', titulo: '', nivel: '', anio: '' }

export default function PaginaMiHojaDeVida() {
  const router = useRouter()
  const { usuario, autenticado, cargando: cargandoAuth, actualizarUsuario } = useAuth()
  const inputAvatarRef = useRef<HTMLInputElement>(null)
  const inputCvRef = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(true)
  const [resumenPerfil, setResumenPerfil] = useState('')
  const [telefonoContacto, setTelefonoContacto] = useState('')
  const [disponibilidad, setDisponibilidad] = useState('')
  const [habilidadesTexto, setHabilidadesTexto] = useState('')
  const [experiencia, setExperiencia] = useState<ExperienciaItem[]>([{ ...EXPERIENCIA_VACIA }])
  const [educacion, setEducacion] = useState<EducacionItem[]>([{ ...EDUCACION_VACIA }])
  const [cvUrl, setCvUrl] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [subiendoAvatar, setSubiendoAvatar] = useState(false)
  const [errorAvatar, setErrorAvatar] = useState<string | null>(null)
  const [subiendoCv, setSubiendoCv] = useState(false)
  const [errorCv, setErrorCv] = useState<string | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/empleo/mi-hoja-de-vida')
  }, [cargandoAuth, autenticado, router])

  useEffect(() => {
    if (cargandoAuth || !autenticado) return
    obtenerMiHojaDeVida()
      .then((h) => {
        if (h) {
          setResumenPerfil(h.resumenPerfil ?? '')
          setTelefonoContacto(h.telefonoContacto)
          setDisponibilidad(h.disponibilidad ?? '')
          setHabilidadesTexto(h.habilidades.join(', '))
          if (h.experiencia.length) setExperiencia(h.experiencia)
          if (h.educacion.length) setEducacion(h.educacion)
          setCvUrl(h.cvUrl)
        }
      })
      .finally(() => setCargando(false))
  }, [autenticado, cargandoAuth])

  async function handleCambioAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setErrorAvatar(null)
    setSubiendoAvatar(true)
    try {
      const actualizado = await subirAvatar(archivo)
      actualizarUsuario(actualizado)
    } catch (err) {
      setErrorAvatar(err instanceof Error ? err.message : 'No se pudo subir la foto.')
    } finally {
      setSubiendoAvatar(false)
      if (inputAvatarRef.current) inputAvatarRef.current.value = ''
    }
  }

  async function handleCambioCv(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setErrorCv(null)
    setSubiendoCv(true)
    try {
      const actualizada = await subirCvHojaDeVida(archivo)
      setCvUrl(actualizada.cvUrl)
    } catch (err) {
      setErrorCv(err instanceof Error ? err.message : 'No se pudo subir el CV.')
    } finally {
      setSubiendoCv(false)
      if (inputCvRef.current) inputCvRef.current.value = ''
    }
  }

  async function handleGuardar() {
    if (!telefonoContacto.trim()) { setError('El teléfono de contacto es obligatorio.'); return }
    setGuardando(true)
    setError(null)
    try {
      await guardarHojaDeVida({
        resumenPerfil: resumenPerfil.trim() || undefined,
        telefonoContacto: telefonoContacto.trim(),
        disponibilidad: disponibilidad.trim() || undefined,
        habilidades: habilidadesTexto.split(',').map((h) => h.trim()).filter(Boolean),
        experiencia: experiencia.filter((e) => e.empresa.trim() || e.cargo.trim()),
        educacion: educacion.filter((e) => e.institucion.trim() || e.titulo.trim()),
      })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar tu hoja de vida.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando || cargandoAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
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
          Mi hoja de vida
        </h1>
        <p className="text-sm text-[#1A1A1A]/55 mb-6">Se usa para postularte a ofertas de empleo — la puedes actualizar cuando quieras.</p>

        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 mb-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputAvatarRef.current?.click()}
            disabled={subiendoAvatar}
            className="relative group w-16 h-16 rounded-full overflow-hidden shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:ring-offset-2"
            aria-label="Cambiar foto"
            title="Cambiar foto"
          >
            {usuario?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={usuario.avatarUrl} alt={usuario.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-[#2D6A4F] text-white text-2xl font-bold">
                {usuario?.nombre?.charAt(0).toUpperCase() ?? '?'}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A]/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {subiendoAvatar ? (
                <svg className="animate-spin text-white" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                  <path d="M9 2a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </span>
          </button>
          <input ref={inputAvatarRef} type="file" accept="image/*" className="sr-only" onChange={handleCambioAvatar} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1A1A1A]">Foto de perfil</p>
            <p className="text-xs text-[#1A1A1A]/50 mt-0.5">La ven los empleadores cuando revisan tu postulación. Haz clic en la foto para cambiarla.</p>
            {errorAvatar && <p className="text-xs text-[#C0392B] mt-1">{errorAvatar}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Resumen de tu perfil</label>
            <textarea value={resumenPerfil} onChange={(e) => setResumenPerfil(e.target.value)} rows={2}
              className="w-full resize-none rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Teléfono de contacto</label>
            <input value={telefonoContacto} onChange={(e) => setTelefonoContacto(e.target.value)}
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Habilidades (separadas por coma)</label>
            <input value={habilidadesTexto} onChange={(e) => setHabilidadesTexto(e.target.value)} placeholder="Ej: pesca, navegación, cocina"
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">Disponibilidad</label>
            <input value={disponibilidad} onChange={(e) => setDisponibilidad(e.target.value)} placeholder="Ej: Inmediata"
              className="w-full rounded-xl border border-[#1A1A1A]/12 bg-[#F8F5F0] px-3 py-2.5 text-sm focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A]/70 mb-1">CV en PDF (opcional)</label>
            <p className="text-xs text-[#1A1A1A]/50 mb-2">Si ya tienes una hoja de vida armada, adjúntala aquí — el empleador podrá descargarla directamente.</p>
            {cvUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-3 py-1.5 text-xs font-semibold text-[#2D6A4F] hover:bg-[#2D6A4F]/10">
                  📄 Ver CV cargado
                </a>
                <button type="button" onClick={() => inputCvRef.current?.click()} disabled={subiendoCv}
                  className="text-xs font-semibold text-[#1A1A1A]/50 hover:text-[#1A1A1A] disabled:opacity-50">
                  {subiendoCv ? 'Subiendo…' : 'Reemplazar'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => inputCvRef.current?.click()} disabled={subiendoCv}
                className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0] disabled:opacity-50">
                {subiendoCv ? 'Subiendo…' : 'Adjuntar CV (PDF)'}
              </button>
            )}
            <input ref={inputCvRef} type="file" accept="application/pdf" className="sr-only" onChange={handleCambioCv} />
            {errorCv && <p className="text-xs text-[#C0392B] mt-1">{errorCv}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#1A1A1A]">Experiencia</p>
              <button type="button" onClick={() => setExperiencia([...experiencia, { ...EXPERIENCIA_VACIA }])} className="text-xs text-[#2D6A4F] font-semibold hover:underline">
                + Agregar
              </button>
            </div>
            {experiencia.map((exp, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2 mb-3 rounded-xl border border-[#1A1A1A]/8 p-3">
                <input value={exp.empresa} onChange={(e) => setExperiencia(experiencia.map((x, xi) => xi === i ? { ...x, empresa: e.target.value } : x))} placeholder="Empresa / lugar"
                  className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm" />
                <input value={exp.cargo} onChange={(e) => setExperiencia(experiencia.map((x, xi) => xi === i ? { ...x, cargo: e.target.value } : x))} placeholder="Cargo"
                  className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm" />
                <input value={exp.desde} onChange={(e) => setExperiencia(experiencia.map((x, xi) => xi === i ? { ...x, desde: e.target.value } : x))} placeholder="Desde (año)"
                  className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm" />
                <input value={exp.hasta} onChange={(e) => setExperiencia(experiencia.map((x, xi) => xi === i ? { ...x, hasta: e.target.value } : x))} placeholder="Hasta (o vacío si sigue)"
                  className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm" />
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#1A1A1A]">Educación</p>
              <button type="button" onClick={() => setEducacion([...educacion, { ...EDUCACION_VACIA }])} className="text-xs text-[#2D6A4F] font-semibold hover:underline">
                + Agregar
              </button>
            </div>
            {educacion.map((ed, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2 mb-3 rounded-xl border border-[#1A1A1A]/8 p-3">
                <input value={ed.institucion} onChange={(e) => setEducacion(educacion.map((x, xi) => xi === i ? { ...x, institucion: e.target.value } : x))} placeholder="Institución"
                  className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm" />
                <input value={ed.titulo} onChange={(e) => setEducacion(educacion.map((x, xi) => xi === i ? { ...x, titulo: e.target.value } : x))} placeholder="Título / programa"
                  className="rounded-lg border border-[#1A1A1A]/12 px-2.5 py-2 text-sm" />
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-[#C0392B]">{error}</p>}
          {guardado && <p className="text-xs text-[#2D6A4F] font-semibold">✓ Guardado</p>}

          <button onClick={handleGuardar} disabled={guardando}
            className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar hoja de vida'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
