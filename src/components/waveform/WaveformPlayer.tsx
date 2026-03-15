import { useEffect } from "react";
import type React from "react";

import { AudioLines, Loader2 } from "lucide-react";

import type {
  RegionContextMenuState,
  WaveformRegion,
} from "@/hooks/useWaveSurfer";

type WaveformPlayerProps = {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  hasAudio: boolean;
  isLoading: boolean;
  error: string | null;
  regions: WaveformRegion[];
  duration: number;
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  regionContextMenu: RegionContextMenuState | null;
  onCloseRegionContextMenu: () => void;
  onPreviewRegionFromContextMenu: () => void;
  onDeleteRegionFromContextMenu: () => void;
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

export function WaveformPlayer({
  containerRef,
  hasAudio,
  isLoading,
  error,
  regions,
  duration,
  selectedRegionId,
  hoveredRegionId,
  regionContextMenu,
  onCloseRegionContextMenu,
  onPreviewRegionFromContextMenu,
  onDeleteRegionFromContextMenu,
}: WaveformPlayerProps) {
  const highlightedRegionIds = new Set(
    [selectedRegionId, hoveredRegionId].filter((regionId): regionId is string =>
      Boolean(regionId),
    ),
  );

  const visibleRegions =
    duration > 0
      ? regions.filter((region) => highlightedRegionIds.has(region.id))
      : [];

  useEffect(() => {
    if (!regionContextMenu) {
      return;
    }

    const handlePointerDown = () => {
      onCloseRegionContextMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRegionContextMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [regionContextMenu, onCloseRegionContextMenu]);

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

        {visibleRegions.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-20 md:inset-x-4 md:top-3">
            {visibleRegions.map((region, index) => {
              const centerRatio = (region.start + region.end) / (2 * duration);
              const left = Math.max(8, Math.min(92, centerRatio * 100));

              return (
                <div
                  key={region.id}
                  className="absolute rounded-md border border-zinc-700/90 bg-zinc-950/95 px-2 py-1 text-[10px] leading-tight text-zinc-100 shadow-lg"
                  style={{
                    left: `${left}%`,
                    top: `${index * 36}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <p>Start: {formatTime(region.start)}</p>
                  <p>End: {formatTime(region.end)}</p>
                </div>
              );
            })}
          </div>
        ) : null}

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

        {regionContextMenu ? (
          <div
            className="fixed z-50 min-w-40 rounded-lg border border-zinc-700 bg-zinc-900/95 p-1 shadow-2xl"
            style={{
              left: `${Math.max(8, regionContextMenu.x)}px`,
              top: `${Math.max(8, regionContextMenu.y)}px`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-xs text-zinc-100 transition hover:bg-zinc-800"
              onClick={onPreviewRegionFromContextMenu}
            >
              Preview Region
            </button>
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-xs text-red-300 transition hover:bg-zinc-800"
              onClick={onDeleteRegionFromContextMenu}
            >
              Delete Region
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
