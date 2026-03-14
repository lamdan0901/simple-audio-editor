import { Loader2, Scissors, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WaveformRegion } from "@/hooks/useWaveSurfer";

type CutPanelProps = {
  selectedRegion: WaveformRegion | null;
  disabled: boolean;
  isProcessing: boolean;
  preciseMode: boolean;
  onPreciseModeChange: (enabled: boolean) => void;
  onCutAndSave: () => Promise<void>;
  onAddToMergeQueue: () => void;
  canAddToMergeQueue: boolean;
  addedCount: number;
};

function formatTime(valueInSeconds: number): string {
  if (!Number.isFinite(valueInSeconds) || valueInSeconds < 0) {
    return "00:00.000";
  }

  const minutes = Math.floor(valueInSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (valueInSeconds % 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

export function CutPanel({
  selectedRegion,
  disabled,
  isProcessing,
  preciseMode,
  onPreciseModeChange,
  onCutAndSave,
  onAddToMergeQueue,
  canAddToMergeQueue,
  addedCount,
}: CutPanelProps) {
  const duration = selectedRegion
    ? Math.max(0, selectedRegion.end - selectedRegion.start)
    : 0;

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-zinc-300">
        <Scissors className="size-4 text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
          Cut Selection
        </h2>
      </div>

      {selectedRegion ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-300">
          <p>
            Start: {formatTime(selectedRegion.start)} | End:{" "}
            {formatTime(selectedRegion.end)}
          </p>
          <p className="mt-1 text-zinc-400">Duration: {duration.toFixed(3)}s</p>
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-400">
          Select a region from the waveform or region list to enable cutting.
        </p>
      )}

      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-300">
          <span>Precise cut mode (re-encode)</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-500"
            checked={preciseMode}
            onChange={(event) => onPreciseModeChange(event.target.checked)}
            disabled={isProcessing}
          />
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Off: MP3/M4A use fast passthrough copy. On: force precise re-encode.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          disabled={disabled || isProcessing || !selectedRegion}
          onClick={onCutAndSave}
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Scissors className="size-4" />
          )}
          {isProcessing ? "Cutting..." : "Cut & Save"}
        </Button>

        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={!canAddToMergeQueue || isProcessing}
          onClick={onAddToMergeQueue}
        >
          <Sparkles className="size-4" />
          Add Last Cut To Merge Queue
        </Button>
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        Merge queue prepared clips: {addedCount}
      </p>
    </section>
  );
}
