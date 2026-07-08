'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  listarDirecciones,
  crearDireccion,
  actualizarDireccion,
  eliminarDireccion,
  marcarDireccionPrincipal,
} from '@/lib/api/direcciones'
import type { Direccion, CrearDireccionInput } from '@/lib/api/direcciones'
import { DEPARTAMENTOS } from '@/lib/data/colombia'
import ModalConfirmacion from '@/components/ui/ModalConfirmacion'

const VACIO: CrearDireccionInput = {
  alias: '',
  linea1: '',
  barrio: '',
  municipio: '',
  departamento: '',
  referencia: '',
  telefono: '',
}

function SkeletonDireccion() {
  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-[#1A1A1A]/8 rounded" />
          <div className="h-3 w-48 bg-[#1A1A1A]/5 rounded" />
          <div className="h-3 w-36 bg-[#1A1A1A]/5 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-[#1A1A1A]/5 rounded-xl" />
          <div className="h-8 w-16 bg-[#1A1A1A]/5 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

interface FormDireccionProps {
  inicial?: CrearDireccionInput
  onGuardar: (datos: CrearDireccionInput) => Promise<void>
  onCancelar: () => void
  guardando: boolean
  error: string | null
}

function FormDireccion({ inicial = VACIO, onGuardar, onCancelar, guardando, error }: FormDireccionProps) {
  const [form, setForm] = useState<CrearDireccionInput>(inicial)

  function set(campo: keyof CrearDireccionInput) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [campo]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onGuardar({
      alias: form.alias.trim(),
      linea1: form.linea1.trim(),
      barrio: form.barrio?.trim() || undefined,
      municipio: form.municipio.trim(),
      departamento: form.departamento,
      referencia: form.referencia?.trim() || undefined,
      telefono: form.telefono?.trim() || undefined,
    })
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors'
  const labelCls = 'text-sm font-medium text-[#1A1A1A]'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Alias <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.alias}
            onChange={set('alias')}
            placeholder="Ej: Casa, Trabajo"
            required
            maxLength={40}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Teléfono de contacto</label>
          <input
            type="tel"
            inputMode="numeric"
            value={form.telefono}
            onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
            placeholder="3XXXXXXXXX"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Dirección <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.linea1}
          onChange={set('linea1')}
          placeholder="Ej: Calle 5 #12-34"
          required
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Barrio</label>
        <input
          type="text"
          value={form.barrio}
          onChange={set('barrio')}
          placeholder="Ej: El Centro"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Municipio <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.municipio}
            onChange={set('municipio')}
            placeholder="Ej: Quibdó"
            required
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Departamento <span className="text-red-500">*</span></label>
          <select
            value={form.departamento}
            onChange={set('departamento')}
            required
            className={inputCls}
          >
            <option value="">Seleccionar...</option>
            {DEPARTAMENTOS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Referencia adicional</label>
        <input
          type="text"
          value={form.referencia}
          onChange={set('referencia')}
          placeholder="Ej: Casa azul, portón negro, cerca al parque"
          className={inputCls}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 h-11 bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : 'Guardar dirección'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="h-11 px-5 border border-[#1A1A1A]/15 text-[#1A1A1A] font-semibold rounded-xl hover:bg-[#F8F5F0] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function TarjetaDireccion({
  dir,
  onEditar,
  onEliminar,
  onMarcarPrincipal,
  procesando,
}: {
  dir: Direccion
  onEditar: (dir: Direccion) => void
  onEliminar: (id: number) => void
  onMarcarPrincipal: (id: number) => void
  procesando: number | null
}) {
  const ocupado = procesando === dir.id

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all ${dir.esPrincipal ? 'border-[#2D6A4F]/40' : 'border-[#1A1A1A]/8'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-bold text-[#1A1A1A]">{dir.alias}</span>
            {dir.esPrincipal && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#2D6A4F] text-white">
                Principal
              </span>
            )}
          </div>
          <p className="text-sm text-[#1A1A1A]/70">{dir.linea1}</p>
          {dir.barrio && (
            <p className="text-sm text-[#1A1A1A]/55">Barrio {dir.barrio}</p>
          )}
          <p className="text-sm text-[#1A1A1A]/55">{dir.municipio}, {dir.departamento}</p>
          {dir.referencia && (
            <p className="text-xs text-[#1A1A1A]/40 mt-1 italic">{dir.referencia}</p>
          )}
          {dir.telefono && (
            <p className="text-xs text-[#1A1A1A]/45 mt-1">Tel: {dir.telefono}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {!dir.esPrincipal && (
            <button
              onClick={() => onMarcarPrincipal(dir.id)}
              disabled={ocupado}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#2D6A4F]/30 text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors disabled:opacity-50"
            >
              {ocupado ? '...' : 'Hacer principal'}
            </button>
          )}
          <button
            onClick={() => onEditar(dir)}
            disabled={ocupado}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#1A1A1A]/15 text-[#1A1A1A]/70 hover:bg-[#F8F5F0] transition-colors disabled:opacity-50"
          >
            Editar
          </button>
          <button
            onClick={() => onEliminar(dir.id)}
            disabled={ocupado}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MisDireccionesPage() {
  const router = useRouter()
  const { autenticado, cargando: cargandoAuth } = useAuth()

  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modoForm, setModoForm] = useState<'ninguno' | 'crear' | 'editar'>('ninguno')
  const [dirEditando, setDirEditando] = useState<Direccion | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const [procesando, setProcesando] = useState<number | null>(null)
  const [direccionAEliminar, setDireccionAEliminar] = useState<number | null>(null)

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/mis-direcciones')
    }
  }, [autenticado, cargandoAuth, router])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const lista = await listarDirecciones()
      setDirecciones(lista)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las direcciones.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (autenticado) cargar()
  }, [autenticado, cargar])

  function abrirCrear() {
    setDirEditando(null)
    setErrorForm(null)
    setModoForm('crear')
  }

  function abrirEditar(dir: Direccion) {
    setDirEditando(dir)
    setErrorForm(null)
    setModoForm('editar')
  }

  function cerrarForm() {
    setModoForm('ninguno')
    setDirEditando(null)
    setErrorForm(null)
  }

  async function handleGuardar(datos: CrearDireccionInput) {
    setGuardando(true)
    setErrorForm(null)
    try {
      if (modoForm === 'editar' && dirEditando) {
        const actualizada = await actualizarDireccion(dirEditando.id, datos)
        setDirecciones(prev => prev.map(d => d.id === actualizada.id ? actualizada : d))
      } else {
        const nueva = await crearDireccion(datos)
        setDirecciones(prev => [...prev, nueva])
      }
      cerrarForm()
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  function handleEliminar(id: number) {
    setDireccionAEliminar(id)
  }

  async function confirmarEliminar() {
    if (direccionAEliminar == null) return
    const id = direccionAEliminar
    setProcesando(id)
    try {
      await eliminarDireccion(id)
      setDirecciones(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setProcesando(null)
      setDireccionAEliminar(null)
    }
  }

  async function handleMarcarPrincipal(id: number) {
    setProcesando(id)
    try {
      const actualizada = await marcarDireccionPrincipal(id)
      setDirecciones(prev =>
        prev.map(d => ({ ...d, esPrincipal: d.id === actualizada.id }))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo actualizar.')
    } finally {
      setProcesando(null)
    }
  }

  const initialForm: CrearDireccionInput = dirEditando
    ? {
        alias: dirEditando.alias,
        linea1: dirEditando.linea1,
        barrio: dirEditando.barrio ?? '',
        municipio: dirEditando.municipio,
        departamento: dirEditando.departamento,
        referencia: dirEditando.referencia ?? '',
        telefono: dirEditando.telefono ?? '',
      }
    : VACIO

  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/perfil" className="text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Mis direcciones</h1>
        </div>

        {/* Formulario de crear/editar */}
        {modoForm !== 'ninguno' && (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6">
            <h2 className="font-bold text-[#1A1A1A] mb-5">
              {modoForm === 'editar' ? 'Editar dirección' : 'Nueva dirección'}
            </h2>
            <FormDireccion
              key={dirEditando?.id ?? 'nueva'}
              inicial={initialForm}
              onGuardar={handleGuardar}
              onCancelar={cerrarForm}
              guardando={guardando}
              error={errorForm}
            />
          </div>
        )}

        {/* Error de carga */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Lista o skeleton */}
        {cargando ? (
          <>
            <SkeletonDireccion />
            <SkeletonDireccion />
          </>
        ) : direcciones.length === 0 && modoForm === 'ninguno' ? (
          <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F8F5F0] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" fill="none" stroke="#2D6A4F" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <p className="font-semibold text-[#1A1A1A] mb-1">Sin direcciones guardadas</p>
            <p className="text-sm text-[#1A1A1A]/45 mb-5">Agrega tu primera dirección de entrega</p>
            <button
              onClick={abrirCrear}
              className="inline-flex items-center gap-2 h-11 px-6 bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Agregar dirección
            </button>
          </div>
        ) : (
          <>
            {direcciones.map(dir => (
              <TarjetaDireccion
                key={dir.id}
                dir={dir}
                onEditar={abrirEditar}
                onEliminar={handleEliminar}
                onMarcarPrincipal={handleMarcarPrincipal}
                procesando={procesando}
              />
            ))}
          </>
        )}

        {/* Botón agregar (cuando ya hay direcciones y no está el form abierto) */}
        {!cargando && direcciones.length > 0 && modoForm === 'ninguno' && (
          <button
            onClick={abrirCrear}
            className="w-full h-11 border-2 border-dashed border-[#2D6A4F]/30 text-[#2D6A4F] font-semibold rounded-2xl hover:border-[#2D6A4F]/60 hover:bg-[#2D6A4F]/3 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Agregar dirección
          </button>
        )}

      </div>

      {direccionAEliminar != null && (
        <ModalConfirmacion
          titulo="Eliminar dirección"
          mensaje="¿Eliminar esta dirección?"
          onCancelar={() => setDireccionAEliminar(null)}
          onConfirmar={() => void confirmarEliminar()}
          confirmando={procesando === direccionAEliminar}
        />
      )}
    </div>
  )
}
