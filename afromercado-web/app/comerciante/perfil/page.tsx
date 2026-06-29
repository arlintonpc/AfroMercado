'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CampoTexto, CampoArea, CampoSelect } from '@/components/comerciante/Campos'
import { MUNICIPIOS_CHOCO } from '@/components/comerciante/constantes'
import { useAuth } from '@/context/AuthContext'
import {
  obtenerMiComercio,
  actualizarComercio,
  obtenerCuentaDispersion,
  guardarCuentaDispersion,
  subirDocumentoComercio,
  subirVideoComercio,
  quitarVideoComercio,
  type Comercio,
  type CuentaDispersion,
  type LadoDocumento,
  type TipoDocumento,
  type TipoCuentaDispersion,
} from '@/components/comerciante/api'
import { obtenerReglasPublicas } from '@/lib/api/config'
import SubidorVideo from '@/components/comerciante/SubidorVideo'

const BANCOS_DISPERSION = [
  { valor: 'BANCOLOMBIA', etiqueta: 'Bancolombia' },
  { valor: 'DAVIVIENDA', etiqueta: 'Davivienda' },
  { valor: 'BANCO_BOGOTA', etiqueta: 'Banco de Bogota' },
  { valor: 'BBVA', etiqueta: 'BBVA Colombia' },
  { valor: 'BANCO_OCCIDENTE', etiqueta: 'Banco de Occidente' },
  { valor: 'BANCO_CAJA_SOCIAL', etiqueta: 'Banco Caja Social' },
  { valor: 'BANCO_AGRARIO', etiqueta: 'Banco Agrario' },
  { valor: 'NU', etiqueta: 'Nu Colombia' },
  { valor: 'NEQUI', etiqueta: 'Nequi' },
  { valor: 'DAVIPLATA', etiqueta: 'DaviPlata' },
]

const TIPOS_CUENTA: { valor: TipoCuentaDispersion; etiqueta: string }[] = [
  { valor: 'AHORROS', etiqueta: 'Cuenta de ahorros' },
  { valor: 'CORRIENTE', etiqueta: 'Cuenta corriente' },
  { valor: 'BILLETERA_DIGITAL', etiqueta: 'Billetera digital soportada' },
]

const TIPOS_DOCUMENTO_CUENTA: { valor: TipoDocumento; etiqueta: string }[] = [
  { valor: 'CC', etiqueta: 'Cedula de ciudadania (CC)' },
  { valor: 'CE', etiqueta: 'Cedula de extranjeria (CE)' },
  { valor: 'PEP', etiqueta: 'Permiso especial de permanencia (PEP)' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
  { valor: 'NIT', etiqueta: 'NIT (empresa)' },
]

const MIME_DOCUMENTO_PERMITIDOS = ['image/jpeg', 'image/png']
const MIN_DOCUMENTO_BYTES = 40 * 1024
const MAX_DOCUMENTO_BYTES = 5 * 1024 * 1024
const MIN_DOCUMENTO_LADO_CORTO = 360
const MIN_DOCUMENTO_LADO_LARGO = 600
const MIN_DOCUMENTO_DENSIDAD_BORDES = 0.14
const MIN_DOCUMENTO_COBERTURA_NO_BLANCA = 0.28
const MIN_DOCUMENTO_COBERTURA_OSCURA = 0.035

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No pudimos leer la imagen.'))
    }
    img.src = url
  })
}

