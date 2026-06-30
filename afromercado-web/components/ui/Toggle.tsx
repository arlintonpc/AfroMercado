'use client'

interface SwitchProps {
  activo: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

interface ToggleProps extends SwitchProps {
  etiqueta?: string
  descripcion?: string
}

/** Switch estándar AfroMercado — pill verde, thumb circular blanco */
export function Switch({ activo, onChange, disabled = false, size = 'md' }: SwitchProps) {
  const track = size === 'sm'
    ? `h-5 w-9 ${activo ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`
    : `h-6 w-11 ${activo ? 'bg-[#2D6A4F]' : 'bg-gray-200'}`

  const thumb = size === 'sm'
    ? `h-4 w-4 ${activo ? 'translate-x-[18px]' : 'translate-x-0.5'}`
    : `h-5 w-5 ${activo ? 'translate-x-[22px]' : 'translate-x-0.5'}`

  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => !disabled && onChange(!activo)}
      className={`relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-1 ${track} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block rounded-full bg-white shadow-md transition-transform duration-200 self-center ${thumb}`}
      />
    </button>
  )
}

/** Fila de configuración con etiqueta + Switch */
export default function Toggle({ activo, onChange, etiqueta, descripcion, disabled = false, size = 'md' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => !disabled && onChange(!activo)}
      className={`group w-full flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
        activo ? 'border-[#2D6A4F]/30 bg-[#2D6A4F]/5' : 'border-gray-200 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#2D6A4F]/30'}`}
    >
      <span className="min-w-0">
        {etiqueta && <span className="block text-sm font-semibold text-[#1A1A1A]">{etiqueta}</span>}
        {descripcion && <span className="block text-xs text-gray-500 mt-0.5">{descripcion}</span>}
      </span>
      <Switch activo={activo} onChange={onChange} disabled={disabled} size={size} />
    </button>
  )
}
