'use client'

import React, { useId } from 'react'

/**
 * Campos de formulario grandes y claros para el área del comerciante.
 * Pensados para usuarios con poca experiencia digital: etiquetas grandes,
 * áreas de toque amplias (mínimo 48px) y ayudas en lenguaje sencillo.
 *
 * Reusan el lenguaje visual del proyecto pero con bordes completos (caja)
 * en vez de la línea inferior del Input base, para que se vean como campos
 * fáciles de tocar en un smartphone básico.
 */

interface BaseProps {
  label: string
  name?: string
  error?: string
  hint?: string
  disabled?: boolean
  className?: string
}

const labelClase =
  'font-semibold text-base text-[#1A1A1A] font-[var(--font-inter)] leading-tight'

const cajaBase =
  'w-full bg-white rounded-xl border px-4 py-3 text-base text-[#1A1A1A] ' +
  'font-[var(--font-inter)] outline-none transition-colors duration-150 ' +
  'placeholder:text-[#1A1A1A]/40 min-h-[52px]'

function bordeEstado(error?: string, disabled?: boolean): string {
  if (disabled) return 'border-[#1A1A1A]/15 opacity-60 cursor-not-allowed'
  if (error) return 'border-[#C0392B] focus:border-[#C0392B]'
  return 'border-[#1A1A1A]/20 focus:border-[#D4A017]'
}

function Mensajes({
  error,
  hint,
  errorId,
  hintId,
}: {
  error?: string
  hint?: string
  errorId: string
  hintId: string
}) {
  return (
    <>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-[#C0392B] leading-snug">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className="text-sm text-[#1A1A1A]/55 leading-snug">
          {hint}
        </p>
      )}
    </>
  )
}

// ── CampoTexto: input de una línea (grande) ─────────────────────────────
interface CampoTextoProps extends BaseProps {
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
  value: string
  onChange: (valor: string) => void
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  prefijo?: string
}

export function CampoTexto({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  hint,
  disabled,
  className = '',
  inputMode,
  prefijo,
}: CampoTextoProps) {
  const generatedId = useId()
  const id = name ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className={labelClase}>
        {label}
      </label>
      <div className="relative flex items-center">
        {prefijo && (
          <span className="pointer-events-none absolute left-4 text-base font-semibold text-[#1A1A1A]/60">
            {prefijo}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className={[cajaBase, bordeEstado(error, disabled), prefijo ? 'pl-9' : '']
            .filter(Boolean)
            .join(' ')}
        />
      </div>
      <Mensajes error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  )
}

// ── CampoArea: textarea grande ──────────────────────────────────────────
interface CampoAreaProps extends BaseProps {
  placeholder?: string
  value: string
  onChange: (valor: string) => void
  rows?: number
}

export function CampoArea({
  label,
  name,
  placeholder,
  value,
  onChange,
  error,
  hint,
  disabled,
  className = '',
  rows = 4,
}: CampoAreaProps) {
  const generatedId = useId()
  const id = name ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className={labelClase}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={[cajaBase, 'resize-y leading-relaxed', bordeEstado(error, disabled)]
          .filter(Boolean)
          .join(' ')}
      />
      <Mensajes error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  )
}

// ── CampoSelect: select grande ──────────────────────────────────────────
interface OpcionSelect {
  valor: string
  etiqueta: string
}

interface CampoSelectProps extends BaseProps {
  value: string
  onChange: (valor: string) => void
  opciones: OpcionSelect[]
  placeholder?: string
}

export function CampoSelect({
  label,
  name,
  value,
  onChange,
  opciones,
  placeholder,
  error,
  hint,
  disabled,
  className = '',
}: CampoSelectProps) {
  const generatedId = useId()
  const id = name ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className={labelClase}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className={[
            cajaBase,
            'appearance-none pr-11 cursor-pointer',
            bordeEstado(error, disabled),
            value ? '' : 'text-[#1A1A1A]/40',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {opciones.map((op) => (
            <option key={op.valor} value={op.valor} className="text-[#1A1A1A]">
              {op.etiqueta}
            </option>
          ))}
        </select>
        {/* Flecha */}
        <svg
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/50"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <Mensajes error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  )
}
