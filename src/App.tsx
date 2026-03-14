import { useEffect, useMemo, useState } from 'react'

type FfmpegState = {
  loading: boolean
  available: boolean
  version: string
}

function App() {
  const [ffmpeg, setFfmpeg] = useState<FfmpegState>({
    loading: true,
    available: false,
    version: '',
  })

  const statusText = useMemo(() => {
    if (ffmpeg.loading) return 'Checking FFmpeg...'
    if (ffmpeg.available) return ffmpeg.version || 'FFmpeg detected'
    return 'FFmpeg not found in PATH'
  }, [ffmpeg])

  useEffect(() => {
    let active = true

    window.api
      .checkFfmpeg()
      .then((result) => {
        if (!active) return
        setFfmpeg({ loading: false, available: result.available, version: result.version })
      })
      .catch(() => {
        if (!active) return
        setFfmpeg({ loading: false, available: false, version: '' })
      })

    return () => {
      active = false
    }
  }, [])

  if (!ffmpeg.available) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <section className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">AudioSlice</p>
          <h1 className="mt-3 text-3xl font-semibold">FFmpeg is required</h1>
          <p className="mt-4 text-zinc-300">
            Install FFmpeg and make sure the <span className="font-semibold">ffmpeg</span> command is available in your system PATH.
          </p>
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
            {statusText}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <section className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">AudioSlice</p>
            <h1 className="text-2xl font-semibold">Phase 1 Skeleton Ready</h1>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            {statusText}
          </span>
        </header>
        <div className="flex-1 rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/60 p-6 text-zinc-400">
          Waveform, regions, and cut/merge panels will be added in Phase 2+.
        </div>
      </section>
    </main>
  )
}

export default App
