import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";

import { CutPanel } from "@/components/cut/CutPanel";
import { TopBar } from "@/components/layout/TopBar";
import { MergePanel } from "@/components/merge/MergePanel";
import type { MergeQueueItem } from "@/components/merge/MergeItem";
import { RegionList } from "@/components/regions/RegionList";
import { TransportControls } from "@/components/waveform/TransportControls";
import { WaveformPlayer } from "@/components/waveform/WaveformPlayer";
import { useWaveSurfer } from "@/hooks/useWaveSurfer";

type FfmpegState = {
  loading: boolean;
  available: boolean;
  version: string;
};

const MIN_CUT_DURATION_SECONDS = 0.05;

function App() {
  const [ffmpeg, setFfmpeg] = useState<FfmpegState>({
    loading: true,
    available: false,
    version: "",
  });
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  const [isSelectingAudio, setIsSelectingAudio] = useState(false);
  const [isImportingMergeFiles, setIsImportingMergeFiles] = useState(false);
  const [selectAudioError, setSelectAudioError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preciseCutMode, setPreciseCutMode] = useState(false);
  const [lastCutPath, setLastCutPath] = useState<string | null>(null);
  const [mergeQueue, setMergeQueue] = useState<MergeQueueItem[]>([]);

  const audioUrl = useMemo(() => toFileUrl(audioFilePath), [audioFilePath]);

  const {
    containerRef,
    isReady,
    isLoading,
    isPlaying,
    duration,
    currentTime,
    error,
    regions,
    selectedRegionId,
    play,
    pause,
    stop,
    selectRegion,
    playRegion,
    removeRegion,
  } = useWaveSurfer(audioUrl);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  );

  const statusText = useMemo(() => {
    if (ffmpeg.loading) return "Checking FFmpeg...";
    if (ffmpeg.available) return ffmpeg.version || "FFmpeg detected";
    return "FFmpeg not found in PATH";
  }, [ffmpeg]);

  useEffect(() => {
    let active = true;

    window.api
      .checkFfmpeg()
      .then((result) => {
        if (!active) return;
        setFfmpeg({
          loading: false,
          available: result.available,
          version: result.version,
        });
      })
      .catch(() => {
        if (!active) return;
        setFfmpeg({ loading: false, available: false, version: "" });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setLastCutPath(null);
  }, [audioFilePath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveElement(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (!isReady) {
          return;
        }

        if (isPlaying) {
          pause();
          return;
        }

        void play().catch((err) => {
          toast.error("Unable to start playback", {
            description: getUserFacingError(err),
          });
        });
        return;
      }

      if (event.key === "Delete" && selectedRegionId) {
        event.preventDefault();
        removeRegion(selectedRegionId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isPlaying, isReady, pause, play, removeRegion, selectedRegionId]);

  const handleSelectAudio = async () => {
    setIsSelectingAudio(true);
    setSelectAudioError(null);

    try {
      const result = await window.api.openAudioFile();
      const firstPath = result.filePaths[0];
      if (!firstPath) {
        return;
      }

      setAudioFilePath(firstPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSelectAudioError(`Unable to open audio file picker: ${message}`);
      toast.error("Unable to open file picker", {
        description: message,
      });
    } finally {
      setIsSelectingAudio(false);
    }
  };

  const handleCutAndSave = async () => {
    if (!audioFilePath) {
      toast.error("No source file selected", {
        description: "Choose an audio file before cutting.",
      });
      return;
    }

    if (!selectedRegion) {
      toast.error("No region selected", {
        description: "Create or select a region before cutting.",
      });
      return;
    }

    const cutDuration = selectedRegion.end - selectedRegion.start;
    if (
      !Number.isFinite(cutDuration) ||
      cutDuration < MIN_CUT_DURATION_SECONDS
    ) {
      toast.error("Region is too short", {
        description: `Minimum duration is ${MIN_CUT_DURATION_SECONDS.toFixed(2)}s.`,
      });
      return;
    }

    const sourceExtension = getLowercaseExt(audioFilePath);
    const baseName = getBaseName(audioFilePath);
    const defaultExtension =
      (sourceExtension === ".mp3" || sourceExtension === ".m4a") &&
      !preciseCutMode
        ? sourceExtension
        : ".wav";
    const defaultName = `${baseName}_${selectedRegion.start.toFixed(3)}-${selectedRegion.end.toFixed(3)}${defaultExtension}`;

    setIsProcessing(true);

    try {
      const saveResult = await window.api.saveAudioFile({
        defaultName,
        inputExtension: sourceExtension,
        mode: preciseCutMode ? "precise" : "copy",
      });
      if (!saveResult.filePath) {
        toast.message("Cut canceled");
        return;
      }

      const cutResult = await window.api.cutAudio({
        inputPath: audioFilePath,
        startTime: selectedRegion.start,
        endTime: selectedRegion.end,
        outputPath: saveResult.filePath,
        mode: preciseCutMode ? "precise" : "copy",
      });

      if (!cutResult.success) {
        throw new Error("Audio cutting failed.");
      }

      const outputPath = cutResult.outputPath ?? saveResult.filePath;
      setLastCutPath(outputPath);
      toast.success("Cut completed", {
        description: getFileName(outputPath),
      });
    } catch (err) {
      toast.error("Failed to cut audio", {
        description: getUserFacingError(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddLastCutToMergeQueue = () => {
    if (!lastCutPath) {
      return;
    }

    addToMergeQueue(lastCutPath, "cut");
  };

  const handleImportMergeFiles = async () => {
    setIsImportingMergeFiles(true);

    try {
      const result = await window.api.openAudioFile();
      const importedPaths = dedupeFilePaths(result.filePaths);

      if (importedPaths.length === 0) {
        return;
      }

      let addedCount = 0;
      for (const filePath of importedPaths) {
        const wasAdded = addToMergeQueue(filePath, "import", false);
        if (wasAdded) {
          addedCount += 1;
        }
      }

      if (addedCount > 0) {
        toast.success("Files added to merge queue", {
          description: `${addedCount} file${addedCount > 1 ? "s" : ""} added`,
        });
      } else {
        toast.message("All selected files are already in queue");
      }
    } catch (err) {
      toast.error("Unable to import merge files", {
        description: getUserFacingError(err),
      });
    } finally {
      setIsImportingMergeFiles(false);
    }
  };

  const handleRemoveMergeItem = (itemId: string) => {
    let removedName = "";

    setMergeQueue((current) => {
      const target = current.find((item) => item.id === itemId);
      if (!target) {
        return current;
      }

      removedName = getFileName(target.filePath);
      return current.filter((item) => item.id !== itemId);
    });

    if (removedName) {
      toast.message("Removed from merge queue", {
        description: removedName,
      });
    }
  };

  const handleReorderMergeItems = (sourceId: string, targetId: string) => {
    setMergeQueue((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleMergeAll = async () => {
    if (mergeQueue.length < 2) {
      toast.error("Need at least two files to merge");
      return;
    }

    const uniqueMergePaths = new Set(
      mergeQueue.map((item) => normalizeForCompare(item.filePath)),
    );
    if (uniqueMergePaths.size !== mergeQueue.length) {
      toast.error("Merge queue contains duplicate files", {
        description: "Remove duplicates before merging.",
      });
      return;
    }

    const mergePaths = mergeQueue.map((item) => item.filePath);
    const outputExtension = suggestMergeOutputExtension(mergePaths);
    const defaultName = `merged${outputExtension}`;

    setIsProcessing(true);

    try {
      const saveResult = await window.api.saveMergeFile(defaultName);
      if (!saveResult.filePath) {
        toast.message("Merge canceled");
        return;
      }

      const mergeResult = await window.api.mergeAudio({
        filePaths: mergePaths,
        outputPath: saveResult.filePath,
      });

      if (!mergeResult.success) {
        throw new Error("Audio merge failed.");
      }

      const outputPath = mergeResult.outputPath ?? saveResult.filePath;
      toast.success("Merge completed", {
        description: getFileName(outputPath),
      });
    } catch (err) {
      toast.error("Failed to merge audio", {
        description: getUserFacingError(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const addToMergeQueue = (
    filePath: string,
    source: "cut" | "import",
    announce: boolean = true,
  ): boolean => {
    let added = false;
    const normalizedTargetPath = normalizeForCompare(filePath);

    setMergeQueue((current) => {
      if (
        current.some(
          (item) => normalizeForCompare(item.filePath) === normalizedTargetPath,
        )
      ) {
        return current;
      }

      added = true;
      return [...current, { id: crypto.randomUUID(), filePath, source }];
    });

    if (announce) {
      if (added) {
        toast.success("Clip added to merge queue", {
          description: getFileName(filePath),
        });
      } else {
        toast.message("Clip already in merge queue");
      }
    }

    return added;
  };

  if (ffmpeg.loading) {
    return (
      <>
        <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
          <section className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              AudioSlice
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Checking FFmpeg</h1>
            <p className="mt-4 text-zinc-300">
              Verifying that FFmpeg is available on your system PATH.
            </p>
            <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
              {statusText}
            </p>
          </section>
        </main>
        <Toaster theme="dark" richColors position="top-right" />
      </>
    );
  }

  if (!ffmpeg.available) {
    return (
      <>
        <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
          <section className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              AudioSlice
            </p>
            <h1 className="mt-3 text-3xl font-semibold">FFmpeg is required</h1>
            <p className="mt-4 text-zinc-300">
              Install FFmpeg and make sure the{" "}
              <span className="font-semibold">ffmpeg</span> command is available
              in your system PATH.
            </p>
            <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
              {statusText}
            </p>
          </section>
        </main>
        <Toaster theme="dark" richColors position="top-right" />
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_40%),linear-gradient(180deg,#050807_0%,#080d0b_35%,#070708_100%)] px-4 py-5 text-zinc-100 md:px-8 md:py-8">
        <section className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5">
          <TopBar
            statusText={statusText}
            audioFilePath={audioFilePath}
            selectError={selectAudioError}
            isSelecting={isSelectingAudio}
            onSelectAudio={handleSelectAudio}
          />

          <WaveformPlayer
            containerRef={containerRef}
            hasAudio={Boolean(audioFilePath)}
            isLoading={isLoading}
            error={error}
          />

          <TransportControls
            disabled={!isReady}
            isPlaying={isPlaying}
            currentTime={formatTime(currentTime)}
            duration={formatTime(duration)}
            onPlay={play}
            onPause={pause}
            onStop={stop}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <RegionList
              regions={regions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={selectRegion}
              onPlayRegion={playRegion}
              onDeleteRegion={removeRegion}
            />

            <CutPanel
              selectedRegion={selectedRegion}
              disabled={!isReady || !audioFilePath}
              isProcessing={isProcessing}
              preciseMode={preciseCutMode}
              onPreciseModeChange={setPreciseCutMode}
              onCutAndSave={handleCutAndSave}
              onAddToMergeQueue={handleAddLastCutToMergeQueue}
              canAddToMergeQueue={Boolean(lastCutPath)}
              addedCount={mergeQueue.length}
            />

            <MergePanel
              items={mergeQueue}
              isProcessing={isProcessing || isImportingMergeFiles}
              onImportFiles={handleImportMergeFiles}
              onMergeAll={handleMergeAll}
              onRemoveItem={handleRemoveMergeItem}
              onReorderItems={handleReorderMergeItems}
            />
          </section>
        </section>
      </main>
      <Toaster theme="dark" richColors position="top-right" />
    </>
  );
}

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

function toFileUrl(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }

  if (normalized.startsWith("//")) {
    return encodeURI(`file:${normalized}`);
  }

  return encodeURI(`file://${normalized}`);
}

function getLowercaseExt(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }

  return filePath.slice(dotIndex).toLowerCase();
}

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() ?? "clip";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? filePath;
}

function dedupeFilePaths(filePaths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const filePath of filePaths) {
    const normalized = normalizeForCompare(filePath);

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(filePath);
  }

  return result;
}

function normalizeForCompare(filePath: string): string {
  return filePath.replace(/[\\/]+/g, "/").toLowerCase();
}

function suggestMergeOutputExtension(
  filePaths: string[],
): ".mp3" | ".m4a" | ".wav" {
  if (filePaths.length === 0) {
    return ".wav";
  }

  const normalized = filePaths.map((filePath) => getLowercaseExt(filePath));
  const first = normalized[0];

  if (
    (first === ".mp3" || first === ".m4a") &&
    normalized.every((ext) => ext === first)
  ) {
    return first;
  }

  return ".wav";
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("[contenteditable='true']"));
}

function getUserFacingError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown error";
  const normalized = raw.trim();

  if (!normalized) {
    return "Unexpected error while processing audio.";
  }

  if (/ffmpeg|ffprobe/i.test(normalized)) {
    return "Audio processing failed. Check FFmpeg availability and selected format options.";
  }

  if (/no such file|cannot find|enoent/i.test(normalized)) {
    return "A selected file or folder path no longer exists.";
  }

  if (/permission|access is denied|eacces|eperm/i.test(normalized)) {
    return "Access denied for one of the selected paths.";
  }

  return normalized;
}

export default App;
