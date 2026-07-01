import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Porcentaje de sesiones que se graban para Replay (solo si hay errores)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  // Porcentaje de trazas de performance
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // No reportar errores de red (backend caído) — son esperados
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? ''
    if (msg.includes('No se pudo conectar con el servidor')) return null
    return event
  },
})
