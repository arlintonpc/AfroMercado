'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listarMisProductos,
  obtenerCuentaDispersion,
  obtenerMiComercio,
  type Comercio,
  type CuentaDispersion,
  type ProductoComerciante,
} from '@/components/comerciante/api'
import {
  crearSolicitudPublicidad,
  iniciarPagoSolicitudPublicidad,
  listarPaquetesPublicidad,
  listarMisSolicitudesPublicidad,
  type AlcancePublicidad,
  type PaquetePublicidad,
  type PublicidadPaqueteConfig,
  type SolicitudPublicidad,
} from '@/components/publicidad/api'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/formatearPrecio'

const PAQUETES_FALLBACK: Array<{
  id: PaquetePublicidad
  nombre: string
  precio: string
  precioBaseCOP: number
  descripcion: string
  ideal: string
  color: string
}> = [
  {
    id: 'IMPULSO_PRODUCTO',
    nombre: 'Impulso Producto',
    precio: '1 semana',
    precioBaseCOP: 15000,
    descripcion: 'Aparece como producto patrocinado en catalogo y categorias relevantes.',
    ideal: 'Para vender stock disponible rapido.',
    color: 'from-[#2D6A4F] to-[#52B788]',
  },
  {
    id: 'HOME_DESTACADO',
    nombre: 'Home Destacado',
    precio: '7 dias premium',
    precioBaseCOP: 35000,
    descripcion: 'Visibilidad fuerte en la portada, con contexto de tienda o producto.',
    ideal: 'Para lanzamientos, temporada o productos estrella.',
    color: 'from-[#9B7300] to-[#D4A017]',
  },
  {
    id: 'VIDEO_HISTORIA',
    nombre: 'Video Historia',
    precio: 'Storytelling',
    precioBaseCOP: 45000,
    descripcion: 'Destaca un video corto de tu finca, cocina, taller, tienda o producto.',
    ideal: 'Para turismo, gastronomia y productos con historia.',
    color: 'from-[#7B241C] to-[#C0392B]',
  },
  {
    id: 'TEMPORADA_REGIONAL',
    nombre: 'Temporada Regional',
    precio: 'Campana curada',
    precioBaseCOP: 60000,
    descripcion: 'Participa en rutas y vitrinas como Sabores del Pacifico o Artesanias del Choco.',
    ideal: 'Para vender por region, cultura o temporada.',
    color: 'from-[#1A1A1A] to-[#2D6A4F]',
  },
  {
    id: 'MARCA_ALIADA',
    nombre: 'Marca Aliada',
    precio: 'Alianza premium',
    precioBaseCOP: 90000,
    descripcion: 'Campana de posicionamiento para aliados, instituciones o marcas con afinidad cultural.',
    ideal: 'Para patrocinios, alianzas y contenido institucional.',
    color: 'from-[#102018] to-[#D4A017]',
  },
  {
    id: 'BANNER_CARRUSEL',
    nombre: 'Banner Carrusel',
    precio: '10 dias',
    precioBaseCOP: 40000,
    descripcion: 'Banner diseñado a la medida que rota en el carrusel principal del home.',
    ideal: 'Para marcas con una pieza grafica propia lista para destacar.',
    color: 'from-[#2D6A4F] to-[#1B4332]',
  },
  {
    id: 'IRRUPTOR_BIENVENIDA',
    nombre: 'Irruptor de Bienvenida',
    precio: 'Formato premium',
    precioBaseCOP: 120000,
    descripcion: 'Imagen a pantalla completa que se superpone al abrir la app. Un solo cupo nacional a la vez.',
    ideal: 'Para lanzamientos de alto impacto que necesitan maxima visibilidad.',
    color: 'from-[#7B241C] to-[#1A1A1A]',
  },
]

const PAQUETES_IMAGEN_PERSONALIZADA = new Set<PaquetePublicidad>(['BANNER_CARRUSEL', 'IRRUPTOR_BIENVENIDA'])

// Debe coincidir exactamente con MULTIPLICADOR_ALCANCE en publicidad.controller.js (backend calcula el cobro real).
const MULTIPLICADOR_ALCANCE: Record<AlcancePublicidad, number> = {
  MUNICIPIO: 1.0,
  DEPARTAMENTO: 2.3,
  NACIONAL: 4.5,
}

