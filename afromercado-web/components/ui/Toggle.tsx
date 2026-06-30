'use client'

interface ToggleProps {
  activo: boolean
  onChange: (v: boolean) => void
  etiqueta?: string
  descripcion?: string
  disabled?: boolean
}

/** Switch estándar de la plataforma — track rectangular, thumb cuadrado */
export function Switch({ activo, onChange, disabled = false }: { activo: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-md border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-1 ${
        activo ? 'bg-[#2D6A4F] border-[#2D6A4F]' : 'bg-gray-200 border-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-sm bg-white shadow-sm transition-transform duration-200 self-center ${
          activo ? 'translate-x-[19px]' : 'translate-x-[1px]'
        }`}
      />
    </button>
  )
}

/** Toggle con etiqueta y descripción — para usar en filas de configuración */
export default function Toggle({ activo, onChange, etiqueta, descripcion, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`group w-full flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
        activo ? 'border-[#2D6A4F]/40 bg-[#2D6A4F]/5' : 'border-gray-200 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#2D6A4F]/40'}`}
    >
      <span className="min-w-0">
        {etiqueta && <span className="block text-sm font-semibold text-[#1A1A1A]">{etiqueta}</span>}
        {descripcion && <span className="block text-xs text-gray-500 mt-0.5">{descripcion}</span>}
      </span>
      <Switch activo={activo} onChange={onChange} disabled={disabled} />
    </button>
  )
}