async function hashArchivoDocumento(file: File) {
  const buffer = await file.arrayBuffer()
  const digest = await window.crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function analizarDetalleDocumento(img: HTMLImageElement) {
  const ancho = 96
  const alto = 96
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No pudimos analizar la imagen.')

  // Fondo blanco para no contar transparencias como detalle falso.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, ancho, alto)
  ctx.drawImage(img, 0, 0, ancho, alto)

  const data = ctx.getImageData(0, 0, ancho, alto).data
  const lumas = new Float32Array(ancho * alto)
  let noBlancos = 0
  let oscuros = 0

  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      const i = (y * ancho + x) * 4
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      lumas[y * ancho + x] = lum
      if (lum < 245) noBlancos += 1
      if (lum < 180) oscuros += 1
    }
  }

  let bordes = 0
  let pares = 0
  for (let y = 0; y < alto - 1; y += 1) {
    for (let x = 0; x < ancho - 1; x += 1) {
      const actual = lumas[y * ancho + x]
      const derecha = lumas[y * ancho + x + 1]
      const abajo = lumas[(y + 1) * ancho + x]
      if (Math.abs(actual - derecha) > 18) bordes += 1
      if (Math.abs(actual - abajo) > 18) bordes += 1
      pares += 2
    }
  }

  const total = ancho * alto
  return {
    densidadBordes: bordes / pares,
    coberturaNoBlanca: noBlancos / total,
    coberturaOscura: oscuros / total,
  }
}

async function validarArchivoDocumento(file: File) {
  if (!MIME_DOCUMENTO_PERMITIDOS.includes(file.type)) {
    throw new Error('Sube una foto real del documento en JPG o PNG. No uses logos, PDFs ni capturas.')
  }
  if (file.size < MIN_DOCUMENTO_BYTES) {
    throw new Error('La imagen parece demasiado liviana para ser una foto legible del documento.')
  }
  if (file.size > MAX_DOCUMENTO_BYTES) {
    throw new Error('La foto supera 5 MB. Toma una nueva foto o comprimela.')
  }

  const img = await cargarImagen(file)
  const width = img.naturalWidth
  const height = img.naturalHeight
  const ladoCorto = Math.min(width, height)
  const ladoLargo = Math.max(width, height)
  if (ladoCorto < MIN_DOCUMENTO_LADO_CORTO || ladoLargo < MIN_DOCUMENTO_LADO_LARGO) {
    throw new Error('La foto no tiene suficiente resolucion. Debe verse el documento completo y legible.')
  }
  if (ladoLargo / ladoCorto > 2.8) {
    throw new Error('La imagen parece demasiado recortada. Sube el documento completo, sin cortar bordes.')
  }

  const detalle = analizarDetalleDocumento(img)
  const pareceLogoOSimple =
    detalle.densidadBordes < MIN_DOCUMENTO_DENSIDAD_BORDES ||
    detalle.coberturaNoBlanca < MIN_DOCUMENTO_COBERTURA_NO_BLANCA ||
    detalle.coberturaOscura < MIN_DOCUMENTO_COBERTURA_OSCURA

  if (pareceLogoOSimple) {
    throw new Error('La imagen no parece un documento de identidad legible. Debe verse la cedula/documento completo con texto, numero, foto o codigo; no logos, carnets ni imagenes simples.')
  }
}

function etiquetaEstadoCuenta(cuenta: CuentaDispersion | null) {
  if (!cuenta) return 'Sin cuenta registrada'
  if (cuenta.estado === 'VERIFICADA' && cuenta.proveedor === 'SANDBOX') return 'Cuenta registrada en modo prueba'
  if (cuenta.estado === 'VERIFICADA') return 'Cuenta verificada por pasarela'
  if (cuenta.estado === 'RECHAZADA') return 'Cuenta rechazada'
  if (cuenta.estado === 'SUSPENDIDA') return 'Cuenta suspendida'
  return 'Pendiente de verificacion'
}

function esCuentaRealVerificada(cuenta: CuentaDispersion | null) {
  return cuenta?.estado === 'VERIFICADA' && cuenta.proveedor !== 'SANDBOX'
}

function detalleEstadoCuenta(cuenta: CuentaDispersion | null) {
  if (!cuenta) return null
  if (cuenta.estado === 'VERIFICADA' && cuenta.proveedor === 'SANDBOX') {
    return 'Modo SANDBOX: sirve para probar el flujo, pero no valida la cuenta ni dispersa dinero real.'
  }
  if (cuenta.estado === 'VERIFICADA') {
    return 'La pasarela confirmo esta cuenta para recibir dispersiones.'
  }
  return null
}

