import { Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

type TransportControlsProps = {
  disabled: boolean;
  isPlaying: boolean;
  currentTime: string;
  duration: string;
  volume: number;
  onPlay: () => Promise<void>;
  onPause: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
};

export function TransportControls({
  disabled,
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlay,
  onPause,
  onStop,
  onVolumeChange,
}: TransportControlsProps) {
  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">
          Transport
        </h2>
        <p className="text-xs text-zinc-400">
          {currentTime} / {duration}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="lg"
            disabled={disabled || isPlaying}
            onClick={onPlay}
          >
            <Play className="size-4" />
            Play
          </Button>

          <Button
            variant="outline"
            size="lg"
            disabled={disabled || !isPlaying}
            onClick={onPause}
          >
            <Pause className="size-4" />
            Pause
          </Button>

          <Button
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={onStop}
          >
            <Square className="size-4" />
            Stop
          </Button>
        </div>

        <div className="ml-auto flex w-full items-center gap-2 sm:w-72">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Vol
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            disabled={disabled}
            onChange={(event) => {
              const nextPercent = Number.parseInt(event.target.value, 10);
              if (!Number.isFinite(nextPercent)) {
                return;
              }

              onVolumeChange(nextPercent / 100);
            }}
            className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Playback volume"
          />
          <span className="w-10 text-right text-xs text-zinc-300">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </section>
  );
}
