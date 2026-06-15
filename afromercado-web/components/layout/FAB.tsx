'use client'

interface FABProps {
  onClick: () => void
  label: string
  className?: string
}

export default function FAB({ onClick, label, className = '' }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-[#D4A017] text-[#1A1A1A] flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95 ${className}`}
    >
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )
}
