import { Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

type TransportControlsProps = {
  disabled: boolean;
  isPlaying: boolean;
  currentTime: string;
  duration: string;
  onPlay: () => Promise<void>;
  onPause: () => void;
  onStop: () => void;
};

export function TransportControls({
  disabled,
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
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
    </section>
  );
}