const OPCIONES_ALCANCE: Array<{ id: AlcancePublicidad; label: (comercio: Comercio | null) => string; desc: string }> = [
  {
    id: 'MUNICIPIO',
    label: (c) => `Mi municipio${c?.municipio ? ` (${c.municipio})` : ''}`,
    desc: 'Solo compradores de tu municipio.',
  },
  {
    id: 'DEPARTAMENTO',
    label: (c) => `Mi departamento${c?.departamento ? ` (${c.departamento})` : ''}`,
    desc: 'Compradores de todo tu departamento.',
  },
  {
    id: 'NACIONAL',
    label: () => 'Todo el país',
    desc: 'Compradores de cualquier región de Colombia.',
  },
]

function estadoClase(estado: string) {
  if (estado === 'PENDIENTE') return 'bg-[#D4A017]/15 text-[#9B7300] border-[#D4A017]/30'
  if (estado === 'APROBADA') return 'bg-[#52B788]/15 text-[#2D6A4F] border-[#52B788]/30'
  if (estado === 'CONVERTIDA') return 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
  return 'bg-[#C0392B]/10 text-[#C0392B] border-[#C0392B]/25'
}

function pagoClase(estado?: string | null) {
  if (estado === 'PAGADA') return 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
  if (estado === 'CORTESIA') return 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
  if (estado === 'EN_CHECKOUT') return 'bg-[#D4A017]/15 text-[#9B7300] border-[#D4A017]/35'
  if (estado === 'FALLIDA' || estado === 'VENCIDA' || estado === 'ANULADA') return 'bg-[#C0392B]/10 text-[#C0392B] border-[#C0392B]/25'
  return 'bg-white text-[#1A1A1A]/55 border-[#1A1A1A]/10'
}

function pagoTexto(estado?: string | null) {
  if (estado === 'PAGADA') return 'Pago confirmado'
  if (estado === 'CORTESIA') return 'Cortesia'
  if (estado === 'EN_CHECKOUT') return 'Esperando pago'
  if (estado === 'FALLIDA') return 'Pago fallido'
  if (estado === 'VENCIDA') return 'Pago vencido'
  if (estado === 'ANULADA') return 'Pago anulado'
  return 'Pago pendiente'
}

function paqueteNombre(id: string) {
  return PAQUETES_FALLBACK.find((p) => p.id === id)?.nombre ?? id
}

