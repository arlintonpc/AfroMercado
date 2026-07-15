'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { solicitarCodigo, verificarCodigo, cambiarPassword } from '@/lib/api/recuperacion'
import { PasswordInput } from '@/components/ui/PasswordInput'

type Paso = 'email' | 'codigo' | 'nueva-password' | 'exito'

export default function RecuperarPassword() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('email')

  // Paso 1
  const [email, setEmail] = useState('')

  // Paso 2
  const [codigo, setCodigo] = useState('')
  const [tiempoRestante, setTiempoRestante] = useState(600) // 10 min en segundos
  const [puedeReenviar, setPuedeReenviar] = useState(false)
  const [cooldownReenvio, setCooldownReenvio] = useState(0)
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Paso 3
  const [resetToken, setResetToken] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')

  // Estado general
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState('')

  // Contador para el código OTP
  useEffect(() => {
    if (paso !== 'codigo') return
    setTiempoRestante(600)
    setPuedeReenviar(false)
    setCooldownReenvio(60)

    intervaloRef.current = setInterval(() => {
      setTiempoRestante((t) => {
        if (t <= 1) {
          clearInterval(intervaloRef.current!)
          return 0
        }
        return t - 1
      })
      setCooldownReenvio((c) => {
        if (c <= 1) {
          setPuedeReenviar(true)
          return 0
        }
        return c - 1
      })
    }, 1000)

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
    }
  }, [paso])

  function formatearTiempo(segundos: number) {
    const m = Math.floor(segundos / 60)
    const s = segundos % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function handleSolicitarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setCargando(true)
    try {
      await solicitarCodigo(email.trim().toLowerCase())
      setPaso('codigo')
    } catch {
      // Incluso si falla, mostrar mensaje genérico (no revelar existencia del email)
      setPaso('codigo')
    } finally {
      setCargando(false)
    }
  }

  async function handleReenviar() {
    if (!puedeReenviar) return
    setError(null)
    setPuedeReenviar(false)
    setCooldownReenvio(60)
    try {
      await solicitarCodigo(email.trim().toLowerCase())
      setTiempoRestante(600)
    } catch {
      // ignorar — mostrar igual
    }
  }

  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    const codigoLimpio = codigo.replace(/\D/g, '').slice(0, 6)
    if (codigoLimpio.length !== 6) {
      setError('Ingresa los 6 dígitos del código.')
      return
    }
    setError(null)
    setCargando(true)
    try {
      const { resetToken: token } = await verificarCodigo(email, codigoLimpio)
      setResetToken(token)
      setPaso('nueva-password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto o expirado.')
    } finally {
      setCargando(false)
    }
  }

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    if (nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError(null)
    setCargando(true)
    try {
      const { mensaje } = await cambiarPassword(resetToken, nuevaPassword)
      setMensajeExito(mensaje)
      setPaso('exito')
      setTimeout(() => router.push('/ingresar'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cambiar la contraseña.')
    } finally {
      setCargando(false)
    }
  }

  const pasos: Paso[] = ['email', 'codigo', 'nueva-password']
  const indicePaso = pasos.indexOf(paso as Paso)

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-8 text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        <span className="text-[#2D6A4F]">Tera</span><span className="text-[#D4A017]">via</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#1A1A1A]/8 p-8">

        {/* Indicador de pasos */}
        {paso !== 'exito' && (
          <div className="flex items-center gap-2 mb-6">
            {pasos.map((p, i) => (
              <div key={p} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < indicePaso ? 'bg-[#2D6A4F] text-white' :
                  i === indicePaso ? 'bg-[#D4A017] text-[#1A1A1A]' :
                  'bg-[#1A1A1A]/10 text-[#1A1A1A]/40'
                }`}>
                  {i < indicePaso ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : i + 1}
                </div>
                {i < pasos.length - 1 && (
                  <div className={`flex-1 h-0.5 w-8 rounded ${i < indicePaso ? 'bg-[#2D6A4F]' : 'bg-[#1A1A1A]/10'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error general */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* PASO 1 — Email */}
        {paso === 'email' && (
          <form onSubmit={handleSolicitarCodigo} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-[#1A1A1A]/55 mt-1">
                Ingresa tu correo y te enviaremos un código para recuperarla.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1A1A1A]">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
                className="w-full h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={cargando || !email.trim()}
              className="w-full h-11 bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {cargando ? 'Enviando…' : 'Enviar código'}
            </button>

            <Link href="/ingresar" className="text-center text-sm text-[#2D6A4F] hover:underline">
              ← Volver a iniciar sesión
            </Link>
          </form>
        )}

        {/* PASO 2 — Código OTP */}
        {paso === 'codigo' && (
          <form onSubmit={handleVerificarCodigo} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">Revisa tu correo</h1>
              <p className="text-sm text-[#1A1A1A]/55 mt-1">
                Si <strong>{email}</strong> está registrado, recibirás un código de 6 dígitos.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#1A1A1A]">Código de verificación</label>
                <span className={`text-xs font-mono ${tiempoRestante < 60 ? 'text-red-500' : 'text-[#1A1A1A]/40'}`}>
                  {tiempoRestante > 0 ? formatearTiempo(tiempoRestante) : 'Expirado'}
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full h-14 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] text-2xl text-center font-mono tracking-[0.3em] placeholder:text-[#1A1A1A]/20 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
              />
            </div>

            {tiempoRestante === 0 && (
              <p className="text-sm text-red-600 text-center">
                El código expiró.{' '}
                <button type="button" onClick={() => setPaso('email')} className="font-semibold underline">
                  Solicita uno nuevo
                </button>
              </p>
            )}

            <button
              type="submit"
              disabled={cargando || codigo.length !== 6 || tiempoRestante === 0}
              className="w-full h-11 bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {cargando ? 'Verificando…' : 'Verificar código'}
            </button>

            <div className="text-center text-sm text-[#1A1A1A]/55">
              ¿No te llegó?{' '}
              {puedeReenviar ? (
                <button type="button" onClick={handleReenviar} className="text-[#2D6A4F] font-semibold hover:underline">
                  Reenviar código
                </button>
              ) : (
                <span>Reenviar en {cooldownReenvio}s</span>
              )}
            </div>
          </form>
        )}

        {/* PASO 3 — Nueva contraseña */}
        {paso === 'nueva-password' && (
          <form onSubmit={handleCambiarPassword} className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">Nueva contraseña</h1>
              <p className="text-sm text-[#1A1A1A]/55 mt-1">
                Elige una contraseña segura de al menos 6 caracteres.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1A1A1A]">Nueva contraseña</label>
              <PasswordInput
                value={nuevaPassword}
                onChange={setNuevaPassword}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                inputClassName="h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1A1A1A]">Confirmar contraseña</label>
              <PasswordInput
                value={confirmarPassword}
                onChange={setConfirmarPassword}
                placeholder="Repite la contraseña"
                required
                inputClassName="h-11 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={cargando || nuevaPassword.length < 6}
              className="w-full h-11 bg-[#2D6A4F] hover:bg-[#245a42] text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {cargando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}

        {/* ÉXITO */}
        {paso === 'exito' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#52B788]/15 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1A1A1A]">¡Contraseña actualizada!</h1>
            <p className="text-sm text-[#1A1A1A]/55">{mensajeExito || 'Tu contraseña fue cambiada exitosamente.'}</p>
            <p className="text-xs text-[#1A1A1A]/40">Redirigiendo al inicio de sesión…</p>
            <Link
              href="/ingresar"
              className="mt-2 inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#245a42] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Iniciar sesión ahora
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
