'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { obtenerPerfil, actualizarPerfil } from '@/lib/api/usuario'
import type { Usuario, TipoDocumento } from '@/types/usuario'

const ETIQUETA_ROL: Record<string, string> = {
  COMPRADOR: 'Comprador',
  COMERCIANTE: 'Comerciante',
  ADMIN: 'Administrador',
  REPARTIDOR: 'Repartidor',
}

const COLOR_ROL: Record<string, string> = {
  COMPRADOR: 'bg-blue-50 text-blue-700',
  COMERCIANTE: 'bg-[#52B788]/15 text-[#2D6A4F]',
  ADMIN: 'bg-[#D4A017]/15 text-[#9B7300]',
  REPARTIDOR: 'bg-purple-50 text-purple-700',
}

function formatearFecha(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PerfilPage() {
  const router = useRouter()
  const { usuario: usuarioCtx, autenticado, cargando: cargandoAuth, actualizarUsuario } = useAuth()

  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Campos del formulario
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | ''>('')
  const [numeroDocumento, setNumeroDocumento] = useState('')

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar?redirect=/perfil')
      return
    }
    if (!autenticado) return

    obtenerPerfil()
      .then((p) => {
        setPerfil(p)
        setNombre(p.nombre)
        setTelefono(p.telefono ?? '')
        setTipoDocumento((p.tipoDocumento as TipoDocumento) ?? '')
        setNumeroDocumento(p.numeroDocumento ?? '')
      })
      .catch(() => {
        // fallback al usuario del contexto
        if (usuarioCtx) {
          setPerfil(usuarioCtx as Usuario)
          setNombre(usuarioCtx.nombre)
          setTelefono(usuarioCtx.telefono ?? '')
        }
      })
      .finally(() => setCargando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado, cargandoAuth])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExito(false)
    setGuardando(true)

    try {
      const actualizado = await actualizarPerfil({
        nombre: nombre.trim(),
        telefono: telefono.replace(/\D/g, '') || undefined,
        tipoDocumento: tipoDocumento || undefined,
        numeroDocumento: numeroDocumento.trim() || undefined,
      })
      setPerfil(actualizado)
      actualizarUsuario(actualizado)
      setExito(true)
      setEditando(false)
      setTimeout(() => setExito(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  function handleCancelar() {
    if (!perfil) return
    setNombre(perfil.nombre)
    setTelefono(perfil.telefono ?? '')
    setTipoDocumento((perfil.tipoDocumento as TipoDocumento) ?? '')
    setNumeroDocumento(perfil.numeroDocumento ?? '')
    setError(null)
    setEditando(false)
  }

  if (cargandoAuth || cargando) {
    return (
      <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!perfil) return null

  const inicial = perfil.nombre.charAt(0).toUpperCase()
  const etiquetaRol = ETIQUETA_ROL[perfil.rol] ?? perfil.rol
  const colorRol = COLOR_ROL[perfil.rol] ?? 'bg-gray-50 text-gray-700'

  return (
    <div className="min-h-screen bg-[#F8F5F0] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-[#1A1A1A]/40 hover:text-[#2D6A4F] transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Mi perfil</h1>
        </div>

        {/* Tarjeta de identidad */}
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {inicial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-[#1A1A1A] truncate">{perfil.nombre}</p>
            <p className="text-sm text-[#1A1A1A]/55 truncate">{perfil.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorRol}`}>
                {etiquetaRol}
              </span>
              {perfil.createdAt && (
                <span className="text-xs text-[#1A1A1A]/40">
                  Miembro desde {formatearFecha(perfil.createdAt)}
                </span>
              )}
            </div>
          </div>
          {perfil.rol === 'COMERCIANTE' && (
            <Link
              href="/comerciante"
              className="flex-shrink-0 text-xs font-semibold text-[#2D6A4F] hover:underline"
            >
              Ver mi tienda &rarr;
            </Link>
          )}
          {perfil.rol === 'ADMIN' && (
            <Link
              href="/admin"
              className="flex-shrink-0 text-xs font-semibold text-[#2D6A4F] hover:underline"
            >
              Panel admin &rarr;
            </Link>
          )}
        </div>

        {/* Mensaje de exito */}
        {exito && (
          <div className="flex items-center gap-3 p-4 bg-[#52B788]/10 border border-[#52B788]/30 rounded-xl text-sm text-[#2D6A4F] font-medium">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Perfil actualizado correctamente.
          </div>
        )}

        {/* Informacion personal */}
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-[#1A1A1A]">Informacion personal</h2>
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="text-sm font-semibold text-[#2D6A4F] hover:underline"
              >
                Editar
              </button>
            )}
          </div>

          {editando ? (
            <form onSubmit={handleGuardar} className="flex flex-col gap-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1A1A]">Nombre completo</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  minLength={2}
                  className="w-full h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
                />
              </div>

              {/* Telefono */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1A1A]">Celular</label>
                <div className="flex items-center border border-[#1A1A1A]/15 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#2D6A4F]/30 focus-within:border-[#2D6A4F] transition-colors bg-white">
                  <span className="px-3 text-sm text-[#1A1A1A]/50 border-r border-[#1A1A1A]/10 bg-[#F8F5F0] h-11 flex items-center">+57</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="3XXXXXXXXX"
                    className="flex-1 h-11 px-3 bg-transparent text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tipo de documento */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1A1A]">Tipo de documento</label>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
                  className="w-full h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
                >
                  <option value="">Sin especificar</option>
                  <option value="CC">Cedula de Ciudadania (CC)</option>
                  <option value="TI">Tarjeta de Identidad (TI)</option>
                  <option value="CE">Cedula de Extranjeria (CE)</option>
                  <option value="PEP">Permiso Especial de Permanencia (PEP)</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>

              {/* Numero de documento */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1A1A]">Numero de documento</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
                  placeholder="Ej: 1234567890"
                  className="w-full h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
                />
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={guardando || !nombre.trim()}
                  className="flex-1 h-11 bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelar}
                  disabled={guardando}
                  className="h-11 px-5 border border-[#1A1A1A]/15 text-[#1A1A1A] font-semibold rounded-xl hover:bg-[#F8F5F0] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <dt className="text-xs text-[#1A1A1A]/45 uppercase tracking-wide font-medium mb-0.5">Nombre</dt>
                <dd className="text-sm font-medium text-[#1A1A1A]">{perfil.nombre}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#1A1A1A]/45 uppercase tracking-wide font-medium mb-0.5">Correo electronico</dt>
                <dd className="text-sm font-medium text-[#1A1A1A]">{perfil.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#1A1A1A]/45 uppercase tracking-wide font-medium mb-0.5">Celular</dt>
                <dd className="text-sm font-medium text-[#1A1A1A]">
                  {perfil.telefono
                    ? `+57 ${perfil.telefono}`
                    : <span className="text-[#1A1A1A]/30 italic">No registrado</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#1A1A1A]/45 uppercase tracking-wide font-medium mb-0.5">Documento</dt>
                <dd className="text-sm font-medium text-[#1A1A1A]">
                  {perfil.tipoDocumento && perfil.numeroDocumento
                    ? `${perfil.tipoDocumento} ${perfil.numeroDocumento}`
                    : <span className="text-[#1A1A1A]/30 italic">No registrado</span>}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Seguridad */}
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6">
          <h2 className="font-bold text-[#1A1A1A] mb-4">Seguridad</h2>
          <div className="flex items-center justify-between py-3 border-b border-[#1A1A1A]/8">
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">Contrasena</p>
              <p className="text-xs text-[#1A1A1A]/45 mt-0.5">Ultima actualizacion desconocida</p>
            </div>
            <Link
              href="/recuperar-password"
              className="text-sm font-semibold text-[#2D6A4F] hover:underline"
            >
              Cambiar
            </Link>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">Autorizacion de datos</p>
              <p className="text-xs text-[#1A1A1A]/45 mt-0.5">
                {perfil.autorizacionDatos
                  ? `Aceptada el ${formatearFecha(perfil.autorizacionFecha)}`
                  : 'No aceptada'}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                perfil.autorizacionDatos
                  ? 'bg-[#52B788]/15 text-[#2D6A4F]'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {perfil.autorizacionDatos ? 'Aceptada' : 'Pendiente'}
            </span>
          </div>
        </div>

        {/* Mis pedidos */}
        <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#1A1A1A]">Mis pedidos</p>
            <p className="text-xs text-[#1A1A1A]/45 mt-0.5">Historial de compras y estados</p>
          </div>
          <Link
            href="/mis-pedidos"
            className="text-sm font-semibold text-[#2D6A4F] hover:underline"
          >
            Ver pedidos &rarr;
          </Link>
        </div>

      </div>
    </div>
  )
}
