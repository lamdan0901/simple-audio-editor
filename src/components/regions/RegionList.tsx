import { AudioWaveform, ListMusic, Play, Trash2, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WaveformRegion } from "@/hooks/useWaveSurfer";

type RegionListProps = {
  regions: WaveformRegion[];
  selectedRegionId: string | null;
  selectedRegionIds: string[];
  fadeInRegionIds: string[];
  fadeOutRegionIds: string[];
  fadeDurationsByRegionId: Record<
    string,
    {
      fadeInDuration: number;
      fadeOutDuration: number;
    }
  >;
  onSelectRegion: (regionId: string) => void;
  onToggleRegionSelection: (regionId: string) => void;
  onToggleRegionFadeIn: (regionId: string) => void;
  onToggleRegionFadeOut: (regionId: string) => void;
  onSetRegionFadeInDuration: (regionId: string, value: number) => void;
  onSetRegionFadeOutDuration: (regionId: string, value: number) => void;
  onSelectAllRegions: () => void;
  onClearRegionSelection: () => void;
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
  selectedRegionIds,
  fadeInRegionIds,
  fadeOutRegionIds,
  fadeDurationsByRegionId,
  onSelectRegion,
  onToggleRegionSelection,
  onToggleRegionFadeIn,
  onToggleRegionFadeOut,
  onSetRegionFadeInDuration,
  onSetRegionFadeOutDuration,
  onSelectAllRegions,
  onClearRegionSelection,
  onPlayRegion,
  onDeleteRegion,
}: RegionListProps) {
  const selectedSet = new Set(selectedRegionIds);
  const fadeInSet = new Set(fadeInRegionIds);
  const fadeOutSet = new Set(fadeOutRegionIds);

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

      <div className="mb-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onSelectAllRegions}
          disabled={regions.length === 0}
        >
          Select All
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClearRegionSelection}
          disabled={selectedRegionIds.length === 0}
        >
          Clear
        </Button>
        <p className="text-xs text-zinc-400">
          {selectedRegionIds.length} selected for cut
        </p>
      </div>

      {regions.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-4 text-sm text-zinc-400">
          Drag on the waveform to create one or more regions.
        </p>
      ) : (
        <div className="space-y-2">
          {regions.map((region, index) => {
            const duration = Math.max(0, region.end - region.start);
            const active = region.id === selectedRegionId;
            const selectedForCut = selectedSet.has(region.id);
            const fadeInEnabled = fadeInSet.has(region.id);
            const fadeOutEnabled = fadeOutSet.has(region.id);
            const fadeDurations = fadeDurationsByRegionId[region.id] ?? {
              fadeInDuration: 2,
              fadeOutDuration: 2,
            };

            return (
              <div
                key={region.id}
                className={`rounded-lg border px-3 py-2 transition ${
                  active
                    ? "border-emerald-500/60 bg-emerald-900/20"
                    : "border-zinc-800 bg-zinc-950/70"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-500"
                      checked={selectedForCut}
                      onChange={() => onToggleRegionSelection(region.id)}
                    />
                    Select for cut
                  </label>
                  {active ? (
                    <span className="text-xs uppercase tracking-[0.12em] text-emerald-300">
                      Active
                    </span>
                  ) : null}
                </div>

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
                    size="icon-sm"
                    variant={fadeInEnabled ? "secondary" : "outline"}
                    className={
                      fadeInEnabled
                        ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                        : ""
                    }
                    aria-label={`Toggle fade in for region ${index + 1}`}
                    aria-pressed={fadeInEnabled}
                    title="Toggle fade in"
                    onClick={() => onToggleRegionFadeIn(region.id)}
                  >
                    <Waves className="size-3.5" />
                  </Button>

                  <Button
                    type="button"
                    size="icon-sm"
                    variant={fadeOutEnabled ? "secondary" : "outline"}
                    className={
                      fadeOutEnabled
                        ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                        : ""
                    }
                    aria-label={`Toggle fade out for region ${index + 1}`}
                    aria-pressed={fadeOutEnabled}
                    title="Toggle fade out"
                    onClick={() => onToggleRegionFadeOut(region.id)}
                  >
                    <AudioWaveform className="size-3.5" />
                  </Button>

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

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-zinc-400">
                    Fade in (s)
                    <input
                      type="number"
                      min={0.1}
                      max={30}
                      step={0.1}
                      value={fadeDurations.fadeInDuration}
                      disabled={!fadeInEnabled}
                      onChange={(event) => {
                        const parsed = Number.parseFloat(event.target.value);
                        if (Number.isFinite(parsed)) {
                          onSetRegionFadeInDuration(region.id, parsed);
                        }
                      }}
                      className="mt-1 h-7 w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2 text-xs text-zinc-200 outline-none transition focus:border-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="text-[11px] text-zinc-400">
                    Fade out (s)
                    <input
                      type="number"
                      min={0.1}
                      max={30}
                      step={0.1}
                      value={fadeDurations.fadeOutDuration}
                      disabled={!fadeOutEnabled}
                      onChange={(event) => {
                        const parsed = Number.parseFloat(event.target.value);
                        if (Number.isFinite(parsed)) {
                          onSetRegionFadeOutDuration(region.id, parsed);
                        }
                      }}
                      className="mt-1 h-7 w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2 text-xs text-zinc-200 outline-none transition focus:border-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                </div>

                <p className="mt-2 text-[11px] text-zinc-400">
                  Fade in:{" "}
                  <span
                    className={
                      fadeInEnabled ? "text-emerald-300" : "text-zinc-500"
                    }
                  >
                    {fadeInEnabled ? "On" : "Off"}
                  </span>{" "}
                  | Fade out:{" "}
                  <span
                    className={
                      fadeOutEnabled ? "text-emerald-300" : "text-zinc-500"
                    }
                  >
                    {fadeOutEnabled ? "On" : "Off"}
                  </span>
                </p>

                {fadeInEnabled || fadeOutEnabled ? (
                  <p className="mt-1 text-[11px] text-emerald-300/90">
                    Applied on export with your custom duration (default 2.0s,
                    auto-clamped for short clips).
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
