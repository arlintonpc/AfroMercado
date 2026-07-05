'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Modo = 'login' | 'registro'

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center justify-center">
      <span className="text-3xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        <span className="text-[#2D6A4F]">Afro</span>
        <span className="text-[#D4A017]">Mercado</span>
      </span>
    </Link>
  )
}

function FormularioIngresar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const codigoReferido = searchParams.get('ref') || undefined
  const { login, registro } = useAuth()

  const [modo, setModo] = useState<Modo>(codigoReferido ? 'registro' : 'login')

  // Campos
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [autorizacionDatos, setAutorizacionDatos] = useState(false)

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function limpiarErrores() {
    setErrores({})
    setErrorGeneral(null)
  }

  function validarLogin(): boolean {
    const e: Record<string, string> = {}
    if (!email.trim()) e.email = 'Ingresa tu correo.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'Correo no válido.'
    if (!password) e.password = 'Ingresa tu contraseña.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function validarRegistro(): boolean {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'Dinos tu nombre.'
    const tel = telefono.replace(/\D/g, '')
    if (!tel) e.telefono = 'Ingresa tu celular.'
    else if (tel.length !== 10) e.telefono = 'El celular debe tener 10 dígitos.'
    if (!email.trim()) e.email = 'Ingresa tu correo.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'Correo no válido.'
    if (!password) e.password = 'Crea una contraseña.'
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    limpiarErrores()
    if (enviando) return

    const valido = modo === 'login' ? validarLogin() : validarRegistro()
    if (!valido) return

    setEnviando(true)
    try {
      if (modo === 'login') {
        await login(email.trim(), password)
      } else {
        await registro({
          nombre: nombre.trim(),
          email: email.trim(),
          password,
          telefono: telefono.replace(/\D/g, ''),
          rol: 'COMPRADOR',
          autorizacionDatos: true,
          ...(codigoReferido ? { codigoReferido } : {}),
        })
      }
      router.replace(redirect)
    } catch (err) {
      setErrorGeneral(
        err instanceof Error
          ? err.message
          : 'No pudimos completar la operación. Inténtalo de nuevo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return
    setModo(nuevo)
    limpiarErrores()
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Logo />
          <p className="mt-2 text-sm text-[#1A1A1A]/60">
            {modo === 'login'
              ? 'Bienvenido de vuelta a lo mejor de Colombia'
              : 'Crea tu cuenta y apoya a los productores locales'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-[#1A1A1A]/5 p-6 md:p-8">
          {/* Tabs */}
          <div
            className="grid grid-cols-2 gap-1 p-1 mb-6 bg-[#F8F5F0] rounded-xl"
            role="tablist"
            aria-label="Ingresar o crear cuenta"
          >
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'login'}
              onClick={() => cambiarModo('login')}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                modo === 'login'
                  ? 'bg-white text-[#2D6A4F] shadow-sm'
                  : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80'
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'registro'}
              onClick={() => cambiarModo('registro')}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                modo === 'registro'
                  ? 'bg-white text-[#2D6A4F] shadow-sm'
                  : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {modo === 'registro' && (
              <>
                <Input
                  label="Nombre completo"
                  name="nombre"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  error={errores.nombre}
                />
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
                  {errores.telefono && (
                    <p className="text-xs text-red-600">{errores.telefono}</p>
                  )}
                  <p className="text-xs text-[#1A1A1A]/50">10 dígitos. Lo usamos para coordinar tu pedido.</p>
                </div>
              </>
            )}

            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errores.email}
            />

            <Input
              label="Contraseña"
              name="password"
              type="password"
              placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
            />

            {modo === 'login' && (
              <div className="flex justify-end">
                <Link href="/recuperar-password" className="text-xs text-[#2D6A4F] hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}

            {modo === 'registro' && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autorizacionDatos}
                  onChange={(e) => setAutorizacionDatos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#2D6A4F] flex-shrink-0"
                />
                <span className="text-xs text-[#1A1A1A]/60 leading-relaxed">
                  Acepto la{' '}
                  <a href="/privacidad" target="_blank" className="text-[#2D6A4F] hover:underline font-medium">
                    política de tratamiento de datos personales
                  </a>{' '}
                  de AfroMercado conforme a la Ley 1581 de 2012.
                </span>
              </label>
            )}

            {errorGeneral && (
              <div
                role="alert"
                className="rounded-lg bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
              >
                {errorGeneral}
              </div>
            )}

            <Button
              type="submit"
              loading={enviando}
              disabled={enviando || (modo === 'registro' && !autorizacionDatos)}
              className="w-full mt-1"
            >
              {modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </Button>
          </form>

          {/* Toggle inferior */}
          <p className="mt-6 text-center text-sm text-[#1A1A1A]/60">
            {modo === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => cambiarModo('registro')}
                  className="font-semibold text-[#2D6A4F] hover:underline"
                >
                  Crear cuenta
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => cambiarModo('login')}
                  className="font-semibold text-[#2D6A4F] hover:underline"
                >
                  Ingresar
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[#1A1A1A]/40">
          Al continuar aceptas nuestros{' '}
          <Link href="/terminos" className="underline hover:text-[#2D6A4F]">
            Términos
          </Link>{' '}
          y{' '}
          <Link href="/privacidad" className="underline hover:text-[#2D6A4F]">
            Política de privacidad
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

export default function PaginaIngresar() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center">
          <div className="skeleton h-72 w-full max-w-md rounded-2xl" />
        </div>
      }
    >
      <FormularioIngresar />
    </Suspense>
  )
}
