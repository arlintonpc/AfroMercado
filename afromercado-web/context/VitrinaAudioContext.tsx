'use client'

import { createContext, useContext, useState } from 'react'

interface VitrinaAudioCtx {
  muted: boolean
  toggleMuted: () => void
}

const Ctx = createContext<VitrinaAudioCtx>({ muted: true, toggleMuted: () => {} })

/**
 * Estado de audio compartido entre las tarjetas inmersivas (formato
 * Reels/TikTok) de la Vitrina de video: todos los videos del feed arrancan
 * silenciados y comparten un único mute/unmute, para que no suenen varios a
 * la vez. Se monta solo alrededor del feed de `/vitrina`, no globalmente.
 */
export function VitrinaAudioProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = useState(true)

  function toggleMuted() {
    setMuted((prev) => !prev)
  }

  return <Ctx.Provider value={{ muted, toggleMuted }}>{children}</Ctx.Provider>
}

export function useVitrinaAudio() {
  return useContext(Ctx)
}