function requisitosDocumentoIdentidad(tipo?: TipoDocumento | null) {
  if (tipo === 'CC' || tipo === 'TI') {
    return {
      nombre: tipo === 'CC' ? 'cedula de ciudadania colombiana' : 'tarjeta de identidad colombiana',
      frente: 'Debe verse Republica de Colombia, numero, nombres, apellidos, foto y firma.',
      reverso: 'Debe verse huella, codigo de barras, fecha/lugar de expedicion y datos del reverso.',
      rechazo: 'No sirve libreta militar, carnet, certificacion, recibo, logo ni documento de otra persona.',
    }
  }
  if (tipo === 'NIT') {
    return {
      nombre: 'documento legal de empresa',
      frente: 'Debe verse el NIT/RUT o soporte legal donde aparezca razon social y numero.',
      reverso: 'Sube el reverso o una segunda pagina legible del soporte legal si aplica.',
      rechazo: 'No sirve logo, tarjeta comercial, recibo ni documento sin NIT visible.',
    }
  }
  return {
    nombre: 'documento de identidad registrado',
    frente: 'Debe verse numero, nombres completos, foto o datos principales del titular.',
    reverso: 'Debe verse codigo, zona de lectura o datos posteriores del mismo documento.',
    rechazo: 'No sirve libreta militar, carnet, recibo, logo ni documento de otra persona.',
  }
}

