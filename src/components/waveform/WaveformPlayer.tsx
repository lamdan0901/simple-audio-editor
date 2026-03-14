import type React from "react";

import { AudioLines, Loader2 } from "lucide-react";

type WaveformPlayerProps = {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  hasAudio: boolean;
  isLoading: boolean;
  error: string | null;
};

export function WaveformPlayer({
  containerRef,
  hasAudio,
  isLoading,
  error,
}: WaveformPlayerProps) {
  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-zinc-300">
        <AudioLines className="size-4 text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
          Waveform
        </h2>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 px-2 py-4 md:px-4 md:py-6">
        <div ref={containerRef} className="min-h-55" />

        {!hasAudio ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-zinc-500">
            <p>Select a local audio file to render the waveform.</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950/70">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Loader2 className="size-4 animate-spin" />
              <p>Loading waveform...</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200 md:inset-x-4 md:bottom-4">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
