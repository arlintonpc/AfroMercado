import { apiFetch } from '@/lib/api/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output.buffer as ArrayBuffer
}

export async function suscribirPush(token: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    const { clavePublica, activo } = await apiFetch<{ clavePublica: string; activo: boolean }>(
      '/push/clave-publica',
      { auth: false },
    )
    if (!activo) return false

    const registro = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') return false

    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(clavePublica),
    })

    const { endpoint, keys } = suscripcion.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    await fetch(`${API_URL}/push/suscribir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    })

    return true
  } catch {
    return false
  }
}

export async function desuscribirPush(token: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const registro = await navigator.serviceWorker.ready
    const suscripcion = await registro.pushManager.getSubscription()
    if (!suscripcion) return
    const { endpoint } = suscripcion
    await suscripcion.unsubscribe()
    await fetch(`${API_URL}/push/suscribir`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint }),
    })
  } catch {
    // silencioso
  }
}
