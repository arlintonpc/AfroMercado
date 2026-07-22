'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export function CulturaShell({ 
  children,
  modoTeatro = false
}: { 
  children: ReactNode
  modoTeatro?: boolean
}) {
  // En móvil el video ocupa toda la pantalla (estilo Reels/TikTok) y ahí sí
  // tiene sentido un fondo oscuro. En escritorio el video queda centrado en
  // una tarjeta, así que el resto de la página usa el mismo fondo crema de
  // marca que el resto del sitio — si no, toda la pantalla se ve negra y dejas
  // de sentir que estás en Teravia.
  const layoutClass = modoTeatro
    ? 'flex h-[100dvh] md:h-screen overflow-hidden flex-col bg-[#0f2419] md:bg-[radial-gradient(circle_at_top_left,_rgba(45,106,79,0.11),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(212,160,23,0.12),_transparent_24%),linear-gradient(180deg,_#F8F5F0_0%,_#F4EDE2_54%,_#F8F5F0_100%)] text-white md:text-[#1A1A1A]'
    : 'flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,_rgba(45,106,79,0.11),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(212,160,23,0.12),_transparent_24%),linear-gradient(180deg,_#F8F5F0_0%,_#F4EDE2_54%,_#F8F5F0_100%)] text-[#1A1A1A]'

  return (
    <div className={layoutClass}>
      {modoTeatro ? (
        <div className="hidden md:block bg-white dark:bg-[#1A1A1A]">
          <Header />
        </div>
      ) : (
        <Header />
      )}
      <main className="relative flex-1 overflow-hidden flex flex-col">
        {!modoTeatro && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),transparent)]" />
            <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#2D6A4F]/5 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-48 h-72 w-72 rounded-full bg-[#D4A017]/8 blur-3xl" />
          </>
        )}
        {children}
      </main>
      {!modoTeatro && <Footer />}
    </div>
  )
}

export function CulturaPageContainer({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

export function CulturaHero({
  eyebrow,
  title,
  description,
  actions,
  badge,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  badge?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-[#1A1A1A]/8 bg-white/85 p-6 shadow-[0_16px_50px_rgba(26,26,26,0.06)] backdrop-blur sm:p-8">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(45,106,79,0.07),transparent_45%,rgba(212,160,23,0.07))]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2D6A4F]">{eyebrow}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-[#1B4332] sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#1A1A1A]/68 sm:text-base">{description}</p>
        </div>
        {(actions || badge) && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            {badge}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

export function CulturaToolbar({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1A1A1A]/8 bg-white/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-end sm:justify-between">
      {children}
    </div>
  )
}

export function CulturaCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-[1.5rem] border border-[#1A1A1A]/8 bg-white/92 shadow-[0_12px_30px_rgba(26,26,26,0.05)] ${className}`}>
      {children}
    </section>
  )
}

export function CulturaStateCard({
  title,
  description,
  icon = '🎭',
  action,
  tone = 'neutral',
}: {
  title: string
  description: string
  icon?: string
  action?: ReactNode
  tone?: 'neutral' | 'error' | 'success'
}) {
  const toneClass =
    tone === 'error'
      ? 'border-[#C0392B]/18 bg-[#C0392B]/6 text-[#842029]'
      : tone === 'success'
        ? 'border-[#2D6A4F]/18 bg-[#EAF3DE]/65 text-[#1B4332]'
        : 'border-[#1A1A1A]/8 bg-white text-[#1A1A1A]'

  return (
    <div className={`rounded-[1.5rem] border p-8 text-center shadow-sm ${toneClass}`}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-3xl shadow-sm" aria-hidden="true">
        {icon}
      </div>
      <h2 className="mt-4 font-serif text-2xl text-inherit">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 opacity-80">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function CulturaSkeletonGrid({
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  items = 6,
}: {
  columns?: string
  items?: number
}) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[1.5rem] border border-[#1A1A1A]/8 bg-white">
          <div className="h-40 animate-pulse bg-gradient-to-br from-[#2D6A4F]/10 via-[#1A1A1A]/5 to-[#D4A017]/10" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#1A1A1A]/8" />
            <div className="h-5 w-4/5 animate-pulse rounded-full bg-[#1A1A1A]/8" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#1A1A1A]/8" />
            <div className="h-9 w-full animate-pulse rounded-full bg-[#1A1A1A]/8" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CulturaStat({
  label,
  value,
  accent = 'neutral',
}: {
  label: string
  value: string
  accent?: 'neutral' | 'green' | 'gold'
}) {
  const accentClass =
    accent === 'green'
      ? 'border-[#2D6A4F]/18 bg-[#EAF3DE]/60 text-[#1B4332]'
      : accent === 'gold'
        ? 'border-[#D4A017]/22 bg-[#FAEEDA]/70 text-[#6B4E0D]'
        : 'border-[#1A1A1A]/8 bg-white text-[#1A1A1A]'

  return (
    <div className={`min-w-0 rounded-2xl border p-4 shadow-sm ${accentClass}`}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] opacity-65">{label}</p>
      <p className="mt-2 truncate font-serif text-2xl leading-tight" title={value}>{value}</p>
    </div>
  )
}

export function CulturaQuickLink({
  href,
  label,
  description,
}: {
  href: string
  label: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#1A1A1A]/8 bg-white/85 p-4 transition hover:-translate-y-0.5 hover:border-[#2D6A4F]/30 hover:shadow-sm"
    >
      <p className="font-semibold text-[#1B4332] transition group-hover:text-[#2D6A4F]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#1A1A1A]/60">{description}</p>
    </Link>
  )
}