export default function PerfilComerciantePage() {
  const { usuario } = useAuth()
  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [cargando, setCargando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [departamento, setDepartamento] = useState('Chocó')
  const [municipio, setMunicipio] = useState('')
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)
  const [gpsEstado, setGpsEstado] = useState<'idle'|'buscando'|'ok'|'error'>('idle')
  const [descripcion, setDescripcion] = useState('')
  const [historia, setHistoria] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [vereda, setVereda] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [envioGratisDesde, setEnvioGratisDesde] = useState('')
  const [envioGratisPermitido, setEnvioGratisPermitido] = useState(false)
  const [cuentaDispersion, setCuentaDispersion] = useState<CuentaDispersion | null>(null)
  const [bancoCodigo, setBancoCodigo] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuentaDispersion | ''>('')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [titularNombre, setTitularNombre] = useState('')
  const [tipoDocumentoCuenta, setTipoDocumentoCuenta] = useState<TipoDocumento | ''>('')
  const [numeroDocumentoCuenta, setNumeroDocumentoCuenta] = useState('')
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null)

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Foto documento
  const [fotoDocumentoFrenteUrl, setFotoDocumentoFrenteUrl] = useState<string | null>(null)
  const [fotoDocumentoReversoUrl, setFotoDocumentoReversoUrl] = useState<string | null>(null)
  const [fotoDocumentoFrenteHash, setFotoDocumentoFrenteHash] = useState<string | null>(null)
  const [fotoDocumentoReversoHash, setFotoDocumentoReversoHash] = useState<string | null>(null)
  const [subiendoDocLado, setSubiendoDocLado] = useState<LadoDocumento | null>(null)
  const [errorDoc, setErrorDoc] = useState<string | null>(null)
  const inputDocFrenteRef = useRef<HTMLInputElement>(null)
  const inputDocReversoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    obtenerMiComercio()
      .then((c) => {
        if (!c) return
        setComercio(c)
        setNombre(c.nombre)
        setDepartamento((c as any).departamento ?? 'Chocó')
        setMunicipio(c.municipio)
        setDescripcion(c.descripcion ?? '')
        setHistoria(c.historia ?? '')
        setWhatsapp(c.whatsapp ?? '')
        setLogoUrl(c.logoUrl ?? '')
        setFotoDocumentoFrenteUrl(c.fotoDocumentoFrenteUrl ?? c.fotoDocumentoUrl ?? null)
        setFotoDocumentoReversoUrl(c.fotoDocumentoReversoUrl ?? null)
        setFotoDocumentoFrenteHash(c.fotoDocumentoFrenteHash ?? null)
        setFotoDocumentoReversoHash(c.fotoDocumentoReversoHash ?? null)
        setVereda(c.vereda ?? '')
        setLatitud(c.latitud ?? null)
        setLongitud(c.longitud ?? null)
        if (c.latitud && c.longitud) setGpsEstado('ok')
        setEnvioGratisDesde(c.envioGratisDesde != null ? String(Number(c.envioGratisDesde)) : '')
        setTitularNombre(c.nombre)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    obtenerCuentaDispersion()
      .then((cuenta) => {
        setCuentaDispersion(cuenta)
        if (!cuenta) return
        setBancoCodigo(cuenta.bancoCodigo)
        setTipoCuenta(cuenta.tipoCuenta)
        setTitularNombre(cuenta.titularNombre)
        setTipoDocumentoCuenta(cuenta.tipoDocumento)
        setNumeroDocumentoCuenta(cuenta.numeroDocumento)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!tipoDocumentoCuenta && usuario?.tipoDocumento) {
      setTipoDocumentoCuenta(usuario.tipoDocumento)
    }
    if (!numeroDocumentoCuenta && usuario?.numeroDocumento) {
      setNumeroDocumentoCuenta(usuario.numeroDocumento)
    }
  }, [usuario?.tipoDocumento, usuario?.numeroDocumento, tipoDocumentoCuenta, numeroDocumentoCuenta])

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

  function detectarUbicacionLocal() {
    if (!navigator.geolocation) { setGpsEstado('error'); return }
    setGpsEstado('buscando')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitud(coords.latitude)
        setLongitud(coords.longitude)
        setGpsEstado('ok')
      },
      () => setGpsEstado('error'),
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setGuardando(true)
    try {
      const actualizado = await actualizarComercio({
        nombre: nombre.trim(),
        departamento: departamento || undefined,
        municipio,
        latitud: latitud ?? undefined,
        longitud: longitud ?? undefined,
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

  async function subirDoc(e: React.ChangeEvent<HTMLInputElement>, lado: LadoDocumento) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoDocLado(lado)
    setErrorDoc(null)
    try {
      await validarArchivoDocumento(file)
      const hashSeleccionado = await hashArchivoDocumento(file)
      const hashOpuesto = lado === 'FRENTE' ? fotoDocumentoReversoHash : fotoDocumentoFrenteHash
      if (hashOpuesto && hashOpuesto === hashSeleccionado) {
        throw new Error('No puedes usar la misma foto para el frente y el reverso del documento.')
      }
      const respuesta = await subirDocumentoComercio(file, lado)
      const { url, hash } = respuesta
      if (lado === 'FRENTE') {
        setFotoDocumentoFrenteUrl(url)
        setFotoDocumentoFrenteHash(hash ?? hashSeleccionado)
      } else {
        setFotoDocumentoReversoUrl(url)
        setFotoDocumentoReversoHash(hash ?? hashSeleccionado)
      }
      if (respuesta.comercio) {
        setComercio(respuesta.comercio)
      }
      setAviso({
        tipo: 'exito',
        texto: respuesta.requiereRevision
          ? `${lado === 'FRENTE' ? 'Frente' : 'Reverso'} actualizado. Por seguridad tu tienda volvio a revision y tus productos quedaron pausados hasta una nueva aprobacion.`
          : `${lado === 'FRENTE' ? 'Frente' : 'Reverso'} del documento subido.`,
      })
    } catch (err) {
      setErrorDoc(err instanceof Error ? err.message : 'No se pudo subir el archivo.')
    } finally {
      setSubiendoDocLado(null)
      if (lado === 'FRENTE' && inputDocFrenteRef.current) inputDocFrenteRef.current.value = ''
      if (lado === 'REVERSO' && inputDocReversoRef.current) inputDocReversoRef.current.value = ''
    }
  }

  async function guardarCuenta(e: React.FormEvent) {
    e.preventDefault()
    setErrorCuenta(null)
    if (!bancoCodigo) {
      setErrorCuenta('Elige el banco o billetera donde recibiras las ventas.')
      return
    }
    if (!tipoCuenta) {
      setErrorCuenta('Elige el tipo de cuenta.')
      return
    }
    const cuentaLimpia = numeroCuenta.replace(/\D/g, '')
    if (cuentaLimpia.length < 6) {
      setErrorCuenta('Escribe el numero completo de la cuenta.')
      return
    }
    if (!tipoDocumentoCuenta) {
      setErrorCuenta('Elige el tipo de documento del titular de la cuenta.')
      return
    }
    if (!numeroDocumentoCuenta.trim()) {
      setErrorCuenta('Escribe el numero de documento del titular de la cuenta.')
      return
    }
    setGuardandoCuenta(true)
    try {
      const resultado = await guardarCuentaDispersion({
        bancoCodigo,
        tipoCuenta: tipoCuenta as TipoCuentaDispersion,
        numeroCuenta: cuentaLimpia,
        titularNombre: titularNombre.trim() || undefined,
        tipoDocumento: tipoDocumentoCuenta as TipoDocumento,
        numeroDocumento: numeroDocumentoCuenta.trim(),
      })
      setCuentaDispersion(resultado.cuenta)
      if (resultado.comercio) {
        setComercio(resultado.comercio)
      }
      setNumeroCuenta('')
      setAviso({
        tipo: 'exito',
        texto: resultado.requiereRevision
          ? 'Cuenta de dispersion guardada. Por seguridad tu tienda volvio a revision y tus productos quedaron pausados hasta una nueva aprobacion.'
          : 'Cuenta de dispersion guardada.',
      })
    } catch (err) {
      setErrorCuenta(err instanceof Error ? err.message : 'No pudimos guardar la cuenta.')
    } finally {
      setGuardandoCuenta(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[#1A1A1A]/50">Cargando…</p>
      </div>
    )
  }

  const cuentaRealVerificada = esCuentaRealVerificada(cuentaDispersion)
  const detalleCuenta = detalleEstadoCuenta(cuentaDispersion)
  const requisitosDoc = requisitosDocumentoIdentidad(usuario?.tipoDocumento)

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

      <form onSubmit={guardarCuenta} className="flex flex-col gap-5 rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#1A1A1A]">Cuenta para recibir pagos</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            La pasarela usara esta cuenta para dispersar tus ventas. AfroMercado no recibe pagos manuales ni comprobantes.
          </p>
        </div>

        <div className={[
          'rounded-xl border px-4 py-3 text-sm',
          cuentaRealVerificada
            ? 'border-[#52B788]/30 bg-[#52B788]/8 text-[#2D6A4F]'
            : 'border-[#D4A017]/30 bg-[#D4A017]/8 text-[#9B7300]',
        ].join(' ')}>
          <strong>{etiquetaEstadoCuenta(cuentaDispersion)}</strong>
          {cuentaDispersion && (
            <span>
              {' '}({cuentaDispersion.bancoNombre}, {cuentaDispersion.tipoCuenta.toLowerCase()}, terminada en {cuentaDispersion.numeroCuentaUltimos4})
            </span>
          )}
          {detalleCuenta && (
            <p className="mt-1 text-xs leading-relaxed opacity-80">{detalleCuenta}</p>
          )}
        </div>

        <CampoSelect
          label="Banco o billetera"
          name="bancoCodigo"
          placeholder="Elige donde quieres recibir"
          value={bancoCodigo}
          onChange={setBancoCodigo}
          opciones={BANCOS_DISPERSION}
        />

        <CampoSelect
          label="Tipo de cuenta"
          name="tipoCuenta"
          placeholder="Elige el tipo"
          value={tipoCuenta}
          onChange={(v) => setTipoCuenta(v as TipoCuentaDispersion | '')}
          opciones={TIPOS_CUENTA}
        />

        <CampoTexto
          label="Numero de cuenta"
          name="numeroCuenta"
          type="tel"
          inputMode="numeric"
          placeholder={cuentaDispersion ? `Actual termina en ${cuentaDispersion.numeroCuentaUltimos4}` : 'Escribe el numero completo'}
          value={numeroCuenta}
          onChange={(v) => setNumeroCuenta(v.replace(/\D/g, ''))}
          hint="Por seguridad solo guardamos una huella y los ultimos 4 digitos."
        />

        <CampoTexto
          label="Nombre del titular"
          name="titularNombre"
          placeholder="Debe coincidir con el documento del comercio"
          value={titularNombre}
          onChange={setTitularNombre}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
          <CampoSelect
            label="Tipo de documento"
            name="tipoDocumentoCuenta"
            placeholder="Elige"
            value={tipoDocumentoCuenta}
            onChange={(v) => setTipoDocumentoCuenta(v as TipoDocumento | '')}
            opciones={TIPOS_DOCUMENTO_CUENTA}
          />

          <CampoTexto
            label="Numero de documento"
            name="numeroDocumentoCuenta"
            placeholder="Documento del titular"
            value={numeroDocumentoCuenta}
            onChange={(v) => setNumeroDocumentoCuenta(v.trim())}
            hint="Debe corresponder al titular de la cuenta registrada."
          />
        </div>

        {errorCuenta && (
          <div role="alert" className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]">
            {errorCuenta}
          </div>
        )}

        <Button type="submit" loading={guardandoCuenta} className="w-full">
          Guardar cuenta de dispersion
        </Button>
      </form>

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
          label="Departamento"
          name="departamento"
          value={departamento}
          onChange={(v) => { setDepartamento(v); setMunicipio('') }}
          opciones={[
            'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas',
            'Caquetá','Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca',
            'Bogotá D.C.','Guainía','Guaviare','Huila','La Guajira','Magdalena','Meta',
            'Nariño','Norte de Santander','Putumayo','Quindío','Risaralda','San Andrés',
            'Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada',
          ].map((d) => ({ valor: d, etiqueta: d }))}
          error={errores.departamento}
        />

        {departamento === 'Chocó' ? (
          <CampoSelect
            label="Municipio"
            name="municipio"
            value={municipio}
            onChange={setMunicipio}
            opciones={MUNICIPIOS_CHOCO.map((m) => ({ valor: m, etiqueta: m }))}
            error={errores.municipio}
          />
        ) : (
          <CampoTexto
            label="Municipio / Ciudad"
            name="municipio"
            placeholder="Ej: Medellín, Bogotá, Cali…"
            value={municipio}
            onChange={setMunicipio}
            error={errores.municipio}
          />
        )}

        <CampoTexto
          label="Vereda o barrio"
          name="vereda"
          placeholder="Ej: Vereda La Vuelta, Barrio Kennedy"
          value={vereda}
          onChange={setVereda}
          hint="Opcional. Ayuda a los compradores a ubicarte mejor."
        />

        {/* Ubicación GPS del local */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Ubicación del local (GPS)</label>
          <button
            type="button"
            onClick={detectarUbicacionLocal}
            disabled={gpsEstado === 'buscando'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              gpsEstado === 'ok'
                ? 'bg-green-50 text-green-700 border-green-300'
                : gpsEstado === 'error'
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            {gpsEstado === 'buscando' ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
              </svg>
            )}
            {gpsEstado === 'ok'
              ? `Ubicación guardada (${latitud?.toFixed(4)}, ${longitud?.toFixed(4)})`
              : gpsEstado === 'error'
              ? 'No se pudo obtener la ubicación — intenta de nuevo'
              : latitud
              ? `Actualizar ubicación (${latitud.toFixed(4)}, ${longitud?.toFixed(4)})`
              : 'Detectar ubicación del local'}
          </button>
          <p className="text-xs text-gray-400">Abre esta página desde el local para capturar la ubicación correcta. Esto permite que los clientes vean la distancia.</p>
        </div>

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

      {comercio && (
        <SubidorVideo
          titulo="Video de la tienda"
          descripcion="Cuenta la historia de tu comercio, muestra tu finca, tu cocina, tu proceso o aquello que quieres que el cliente recuerde."
          estadoInicial={{
            videoUrl: comercio.videoUrl ?? null,
            videoPosterUrl: comercio.videoPosterUrl ?? null,
            videoDuracionSegundos: comercio.videoDuracionSegundos ?? null,
            videoMimeType: comercio.videoMimeType ?? null,
          }}
          onSubir={(file, meta) => subirVideoComercio(file, meta)}
          onEliminar={() => quitarVideoComercio()}
        />
      )}

      {/* Sección de documento */}
      <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1A1A1A]">Documento de identidad</h2>
          <p className="mt-1 text-sm text-[#1A1A1A]/55">
            Sube una foto real del frente y otra del reverso de tu {requisitosDoc.nombre}. El equipo las usa para verificar tu identidad; solo las ve el administrador.
          </p>
        </div>

        <div className="rounded-xl border border-[#D4A017]/25 bg-[#D4A017]/8 px-4 py-3 text-xs leading-relaxed text-[#9B7300]">
          Validacion automatica basica: JPG/PNG, buena resolucion, foto completa y legible. {requisitosDoc.rechazo} La autenticidad final la confirma el administrador.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-[#1A1A1A]/10 p-3">
            <div>
              <p className="text-sm font-bold text-[#1A1A1A]">Frente del documento</p>
              <p className="text-xs text-[#1A1A1A]/50">{requisitosDoc.frente}</p>
            </div>
            <div className="relative h-40 w-full overflow-hidden rounded-xl border border-[#1A1A1A]/10 bg-[#F7F2EA]">
              {fotoDocumentoFrenteUrl ? (
                <Image
                  src={fotoDocumentoFrenteUrl}
                  alt="Frente del documento"
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs font-medium text-[#1A1A1A]/45">
                  Falta subir el frente
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={subiendoDocLado === 'FRENTE'}
              disabled={Boolean(subiendoDocLado)}
              onClick={() => inputDocFrenteRef.current?.click()}
            >
              {fotoDocumentoFrenteUrl ? 'Cambiar frente' : 'Subir frente'}
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-[#1A1A1A]/10 p-3">
            <div>
              <p className="text-sm font-bold text-[#1A1A1A]">Reverso del documento</p>
              <p className="text-xs text-[#1A1A1A]/50">{requisitosDoc.reverso}</p>
            </div>
            <div className="relative h-40 w-full overflow-hidden rounded-xl border border-[#1A1A1A]/10 bg-[#F7F2EA]">
              {fotoDocumentoReversoUrl ? (
                <Image
                  src={fotoDocumentoReversoUrl}
                  alt="Reverso del documento"
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs font-medium text-[#1A1A1A]/45">
                  Falta subir el reverso
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={subiendoDocLado === 'REVERSO'}
              disabled={Boolean(subiendoDocLado)}
              onClick={() => inputDocReversoRef.current?.click()}
            >
              {fotoDocumentoReversoUrl ? 'Cambiar reverso' : 'Subir reverso'}
            </Button>
          </div>
        </div>

        {errorDoc && (
          <p className="text-sm text-[#C0392B]">{errorDoc}</p>
        )}

        <input
          ref={inputDocFrenteRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={(e) => subirDoc(e, 'FRENTE')}
        />
        <input
          ref={inputDocReversoRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={(e) => subirDoc(e, 'REVERSO')}
        />
      </div>
    </div>
  )
}
