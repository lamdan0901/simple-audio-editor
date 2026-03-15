import { useEffect, useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Toaster, toast } from "sonner";

import { CutPanel } from "@/components/cut/CutPanel";
import { TopBar } from "@/components/layout/TopBar";
import { MergePanel } from "@/components/merge/MergePanel";
import type { MergeQueueItem } from "@/components/merge/MergeItem";
import { RegionList } from "@/components/regions/RegionList";
import { Button } from "@/components/ui/button";
import { TransportControls } from "@/components/waveform/TransportControls";
import { WaveformPlayer } from "@/components/waveform/WaveformPlayer";
import { useWaveSurfer } from "@/hooks/useWaveSurfer";

type FfmpegState = {
  loading: boolean;
  available: boolean;
  version: string;
};

type WorkspaceTab = "cutter" | "merger";

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
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [lastCutPaths, setLastCutPaths] = useState<string[]>([]);
  const [mergeQueue, setMergeQueue] = useState<MergeQueueItem[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("cutter");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [defaultOutputFolder, setDefaultOutputFolder] = useState<string | null>(
    null,
  );
  const [isUpdatingOutputFolder, setIsUpdatingOutputFolder] = useState(false);

  const {
    containerRef,
    isReady,
    isLoading,
    isPlaying,
    volume,
    duration,
    currentTime,
    error,
    regions,
    selectedRegionId,
    hoveredRegionId,
    regionContextMenu,
    play,
    pause,
    stop,
    setVolume,
    selectRegion,
    playRegion,
    removeRegion,
    closeRegionContextMenu,
    previewRegionFromContextMenu,
    deleteRegionFromContextMenu,
  } = useWaveSurfer(
    audioBlob,
    ffmpeg.loading ? "ffmpeg-loading" : "ffmpeg-ready",
  );

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  );

  const selectedRegions = useMemo(() => {
    if (selectedRegionIds.length === 0) {
      return [];
    }

    const selectedIds = new Set(selectedRegionIds);
    return regions.filter((region) => selectedIds.has(region.id));
  }, [regions, selectedRegionIds]);

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
    let active = true;

    window.api
      .getDefaultOutputFolder()
      .then((result) => {
        if (!active) {
          return;
        }

        setDefaultOutputFolder(result.folderPath ?? null);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setDefaultOutputFolder(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setLastCutPaths([]);
    setSelectedRegionIds([]);
  }, [audioFilePath]);

  useEffect(() => {
    setSelectedRegionIds((current) => {
      const validRegionIds = new Set(regions.map((region) => region.id));
      const next = current.filter((regionId) => validRegionIds.has(regionId));

      if (selectedRegionId && validRegionIds.has(selectedRegionId)) {
        if (!next.includes(selectedRegionId)) {
          next.push(selectedRegionId);
        }
      }

      if (
        next.length === current.length &&
        next.every((value, index) => value === current[index])
      ) {
        return current;
      }

      return next;
    });
  }, [regions, selectedRegionId]);

  useEffect(() => {
    let canceled = false;

    if (!audioFilePath) {
      setAudioBlob(null);
      return;
    }

    const loadSelectedAudio = async () => {
      try {
        const readResult = await window.api.readAudioFile(audioFilePath);
        if (
          !readResult?.arrayBuffer ||
          readResult.arrayBuffer.byteLength === 0
        ) {
          throw new Error("Selected file appears to be empty.");
        }

        const blob = new Blob([readResult.arrayBuffer], {
          type: guessAudioMimeType(audioFilePath),
        });

        if (canceled) {
          return;
        }

        setAudioBlob(blob);
      } catch (err) {
        if (canceled) {
          return;
        }

        setAudioBlob(null);
        toast.error("Unable to read selected audio", {
          description: getUserFacingError(err),
        });
      }
    };

    void loadSelectedAudio();

    return () => {
      canceled = true;
    };
  }, [audioFilePath]);

  useEffect(() => {
    if (!audioFilePath || !error) {
      return;
    }

    toast.error("Unable to load selected audio", {
      description: error,
    });
  }, [audioFilePath, error]);

  useEffect(() => {
    if (!audioFilePath || !isLoading || isReady || error) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      toast.error("Waveform is still loading", {
        description:
          "Try another file format (WAV/MP3), then share the exact file type if this keeps happening.",
      });
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [audioFilePath, error, isLoading, isReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveElement(event.target)) {
        return;
      }

      if (activeTab === "cutter" && event.code === "Space") {
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

      if (
        activeTab === "cutter" &&
        event.key === "Delete" &&
        selectedRegionId
      ) {
        event.preventDefault();
        removeRegion(selectedRegionId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeTab,
    isPlaying,
    isReady,
    pause,
    play,
    removeRegion,
    selectedRegionId,
  ]);

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
      setActiveTab("cutter");
      toast.success("Audio loaded", {
        description:
          "Switched to Audio Cutter. Click the waveform to create a cut region.",
      });
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

  const handleSetDefaultOutputFolder = async () => {
    setIsUpdatingOutputFolder(true);

    try {
      const pickResult = await window.api.selectOutputFolder();
      if (!pickResult.folderPath) {
        return;
      }

      const setResult = await window.api.setDefaultOutputFolder(
        pickResult.folderPath,
      );
      setDefaultOutputFolder(setResult.folderPath);
      toast.success("Default output folder updated", {
        description: setResult.folderPath,
      });
    } catch (err) {
      toast.error("Unable to set default output folder", {
        description: getUserFacingError(err),
      });
    } finally {
      setIsUpdatingOutputFolder(false);
    }
  };

  const handleClearDefaultOutputFolder = async () => {
    setIsUpdatingOutputFolder(true);

    try {
      await window.api.clearDefaultOutputFolder();
      setDefaultOutputFolder(null);
      toast.message("Default output folder cleared");
    } catch (err) {
      toast.error("Unable to clear default output folder", {
        description: getUserFacingError(err),
      });
    } finally {
      setIsUpdatingOutputFolder(false);
    }
  };

  const handleCutAndSave = async (forceDialog: boolean = false) => {
    if (!audioFilePath) {
      toast.error("No source file selected", {
        description: "Choose an audio file before cutting.",
      });
      return;
    }

    if (selectedRegions.length === 0) {
      toast.error("No region selected", {
        description: "Create or select at least one region before cutting.",
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
    const invalidRegion = selectedRegions.find((region) => {
      const cutDuration = region.end - region.start;
      return (
        !Number.isFinite(cutDuration) || cutDuration < MIN_CUT_DURATION_SECONDS
      );
    });
    if (invalidRegion) {
      toast.error("Region is too short", {
        description: `Minimum duration is ${MIN_CUT_DURATION_SECONDS.toFixed(2)}s.`,
      });
      return;
    }

    const defaultName = `${baseName}_${selectedRegions[0].start.toFixed(3)}-${selectedRegions[0].end.toFixed(3)}${defaultExtension}`;

    setIsProcessing(true);

    try {
      if (selectedRegions.length === 1) {
        const selectedRegion = selectedRegions[0];
        const saveResult = await window.api.saveAudioFile({
          defaultName,
          inputExtension: sourceExtension,
          mode: preciseCutMode ? "precise" : "copy",
          forceDialog,
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
        setLastCutPaths([outputPath]);
        toast.success("Cut completed", {
          description: getFileName(outputPath),
        });
        return;
      }

      let outputFolder = defaultOutputFolder;

      if (forceDialog || !outputFolder) {
        const pickResult = await window.api.selectOutputFolder();
        if (!pickResult.folderPath) {
          toast.message("Cut canceled");
          return;
        }

        outputFolder = pickResult.folderPath;
        setDefaultOutputFolder(outputFolder);
        await window.api
          .setDefaultOutputFolder(outputFolder)
          .catch(() => undefined);
      }

      const createdPaths: string[] = [];

      for (let index = 0; index < selectedRegions.length; index += 1) {
        const region = selectedRegions[index];
        const outputName = `${baseName}_${String(index + 1).padStart(3, "0")}_${region.start.toFixed(3)}-${region.end.toFixed(3)}${defaultExtension}`;
        const outputPath = joinPath(outputFolder, outputName);

        const cutResult = await window.api.cutAudio({
          inputPath: audioFilePath,
          startTime: region.start,
          endTime: region.end,
          outputPath,
          mode: preciseCutMode ? "precise" : "copy",
        });

        if (!cutResult.success) {
          throw new Error(`Audio cutting failed for region ${index + 1}.`);
        }

        createdPaths.push(cutResult.outputPath ?? outputPath);
      }

      setLastCutPaths(createdPaths);
      toast.success("Batch cut completed", {
        description: `${createdPaths.length} clips saved`,
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
    if (lastCutPaths.length === 0) {
      return;
    }

    let addedCount = 0;
    for (const cutPath of lastCutPaths) {
      const wasAdded = addToMergeQueue(cutPath, "cut", false);
      if (wasAdded) {
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      toast.success("Clips added to merge queue", {
        description: `${addedCount} clip${addedCount > 1 ? "s" : ""} added`,
      });
    } else {
      toast.message("All cut clips are already in merge queue");
    }
  };

  const handleToggleRegionSelection = (regionId: string) => {
    setSelectedRegionIds((current) => {
      if (current.includes(regionId)) {
        return current.filter((id) => id !== regionId);
      }

      return [...current, regionId];
    });
  };

  const handleSelectAllRegions = () => {
    setSelectedRegionIds(regions.map((region) => region.id));
  };

  const handleClearRegionSelection = () => {
    setSelectedRegionIds([]);
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
      const saveResult = await window.api.saveMergeFile({
        defaultName,
        forceDialog: false,
      });
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

  const handleMergeAllAs = async () => {
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
      const saveResult = await window.api.saveMergeFile({
        defaultName,
        forceDialog: true,
      });
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
              AudioEditor
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
              AudioEditor
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
            defaultOutputFolder={defaultOutputFolder}
            isUpdatingOutputFolder={isUpdatingOutputFolder}
            onPickOutputFolder={handleSetDefaultOutputFolder}
            onClearOutputFolder={handleClearDefaultOutputFolder}
          />

          <nav
            className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-2"
            aria-label="Workspace tabs"
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("cutter")}
                aria-pressed={activeTab === "cutter"}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  activeTab === "cutter"
                    ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-200 hover:border-zinc-700 hover:text-zinc-100"
                }`}
              >
                Audio Cutter
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("merger")}
                aria-pressed={activeTab === "merger"}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  activeTab === "merger"
                    ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-200 hover:border-zinc-700 hover:text-zinc-100"
                }`}
              >
                Audio Merger
              </button>
            </div>
          </nav>

          <section
            className={
              activeTab === "cutter"
                ? "flex flex-col gap-4"
                : "hidden flex-col gap-4"
            }
            aria-label="Audio cutter workspace"
          >
            {!audioFilePath ? (
              <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-6 md:p-10">
                <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-dashed border-emerald-500/40 bg-zinc-950/60 p-8 text-center md:p-12">
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-300">
                    <Upload className="size-8" />
                  </div>
                  <h2 className="text-2xl font-semibold text-zinc-100">
                    Upload Audio To Start Cutting
                  </h2>
                  <p className="max-w-xl text-sm text-zinc-400 md:text-base">
                    Select a local audio file to display the waveform, create
                    regions, and export clips.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    disabled={isSelectingAudio}
                    onClick={handleSelectAudio}
                  >
                    {isSelectingAudio ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {isSelectingAudio ? "Opening..." : "Select Audio File"}
                  </Button>
                  {selectAudioError ? (
                    <p className="text-sm text-red-300">{selectAudioError}</p>
                  ) : null}
                </div>
              </section>
            ) : (
              <>
                <WaveformPlayer
                  containerRef={containerRef}
                  hasAudio={Boolean(audioFilePath)}
                  isLoading={isLoading}
                  error={error}
                  regions={regions}
                  duration={duration}
                  selectedRegionId={selectedRegionId}
                  hoveredRegionId={hoveredRegionId}
                  regionContextMenu={regionContextMenu}
                  onCloseRegionContextMenu={closeRegionContextMenu}
                  onPreviewRegionFromContextMenu={previewRegionFromContextMenu}
                  onDeleteRegionFromContextMenu={deleteRegionFromContextMenu}
                />

                <TransportControls
                  disabled={!isReady}
                  isPlaying={isPlaying}
                  currentTime={formatTime(currentTime)}
                  duration={formatTime(duration)}
                  volume={volume}
                  onPlay={play}
                  onPause={pause}
                  onStop={stop}
                  onVolumeChange={setVolume}
                />

                <section className="grid gap-4 lg:grid-cols-2">
                  <RegionList
                    regions={regions}
                    selectedRegionId={selectedRegionId}
                    selectedRegionIds={selectedRegionIds}
                    onSelectRegion={selectRegion}
                    onToggleRegionSelection={handleToggleRegionSelection}
                    onSelectAllRegions={handleSelectAllRegions}
                    onClearRegionSelection={handleClearRegionSelection}
                    onPlayRegion={playRegion}
                    onDeleteRegion={removeRegion}
                  />

                  <CutPanel
                    audioFilePath={audioFilePath}
                    isSelectingAudio={isSelectingAudio}
                    selectAudioError={selectAudioError}
                    onSelectAudio={handleSelectAudio}
                    selectedRegion={selectedRegion}
                    selectedCount={selectedRegions.length}
                    disabled={!isReady || !audioFilePath}
                    isProcessing={isProcessing}
                    preciseMode={preciseCutMode}
                    onPreciseModeChange={setPreciseCutMode}
                    onCutAndSave={() => handleCutAndSave(false)}
                    onCutAndSaveAs={() => handleCutAndSave(true)}
                    onAddToMergeQueue={handleAddLastCutToMergeQueue}
                    canAddToMergeQueue={lastCutPaths.length > 0}
                    addedCount={mergeQueue.length}
                  />
                </section>
              </>
            )}
          </section>

          <section
            className={
              activeTab === "merger"
                ? "flex flex-col gap-4"
                : "hidden flex-col gap-4"
            }
            aria-label="Audio merger workspace"
          >
            {mergeQueue.length === 0 ? (
              <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-6 md:p-10">
                <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-dashed border-emerald-500/40 bg-zinc-950/60 p-8 text-center md:p-12">
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-300">
                    <Upload className="size-8" />
                  </div>
                  <h2 className="text-2xl font-semibold text-zinc-100">
                    Upload Files To Start Merging
                  </h2>
                  <p className="max-w-xl text-sm text-zinc-400 md:text-base">
                    Import at least 2 audio files to enable merge output.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    disabled={isImportingMergeFiles || isProcessing}
                    onClick={handleImportMergeFiles}
                  >
                    {isImportingMergeFiles ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {isImportingMergeFiles
                      ? "Importing..."
                      : "Import Audio Files"}
                  </Button>
                </div>
              </section>
            ) : (
              <>
                {mergeQueue.length < 2 ? (
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Upload at least one more file to merge. Minimum required: 2
                    files.
                  </p>
                ) : null}

                <MergePanel
                  items={mergeQueue}
                  isProcessing={isProcessing || isImportingMergeFiles}
                  onImportFiles={handleImportMergeFiles}
                  onMergeAll={handleMergeAll}
                  onMergeAllAs={handleMergeAllAs}
                  onRemoveItem={handleRemoveMergeItem}
                  onReorderItems={handleReorderMergeItems}
                />
              </>
            )}
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

function guessAudioMimeType(filePath: string): string {
  const extension = getLowercaseExt(filePath);

  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".flac") return "audio/flac";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".aac") return "audio/aac";
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".opus") return "audio/opus";
  if (extension === ".aif" || extension === ".aiff") return "audio/aiff";

  return "application/octet-stream";
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

function joinPath(folderPath: string, fileName: string): string {
  const separator = folderPath.includes("\\") ? "\\" : "/";
  const trimmed = folderPath.replace(/[\\/]+$/, "");
  return `${trimmed}${separator}${fileName}`;
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
