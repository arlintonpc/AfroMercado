'use client'

interface ToggleProps {
  activo: boolean
  onChange: (v: boolean) => void
  etiqueta?: string
  descripcion?: string
  disabled?: boolean
}

export default function Toggle({ activo, onChange, etiqueta, descripcion, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`group w-full flex items-center justify-between gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200 ${
        activo
          ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
          : 'border-[#1A1A1A]/15 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#2D6A4F]/50'}`}
    >
      <span className="min-w-0">
        {etiqueta && (
          <span className="block text-base font-semibold text-[#1A1A1A]">{etiqueta}</span>
        )}
        {descripcion && (
          <span className="block text-sm text-[#1A1A1A]/60 mt-0.5">{descripcion}</span>
        )}
      </span>

      {/* Pill toggle */}
      <span
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border-2 transition-colors duration-200 ${
          activo ? 'bg-[#2D6A4F] border-[#2D6A4F]' : 'bg-[#E0E0E0] border-[#E0E0E0]'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
            activo ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  )
}
