import { ListMusic, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WaveformRegion } from "@/hooks/useWaveSurfer";

type RegionListProps = {
  regions: WaveformRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string) => void;
  onPlayRegion: (regionId: string) => void;
  onDeleteRegion: (regionId: string) => void;
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

export function RegionList({
  regions,
  selectedRegionId,
  onSelectRegion,
  onPlayRegion,
  onDeleteRegion,
}: RegionListProps) {
  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-300">
          <ListMusic className="size-4 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
            Regions
          </h2>
        </div>
        <p className="text-xs text-zinc-400">{regions.length} total</p>
      </div>

      {regions.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-4 text-sm text-zinc-400">
          Drag on the waveform to create one or more regions.
        </p>
      ) : (
        <div className="space-y-2">
          {regions.map((region, index) => {
            const duration = Math.max(0, region.end - region.start);
            const selected = region.id === selectedRegionId;

            return (
              <div
                key={region.id}
                className={`rounded-lg border px-3 py-2 transition ${
                  selected
                    ? "border-emerald-500/60 bg-emerald-900/20"
                    : "border-zinc-800 bg-zinc-950/70"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectRegion(region.id)}
                  className="w-full text-left"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                    Region {index + 1}
                  </p>
                  <p className="mt-1 text-sm text-zinc-200">
                    {formatTime(region.start)} - {formatTime(region.end)}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Duration: {duration.toFixed(3)}s
                  </p>
                </button>

                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onPlayRegion(region.id)}
                  >
                    <Play className="size-3.5" />
                    Preview
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onDeleteRegion(region.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
