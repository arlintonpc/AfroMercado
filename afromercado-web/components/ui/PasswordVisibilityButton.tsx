'use client'

interface PasswordVisibilityButtonProps {
  visible: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
}

export function PasswordVisibilityButton({
  visible,
  onToggle,
  disabled = false,
  className = '',
}: PasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className={[
        'absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1',
        'text-[#1A1A1A]/45 transition-colors hover:text-[#2D6A4F]',
        'focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      ].filter(Boolean).join(' ')}
    >
      {visible ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a20.21 20.21 0 0 1 5.06-5.94" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.9 4.24A10.67 10.67 0 0 1 12 4c7 0 11 8 11 8a20.57 20.57 0 0 1-2.16 3.19" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )
}

export default PasswordVisibilityButton