function fechaCorta(iso?: string | null) {
  if (!iso) return 'Sin fecha'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PublicidadComerciantePage() {
  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [cuenta, setCuenta] = useState<CuentaDispersion | null>(null)
  const [productos, setProductos] = useState<ProductoComerciante[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudPublicidad[]>([])
  const [paquetesConfig, setPaquetesConfig] = useState<PublicidadPaqueteConfig[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [pagandoId, setPagandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [form, setForm] = useState({
    paquete: 'IMPULSO_PRODUCTO' as PaquetePublicidad,
    alcance: 'NACIONAL' as AlcancePublicidad,
    objetivo: '',
    productoId: '',
    presupuestoCOP: '',
    inicio: '',
    fin: '',
    mensaje: '',
    aceptaPoliticas: false,
    videoUrl: '',
    videoPortadaUrl: '',
    videoTexto: '',
    videoUbicacion: '',
    videoDestino: '',
    videoNotasComercio: '',
    imagenPersonalizadaUrl: '',
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    setAviso(null)
    try {
      const [comercioRes, cuentaRes, productosRes, solicitudesRes, paquetesRes] = await Promise.all([
        obtenerMiComercio(),
        obtenerCuentaDispersion().catch(() => null),
        listarMisProductos().catch(() => []),
        listarMisSolicitudesPublicidad().catch(() => []),
        listarPaquetesPublicidad().catch(() => []),
      ])
      setComercio(comercioRes)
      setCuenta(cuentaRes)
      setProductos(productosRes)
      setSolicitudes(solicitudesRes)
      setPaquetesConfig(paquetesRes)
      setForm((actual) => (
        paquetesRes.length > 0 && !paquetesRes.some((p) => p.codigo === actual.paquete && !p.cupoLleno)
          ? { ...actual, paquete: (paquetesRes.find((p) => !p.cupoLleno) ?? paquetesRes[0]).codigo as PaquetePublicidad }
          : actual
      ))
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos cargar AfroMedia.' })
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const comercioListo = comercio?.estadoRegistro === 'APROBADO' && comercio.verificado
  const cuentaLista = cuenta?.estado === 'VERIFICADA'
  const productosActivos = productos.filter((p) => p.activo && p.stock > 0)
  const paquetes = paquetesConfig.length > 0
    ? paquetesConfig.map((p) => ({
        id: p.codigo as PaquetePublicidad,
        nombre: p.nombre,
        precio: `${formatearPrecio(Number(p.precioBaseCOP || 0))} / ${p.duracionDias} dias`,
        precioBaseCOP: Number(p.precioBaseCOP || 0),
        descripcion: p.descripcion ?? '',
        ideal: p.ideal ?? '',
        color: p.color || 'from-[#2D6A4F] to-[#52B788]',
        recomendado: p.recomendado,
        cuposDisponibles: p.cuposDisponibles,
        cuposOcupados: p.cuposOcupados ?? 0,
        cuposSugeridos: p.cuposSugeridos ?? null,
        cupoLleno: Boolean(p.cupoLleno),
      }))
    : PAQUETES_FALLBACK.map((p) => ({ ...p, recomendado: false, cuposDisponibles: null, cuposOcupados: 0, cuposSugeridos: null, cupoLleno: false }))
  const paqueteSeleccionado = paquetes.find((p) => p.id === form.paquete)
  const paqueteDisponible = !paqueteSeleccionado?.cupoLleno
  const puedeSolicitar = Boolean(comercioListo && cuentaLista && paqueteDisponible && form.aceptaPoliticas)
  const precioFinalCOP = paqueteSeleccionado
    ? Math.round(paqueteSeleccionado.precioBaseCOP * MULTIPLICADOR_ALCANCE[form.alcance])
    : null

  function actualizar(k: keyof typeof form, v: string | boolean) {
    setForm((actual) => ({ ...actual, [k]: v }))
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setGuardando(true)
    setAviso(null)
    try {
      await crearSolicitudPublicidad({
        paquete: form.paquete,
        objetivo: form.objetivo,
        productoId: form.productoId ? Number(form.productoId) : null,
        presupuestoCOP: form.presupuestoCOP ? Number(form.presupuestoCOP) : null,
        alcance: form.alcance,
        inicio: form.inicio || null,
        fin: form.fin || null,
        mensaje: form.mensaje,
        aceptaPoliticas: form.aceptaPoliticas,
        ...(form.paquete === 'VIDEO_HISTORIA' && {
          videoUrl: form.videoUrl || null,
          videoPortadaUrl: form.videoPortadaUrl || null,
          videoTexto: form.videoTexto || null,
          videoUbicacion: form.videoUbicacion || null,
          videoDestino: form.videoDestino || null,
          videoNotasComercio: form.videoNotasComercio || null,
        }),
        ...(PAQUETES_IMAGEN_PERSONALIZADA.has(form.paquete) && {
          imagenPersonalizadaUrl: form.imagenPersonalizadaUrl || null,
        }),
      })
      setAviso({ tipo: 'ok', texto: 'Solicitud enviada. AfroMedia revisara la pauta; si se aprueba, podras pagarla desde tu historial.' })
      setForm((actual) => ({ ...actual, alcance: 'NACIONAL', objetivo: '', presupuestoCOP: '', inicio: '', fin: '', mensaje: '', aceptaPoliticas: false, videoUrl: '', videoPortadaUrl: '', videoTexto: '', videoUbicacion: '', videoDestino: '', videoNotasComercio: '', imagenPersonalizadaUrl: '' }))
      setSolicitudes(await listarMisSolicitudesPublicidad())
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo crear la solicitud.' })
    } finally {
      setGuardando(false)
    }
  }

  async function iniciarPago(id: number) {
    setPagandoId(id)
    setAviso(null)
    try {
      const resultado = await iniciarPagoSolicitudPublicidad(id)
      setSolicitudes((actuales) => actuales.map((s) => (
        s.id === id ? resultado.solicitud : s
      )))
      if (resultado.pago.checkoutUrl) {
        window.location.assign(resultado.pago.checkoutUrl)
        return
      }
      setAviso({ tipo: 'ok', texto: 'Pago iniciado. Espera la confirmacion de la pasarela.' })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo iniciar el pago de la pauta.' })
    } finally {
      setPagandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#111E17] px-5 py-8 text-white shadow-xl sm:px-8 lg:px-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#D4A017]/30 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[#52B788]/20 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#D4A017]">AfroMedia</p>
            <h1
              className="mt-4 max-w-2xl text-4xl leading-[0.98] sm:text-5xl"
              style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
            >
              Publicidad con raiz, historia y ventas reales.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              Impulsa productos, videos, turismo, gastronomia o tu tienda completa sin parecer un anuncio invasivo.
              Teravia revisa cada solicitud para proteger la confianza de compradores y comerciantes.
            </p>
          </div>
          <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-bold text-white">Checklist para anunciar</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                <span className="text-sm text-white/75">Tienda aprobada</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${comercioListo ? 'bg-[#52B788] text-[#102018]' : 'bg-white/12 text-white/60'}`}>
                  {comercioListo ? 'Lista' : 'Pendiente'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                <span className="text-sm text-white/75">Cuenta verificada</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${cuentaLista ? 'bg-[#52B788] text-[#102018]' : 'bg-white/12 text-white/60'}`}>
                  {cuentaLista ? 'Lista' : 'Pendiente'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                <span className="text-sm text-white/75">Productos con stock</span>
                <span className="rounded-full bg-[#D4A017] px-3 py-1 text-xs font-bold text-[#1A1A1A]">
                  {productosActivos.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {aviso && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
          aviso.tipo === 'ok'
            ? 'border-[#52B788]/35 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/25 bg-[#C0392B]/5 text-[#C0392B]'
        }`}>
          {aviso.texto}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {paquetes.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={p.cupoLleno}
            onClick={() => actualizar('paquete', p.id)}
            className={`group min-h-[260px] overflow-hidden rounded-3xl border p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${
              p.cupoLleno
                ? 'cursor-not-allowed border-[#1A1A1A]/8 bg-white/50 opacity-60'
                : form.paquete === p.id
                  ? 'border-[#2D6A4F] bg-white'
                  : 'border-[#1A1A1A]/8 bg-white/80'
            }`}
          >
            <div className={`h-24 rounded-2xl bg-gradient-to-br ${p.color} p-4 text-white`}>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-bold">{p.precio}</span>
                {p.recomendado && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2D6A4F]">Recomendado</span>
                )}
              </div>
            </div>
            <h2 className="mt-4 text-lg font-black text-[#1A1A1A]">{p.nombre}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">{p.descripcion}</p>
            <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${
              p.cupoLleno ? 'bg-[#C0392B]/10 text-[#C0392B]' : 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
            }`}>
              {p.cuposSugeridos && p.cuposSugeridos > 0
                ? p.cupoLleno
                  ? 'Cupos llenos'
                  : `${p.cuposDisponibles} cupos disponibles`
                : 'Sin limite de cupos'}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#2D6A4F]">{p.ideal}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Solicitud</p>
          <h2 className="mt-2 text-2xl font-black text-[#1A1A1A]">Pauta con control editorial</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/60">
            Selecciona objetivo, producto y fechas. El equipo revisa que el anuncio sea claro,
            honesto y relevante antes de activarlo.
          </p>

          {!puedeSolicitar && !cargando && (
            <div className="mt-5 rounded-2xl border border-[#D4A017]/35 bg-[#D4A017]/10 p-4 text-sm text-[#9B7300]">
              Para solicitar publicidad necesitas tienda aprobada y cuenta de dispersion verificada.
              <Link href="/comerciante/perfil" className="ml-1 font-bold underline">Revisar mi tienda</Link>
            </div>
          )}

          <form onSubmit={enviar} className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
              Objetivo de la campana
              <input
                required
                value={form.objetivo}
                onChange={(e) => actualizar('objetivo', e.target.value)}
                placeholder="Ej: vender 30 canastas este fin de semana"
                className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
              />
            </label>

            <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
              Producto principal
              <select
                value={form.productoId}
                onChange={(e) => actualizar('productoId', e.target.value)}
                className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
              >
                <option value="">Promocionar la tienda completa</option>
                {productosActivos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} - {p.stock} disponibles</option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 text-sm font-bold text-[#1A1A1A]">
              Alcance geografico de la pauta
              <div className="grid gap-2 sm:grid-cols-3">
                {OPCIONES_ALCANCE.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => actualizar('alcance', op.id)}
                    className={`rounded-2xl border px-4 py-3 text-left font-normal transition-colors ${
                      form.alcance === op.id
                        ? 'border-[#2D6A4F] bg-[#2D6A4F]/8'
                        : 'border-[#1A1A1A]/10 bg-[#FDFBF7] hover:border-[#2D6A4F]/40'
                    }`}
                  >
                    <p className="text-sm font-bold text-[#1A1A1A]">{op.label(comercio)}</p>
                    <p className="mt-0.5 text-xs text-[#1A1A1A]/55">{op.desc}</p>
                    <p className="mt-1 text-xs font-black text-[#2D6A4F]">x{MULTIPLICADOR_ALCANCE[op.id]}</p>
                  </button>
                ))}
              </div>
              {precioFinalCOP !== null && (
                <p className="mt-1 rounded-2xl bg-[#2D6A4F]/8 px-4 py-2 text-sm font-black text-[#2D6A4F]">
                  Precio de la pauta: {formatearPrecio(precioFinalCOP)}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                Presupuesto
                <input
                  type="number"
                  min="0"
                  value={form.presupuestoCOP}
                  onChange={(e) => actualizar('presupuestoCOP', e.target.value)}
                  placeholder="15000"
                  className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                Inicio
                <input
                  type="date"
                  value={form.inicio}
                  onChange={(e) => actualizar('inicio', e.target.value)}
                  className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                Fin
                <input
                  type="date"
                  value={form.fin}
                  onChange={(e) => actualizar('fin', e.target.value)}
                  className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
              Mensaje para el equipo
              <textarea
                value={form.mensaje}
                onChange={(e) => actualizar('mensaje', e.target.value)}
                rows={4}
                placeholder="Cuenta que quieres destacar: historia, promocion, temporada, municipio o publico objetivo."
                className="resize-none rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
              />
            </label>

            {form.paquete === 'VIDEO_HISTORIA' && (
              <div className="rounded-3xl border border-[#C0392B]/20 bg-[#C0392B]/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#C0392B]">Pieza de video — Editorial</p>
                <p className="mt-1 mb-4 text-sm text-[#1A1A1A]/55">
                  El equipo revisara tu video antes de publicarlo. Puedes ingresar la URL ahora o enviarlo despues por mensaje.
                </p>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                    URL del video
                    <input
                      type="url"
                      value={form.videoUrl}
                      onChange={(e) => actualizar('videoUrl', e.target.value)}
                      placeholder="https://... (Cloudinary, Drive, YouTube no listado)"
                      className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                    Imagen de portada (opcional)
                    <input
                      type="url"
                      value={form.videoPortadaUrl}
                      onChange={(e) => actualizar('videoPortadaUrl', e.target.value)}
                      placeholder="https://... (thumbnail del video)"
                      className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                    Texto o copy del video
                    <input
                      value={form.videoTexto}
                      onChange={(e) => actualizar('videoTexto', e.target.value)}
                      placeholder="Ej: Descubre el sabor del Choco autentico"
                      className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                      Ubicacion deseada
                      <select
                        value={form.videoUbicacion}
                        onChange={(e) => actualizar('videoUbicacion', e.target.value)}
                        className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20"
                      >
                        <option value="">Sin preferencia</option>
                        <option value="HOME">Portada principal</option>
                        <option value="CATALOGO">Catalogo de productos</option>
                        <option value="CATEGORIA">Pagina de categoria</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                      Destino del clic
                      <input
                        value={form.videoDestino}
                        onChange={(e) => actualizar('videoDestino', e.target.value)}
                        placeholder="/producto/123 o /comercio/mi-tienda"
                        className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                    Notas para el editor
                    <textarea
                      value={form.videoNotasComercio}
                      onChange={(e) => actualizar('videoNotasComercio', e.target.value)}
                      rows={2}
                      placeholder="Contexto adicional: duracion, mensaje cultural, momento del video a destacar..."
                      className="resize-none rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20"
                    />
                  </label>
                </div>
              </div>
            )}

            {PAQUETES_IMAGEN_PERSONALIZADA.has(form.paquete) && (
              <div className="rounded-3xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2D6A4F]">Imagen diseñada — Requerida</p>
                <p className="mt-1 mb-4 text-sm text-[#1A1A1A]/55">
                  Este formato usa una pieza grafica propia (no la foto del producto ni el logo de tu tienda).
                  Sube la imagen a Cloudinary, Drive u otro host y pega aqui la URL publica.
                </p>
                <label className="grid gap-1 text-sm font-bold text-[#1A1A1A]">
                  URL de la imagen
                  <input
                    required
                    type="url"
                    value={form.imagenPersonalizadaUrl}
                    onChange={(e) => actualizar('imagenPersonalizadaUrl', e.target.value)}
                    placeholder="https://... (Cloudinary, Drive...)"
                    className="rounded-2xl border border-[#1A1A1A]/10 bg-[#FDFBF7] px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/25"
                  />
                </label>
              </div>
            )}

            {paqueteSeleccionado?.cupoLleno && (
              <div className="rounded-2xl border border-[#C0392B]/25 bg-[#C0392B]/8 p-4 text-sm font-semibold text-[#C0392B]">
                Este paquete no tiene cupos disponibles para nuevas solicitudes. Elige otro paquete o espera a que se libere inventario.
              </div>
            )}

            <label className="flex items-start gap-3 rounded-2xl border border-[#D4A017]/35 bg-[#D4A017]/10 p-4 text-sm text-[#7A5A00]">
              <input
                type="checkbox"
                checked={form.aceptaPoliticas}
                onChange={(e) => actualizar('aceptaPoliticas', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#D4A017]"
                required
              />
              <span>
                Confirmo que lei y acepto las politicas de publicidad de AfroMedia version 2026-06-27.
                Entiendo que Teravia puede rechazar o suspender pautas con informacion falsa,
                contenido engañoso o productos no permitidos.
                <Link href="/publicidad/politicas" className="ml-1 font-black underline" target="_blank" rel="noopener noreferrer">
                  Ver politicas
                </Link>
              </span>
            </label>

            <Button type="submit" disabled={!puedeSolicitar || cargando} loading={guardando}>
              Enviar solicitud a AfroMedia
            </Button>
          </form>
        </div>

        <div className="rounded-3xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1A1A1A]/35">Historial</p>
              <h2 className="mt-2 text-2xl font-black text-[#1A1A1A]">Tus solicitudes</h2>
            </div>
            <button
              type="button"
              onClick={() => void cargar()}
              className="rounded-full border border-[#1A1A1A]/10 px-4 py-2 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F8F5F0]"
            >
              Actualizar
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {cargando ? (
              <div className="rounded-2xl bg-[#F8F5F0] p-6 text-sm text-[#1A1A1A]/50">Cargando solicitudes...</div>
            ) : solicitudes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 p-6">
                <p className="font-bold text-[#2D6A4F]">Aun no tienes solicitudes.</p>
                <p className="mt-1 text-sm text-[#1A1A1A]/55">
                  Empieza con un producto que tenga buen stock, buena foto y una historia clara.
                </p>
              </div>
            ) : solicitudes.map((s) => (
              <article key={s.id} className="rounded-2xl border border-[#1A1A1A]/8 bg-[#FDFBF7] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#1A1A1A]">{paquetes.find((p) => p.id === s.paquete)?.nombre ?? paqueteNombre(s.paquete)}</p>
                    <p className="mt-1 text-sm text-[#1A1A1A]/58">{s.objetivo}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${estadoClase(s.estado)}`}>
                    {s.estado}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[#1A1A1A]/50 sm:grid-cols-3">
                  <span>Producto: {s.producto?.nombre ?? 'Tienda completa'}</span>
                  <span>Fecha: {fechaCorta(s.inicio)} - {fechaCorta(s.fin)}</span>
                  <span>Presupuesto: {s.presupuestoCOP ? formatearPrecio(Number(s.presupuestoCOP)) : 'Por definir'}</span>
                </div>
                <div className="mt-4 rounded-2xl border border-[#1A1A1A]/8 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${pagoClase(s.pagoEstado)}`}>
                        {pagoTexto(s.pagoEstado)}
                      </span>
                      <p className="mt-2 text-xs text-[#1A1A1A]/50">
                        Monto pauta: {formatearPrecio(Number(s.pagoMontoCOP || s.presupuestoCOP || 0))}
                        {s.pagoProviderReference || s.pagoReferencia
                          ? ` - Ref. ${s.pagoProviderReference || s.pagoReferencia}`
                          : ' - Referencia pendiente'}
                      </p>
                      {s.estado === 'PENDIENTE' && (
                        <p className="mt-1 text-xs text-[#9B7300]">El pago se habilita cuando AfroMedia apruebe editorialmente la solicitud.</p>
                      )}
                      {s.pagoNotas && (
                        <p className="mt-1 text-xs text-[#1A1A1A]/45">{s.pagoNotas}</p>
                      )}
                    </div>
                    {s.estado === 'APROBADA' && !['PAGADA', 'CORTESIA'].includes(String(s.pagoEstado || '')) && (
                      <button
                        type="button"
                        disabled={pagandoId === s.id}
                        onClick={() => void iniciarPago(s.id)}
                        className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#245a42] disabled:opacity-50"
                      >
                        {pagandoId === s.id ? 'Abriendo pago...' : 'Pagar pauta'}
                      </button>
                    )}
                  </div>
                </div>
                {s.notasAdmin && (
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-[#1A1A1A]/60">
                    Nota AfroMedia: {s.notasAdmin}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
