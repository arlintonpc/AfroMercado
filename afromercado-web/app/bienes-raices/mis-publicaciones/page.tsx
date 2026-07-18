'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/context/AuthContext'
import { formatearPrecio } from '@/lib/formatearPrecio'
import {
  misPublicacionesInmuebles,
  cambiarEstadoInmueble,
  actualizarInmueble,
  eliminarInmueble,
  LABEL_TIPO_INMUEBLE,
  ICONO_TIPO_INMUEBLE,
  LABEL_TIPO_OPERACION_INMUEBLE,
  type Inmueble,
  type EstadoInmueble,
} from '@/lib/api/bienes-raices'
import FormularioInmueble, { type DatosFormularioInmueble } from '@/components/bienes-raices/FormularioInmueble'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const ESTADO_INMUEBLE_LABEL: Record<EstadoInmueble, string> = {
  BORRADOR: 'Borrador', PUBLICADO: 'Publicado', PAUSADO: 'Pausado', CERRADO: 'Cerrado',
}
const MODERACION_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente de revisión', color: 'bg-amber-100 text-amber-700' },
  APROBADA: { label: 'Aprobada y publicada', color: 'bg-green-100 text-green-700' },
  RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
}

function inmuebleAValoresIniciales(inmueble: Inmueble): DatosFormularioInmueble & { fotoUrls: string[] } {
  return {
    tipoInmueble: inmueble.tipoInmueble,
    tipoOperacion: inmueble.tipoOperacion,
    titulo: inmueble.titulo,
    descripcion: inmueble.descripcion ?? '',
    precio: Number(inmueble.precio),
    areaM2: inmueble.areaM2 ?? undefined,
    habitaciones: inmueble.habitaciones ?? undefined,
    banos: inmueble.banos ?? undefined,
    departamento: inmueble.departamento,
    municipio: inmueble.municipio,
    vereda: inmueble.vereda ?? undefined,
    direccionReferencia: inmueble.direccionReferencia ?? undefined,
    folioMatricula: inmueble.folioMatricula ?? undefined,
    contactoWhatsapp: inmueble.contactoWhatsapp ?? undefined,
    fotoUrls: inmueble.fotoUrls,
  }
}

function TarjetaInmueble({ inmueble, onCambiado }: { inmueble: Inmueble; onCambiado: () => void }) {
  const [editando, setEditando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiar(estado: EstadoInmueble) {
    setProcesando(true)
    setError(null)
    try {
      await cambiarEstadoInmueble(inmueble.id, estado)
      onCambiado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.')
    } finally {
      setProcesando(false)
    }
  }

  async function guardarEdicion(datos: DatosFormularioInmueble) {
    await actualizarInmueble(inmueble.id, datos)
    setEditando(false)
    onCambiado()
  }

  async function confirmarEliminar() {
    setProcesando(true)
    try {
      await eliminarInmueble(inmueble.id)
      onCambiado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la publicación.')
    } finally {
      setProcesando(false)
      setConfirmandoEliminar(false)
    }
  }

  const moderacion = MODERACION_LABEL[inmueble.estadoModeracion]

  if (editando) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">Editando: {inmueble.titulo}</p>
        <FormularioInmueble
          valoresIniciales={inmuebleAValoresIniciales(inmueble)}
          onGuardar={guardarEdicion}
          onCancelar={() => setEditando(false)}
          textoBoton="Guardar cambios"
          textoEnviando="Guardando…"
          mostrarArchivos={false}
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B4332, #2D6A4F)' }}>
          {inmueble.fotoUrls.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inmueble.fotoUrls[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{ICONO_TIPO_INMUEBLE[inmueble.tipoInmueble]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-[#1A1A1A]">{inmueble.titulo}</p>
              <p className="text-xs text-[#1A1A1A]/50 mt-0.5">
                {ICONO_TIPO_INMUEBLE[inmueble.tipoInmueble]} {LABEL_TIPO_INMUEBLE[inmueble.tipoInmueble]} · {LABEL_TIPO_OPERACION_INMUEBLE[inmueble.tipoOperacion]} · {inmueble.municipio}, {inmueble.departamento}
              </p>
              <p className="text-sm font-semibold text-[#2D6A4F] mt-1">
                {formatearPrecio(Number(inmueble.precio))}{inmueble.tipoOperacion === 'ARRIENDO' && <span className="text-xs font-normal text-[#1A1A1A]/45">/mes</span>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${moderacion.color}`}>{moderacion.label}</span>
              <span className="text-xs text-[#1A1A1A]/45">{ESTADO_INMUEBLE_LABEL[inmueble.estado]}</span>
            </div>
          </div>
        </div>
      </div>

      {inmueble.estadoModeracion === 'RECHAZADA' && inmueble.motivoRechazoModeracion && (
        <p className="text-xs text-red-600 mt-2">Motivo: {inmueble.motivoRechazoModeracion}</p>
      )}

      {error && <p className="text-xs text-[#C0392B] mt-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mt-3">
        {inmueble.estadoModeracion === 'APROBADA' && inmueble.estado === 'PUBLICADO' && (
          <>
            <Link href={`/bienes-raices/${inmueble.id}`} className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0]">
              Ver publicación
            </Link>
            <button onClick={() => cambiar('PAUSADO')} disabled={procesando} className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0] disabled:opacity-50">
              Pausar
            </button>
            <button onClick={() => cambiar('CERRADO')} disabled={procesando} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
              Cerrar
            </button>
          </>
        )}
        {inmueble.estado === 'PAUSADO' && (
          <button onClick={() => cambiar('PUBLICADO')} disabled={procesando} className="rounded-lg bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245a42] disabled:opacity-50">
            Reactivar
          </button>
        )}
        <button onClick={() => setEditando(true)} disabled={procesando} className="rounded-lg border border-[#1A1A1A]/15 px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]/60 hover:bg-[#F8F5F0] disabled:opacity-50">
          Editar
        </button>
        <button onClick={() => setConfirmandoEliminar(true)} disabled={procesando} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
          Eliminar
        </button>
      </div>

      {confirmandoEliminar && (
        <ModalConfirmacion
          titulo="Eliminar publicación"
          mensaje={`¿Seguro que quieres eliminar "${inmueble.titulo}"? Esta acción no se puede deshacer.`}
          textoConfirmar="Eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmandoEliminar(false)}
        />
      )}
    </div>
  )
}

export default function PaginaMisPublicacionesInmuebles() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) router.replace('/ingresar?redirect=/bienes-raices/mis-publicaciones')
  }, [cargandoAuth, autenticado, router])

  function cargar() {
    setCargando(true)
    misPublicacionesInmuebles().then(setInmuebles).finally(() => setCargando(false))
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
          <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Mis publicaciones</h1>
          <Link href="/bienes-raices/publicar" className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245a42] transition-colors">
            + Nueva publicación
          </Link>
        </div>

        {cargando || cargandoAuth ? (
          <div className="h-32 rounded-2xl bg-white border border-[#1A1A1A]/8 animate-pulse" />
        ) : inmuebles.length === 0 ? (
          <p className="text-sm text-[#1A1A1A]/55">Todavía no has publicado ningún predio.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {inmuebles.map((i) => <TarjetaInmueble key={i.id} inmueble={i} onCambiado={cargar} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
