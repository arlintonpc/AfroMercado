'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { CampoTexto } from '@/components/comerciante/Campos'
import { obtenerMiComercio } from '@/components/comerciante/api'

type Modo = 'login' | 'registro'

export default function ComercianteIngresarPage() {
  const router = useRouter()
  const { login, registro } = useAuth()

  const [modo, setModo] = useState<Modo>('login')

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function limpiar() {
    setErrores({})
    setErrorGeneral(null)
  }

  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return
    setModo(nuevo)
    limpiar()
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (modo === 'registro') {
      if (!nombre.trim()) e.nombre = 'Por favor escribe tu nombre.'
      const tel = telefono.replace(/\D/g, '')
      if (!tel) e.telefono = 'Escribe tu número de celular.'
      else if (tel.length !== 10)
        e.telefono = 'El celular debe tener 10 números.'
    }
    if (!email.trim()) e.email = 'Escribe tu correo.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'Ese correo no parece correcto.'
    if (!password) e.password = 'Escribe tu contraseña.'
    else if (modo === 'registro' && password.length < 6)
      e.password = 'Usa mínimo 6 caracteres.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function manejarSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    limpiar()
    if (enviando) return
    if (!validar()) return

    setEnviando(true)
    try {
      let usuario
      if (modo === 'login') {
        usuario = await login(email.trim(), password)
      } else {
        usuario = await registro({
          nombre: nombre.trim(),
          email: email.trim(),
          password,
          telefono: telefono.replace(/\D/g, ''),
          rol: 'COMERCIANTE',
        })
      }

      if (usuario.rol !== 'COMERCIANTE') {
        setErrorGeneral(
          'Esta cuenta no es de vendedor. Crea una cuenta de vendedor para continuar.',
        )
        setEnviando(false)
        return
      }

      // Decidir a dónde ir: ¿ya tiene comercio?
      const comercio = await obtenerMiComercio()
      if (comercio) {
        router.replace('/comerciante/dashboard')
      } else {
        router.replace('/comerciante/registro-comercio')
      }
    } catch (err) {
      setErrorGeneral(
        err instanceof Error
          ? err.message
          : 'No pudimos continuar. Intenta de nuevo.',
      )
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Encabezado motivador */}
        <div className="text-center mb-6">
          <Link
            href="/"
            className="inline-block text-3xl"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            <span className="text-[#2D6A4F]">Afro</span>
            <span className="text-[#D4A017]">Mercado</span>
          </Link>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#52B788]">
            Vendedor
          </p>
          <h1
            className="mt-4 text-2xl text-[#1A1A1A] leading-snug"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Vende lo que produces a todo el país
          </h1>
          <p className="mt-2 text-base text-[#1A1A1A]/60 leading-relaxed">
            Abre tu tienda en AfroMercado y llega a más compradores.
          </p>
        </div>

        {/* Tarjeta */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-[#1A1A1A]/5 p-6">
          {/* Pestañas */}
          <div
            className="grid grid-cols-2 gap-1 p-1 mb-6 bg-[#F8F5F0] rounded-xl"
            role="tablist"
            aria-label="Ingresar o crear cuenta de vendedor"
          >
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'login'}
              onClick={() => cambiarModo('login')}
              className={`min-h-[48px] rounded-lg text-base font-semibold transition-colors ${
                modo === 'login'
                  ? 'bg-white text-[#2D6A4F] shadow-sm'
                  : 'text-[#1A1A1A]/50'
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'registro'}
              onClick={() => cambiarModo('registro')}
              className={`min-h-[48px] rounded-lg text-base font-semibold transition-colors ${
                modo === 'registro'
                  ? 'bg-white text-[#2D6A4F] shadow-sm'
                  : 'text-[#1A1A1A]/50'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={manejarSubmit} className="flex flex-col gap-4" noValidate>
            {modo === 'registro' && (
              <>
                <CampoTexto
                  label="¿Cómo te llamas?"
                  name="nombre"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={setNombre}
                  error={errores.nombre}
                />
                <CampoTexto
                  label="Tu celular"
                  name="telefono"
                  type="tel"
                  inputMode="numeric"
                  placeholder="300 123 4567"
                  value={telefono}
                  onChange={setTelefono}
                  error={errores.telefono}
                  hint="10 números. Lo usamos para contactarte."
                />
              </>
            )}

            <CampoTexto
              label="Tu correo"
              name="email"
              type="email"
              inputMode="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={setEmail}
              error={errores.email}
            />

            <CampoTexto
              label="Tu contraseña"
              name="password"
              type="password"
              placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              value={password}
              onChange={setPassword}
              error={errores.password}
            />

            {errorGeneral && (
              <div
                role="alert"
                className="rounded-xl bg-[#C0392B]/10 border border-[#C0392B]/20 px-4 py-3 text-sm text-[#C0392B]"
              >
                {errorGeneral}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              loading={enviando}
              className="w-full mt-1"
            >
              {modo === 'login' ? 'Ingresar' : 'Crear mi cuenta de vendedor'}
            </Button>
          </form>

          <p className="mt-6 text-center text-base text-[#1A1A1A]/60">
            {modo === 'login' ? (
              <>
                ¿Aún no vendes con nosotros?{' '}
                <button
                  type="button"
                  onClick={() => cambiarModo('registro')}
                  className="font-semibold text-[#2D6A4F] underline"
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
                  className="font-semibold text-[#2D6A4F] underline"
                >
                  Ingresar
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[#1A1A1A]/40">
          ¿Quieres comprar?{' '}
          <Link href="/ingresar" className="underline hover:text-[#2D6A4F]">
            Entra como comprador
          </Link>
        </p>
      </div>
    </main>
  )
}
