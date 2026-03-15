import { useEffect, useRef, useState, type MutableRefObject } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, {
  type Region,
} from "wavesurfer.js/dist/plugins/regions.esm.js";

const REGION_COLORS = [
  "rgba(16, 185, 129, 0.24)",
  "rgba(59, 130, 246, 0.24)",
  "rgba(244, 114, 182, 0.24)",
  "rgba(251, 191, 36, 0.24)",
  "rgba(167, 139, 250, 0.24)",
];
const DEFAULT_REGION_DURATION_SECONDS = 5;
const MIN_REGION_DURATION_SECONDS = 0.05;

export type WaveformRegion = {
  id: string;
  start: number;
  end: number;
  color: string;
};

export type RegionContextMenuState = {
  regionId: string;
  x: number;
  y: number;
};

type AudioSource = string | Blob | null;

type UseWaveSurferResult = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isReady: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  volume: number;
  duration: number;
  currentTime: number;
  error: string | null;
  regions: WaveformRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  regionContextMenu: RegionContextMenuState | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (value: number) => void;
  selectRegion: (regionId: string | null) => void;
  playRegion: (regionId: string) => void;
  removeRegion: (regionId: string) => void;
  closeRegionContextMenu: () => void;
  previewRegionFromContextMenu: () => void;
  deleteRegionFromContextMenu: () => void;
};

export function useWaveSurfer(
  audioSource: AudioSource,
  initToken: string,
): UseWaveSurferResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const regionColorIndexRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<WaveformRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [regionContextMenu, setRegionContextMenu] =
    useState<RegionContextMenuState | null>(null);
  const [instanceRevision, setInstanceRevision] = useState(0);

  const syncRegions = () => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin) {
      setRegions([]);
      setSelectedRegionId(null);
      return;
    }

    const nextRegions = regionsPlugin
      .getRegions()
      .map((region) => ({
        id: region.id,
        start: region.start,
        end: region.end,
        color: region.color,
      }))
      .sort((left, right) => left.start - right.start);

    setRegions(nextRegions);
    setSelectedRegionId((current) => {
      if (!current) {
        return nextRegions[0]?.id ?? null;
      }

      const exists = nextRegions.some((region) => region.id === current);
      return exists ? current : (nextRegions[0]?.id ?? null);
    });
    setHoveredRegionId((current) => {
      if (!current) {
        return null;
      }

      const exists = nextRegions.some((region) => region.id === current);
      return exists ? current : null;
    });
  };

  const chooseRegionColor = () => {
    const color =
      REGION_COLORS[regionColorIndexRef.current % REGION_COLORS.length];
    regionColorIndexRef.current += 1;
    return color;
  };

  const ensureRegionInteractive = (region: Region) => {
    const regionElement = (region as Region & { element?: HTMLElement })
      .element;

    region.on("click", (event) => {
      event.stopPropagation();
      setSelectedRegionId(region.id);
      setRegionContextMenu(null);
    });

    region.on("dblclick", (event) => {
      event.stopPropagation();
      setSelectedRegionId(region.id);
      setRegionContextMenu(null);
    });

    region.on("over", () => {
      setHoveredRegionId(region.id);
    });

    region.on("leave", () => {
      setHoveredRegionId((current) => (current === region.id ? null : current));
    });

    if (regionElement) {
      regionElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedRegionId(region.id);
        setRegionContextMenu({
          regionId: region.id,
          x: event.clientX,
          y: event.clientY,
        });
      });
    }
  };

  useEffect(() => {
    if (!containerRef.current || waveSurferRef.current) {
      return;
    }

    const regionsPlugin = RegionsPlugin.create();

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      plugins: [regionsPlugin],
      waveColor: "#4a5565",
      progressColor: "#16a34a",
      cursorColor: "#d4d4d8",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 180,
      normalize: true,
      dragToSeek: true,
    });
    waveSurfer.setVolume(1);

    waveSurferRef.current = waveSurfer;
    regionsPluginRef.current = regionsPlugin;
    setInstanceRevision((current) => current + 1);
    const disableDragSelection = regionsPlugin.enableDragSelection({
      color: "rgba(16, 185, 129, 0.24)",
      drag: true,
      resize: true,
      minLength: 0.05,
    });

    const unbindReady = waveSurfer.on("ready", () => {
      setIsReady(true);
      setIsLoading(false);
      setError(null);
      setDuration(waveSurfer.getDuration());
      setCurrentTime(0);
      syncRegions();
    });

    const unbindLoad = waveSurfer.on("load", () => {
      setIsLoading(true);
      setIsReady(false);
      setError(null);
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setRegions([]);
      setSelectedRegionId(null);
      setHoveredRegionId(null);
      setRegionContextMenu(null);
    });

    const unbindPlay = waveSurfer.on("play", () => {
      setIsPlaying(true);
    });

    const unbindPause = waveSurfer.on("pause", () => {
      setIsPlaying(false);
    });

    const unbindFinish = waveSurfer.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(waveSurfer.getDuration());
    });

    const unbindTimeUpdate = waveSurfer.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    const unbindError = waveSurfer.on("error", (detail) => {
      setIsLoading(false);
      setIsReady(false);
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
      setError(typeof detail === "string" ? detail : "Failed to load audio.");
      setRegions([]);
      setSelectedRegionId(null);
      setHoveredRegionId(null);
      setRegionContextMenu(null);
    });

    const unbindWaveformClick = waveSurfer.on("click", () => {
      setRegionContextMenu(null);
    });

    const unbindWaveformDoubleClick = waveSurfer.on("dblclick", (relativeX) => {
      const durationInSeconds = waveSurfer.getDuration();
      if (
        !Number.isFinite(durationInSeconds) ||
        durationInSeconds < MIN_REGION_DURATION_SECONDS
      ) {
        return;
      }

      const boundedRatio = Math.min(1, Math.max(0, relativeX));
      const clickTime = boundedRatio * durationInSeconds;
      const end = Math.min(
        durationInSeconds,
        clickTime + DEFAULT_REGION_DURATION_SECONDS,
      );

      let start = clickTime;
      if (end - start < MIN_REGION_DURATION_SECONDS) {
        start = Math.max(0, end - MIN_REGION_DURATION_SECONDS);
      }

      regionsPlugin.addRegion({
        start,
        end,
        color: chooseRegionColor(),
        drag: true,
        resize: true,
      });
    });

    const unbindRegionCreated = regionsPlugin.on("region-created", (region) => {
      if (!region.color) {
        region.setOptions({ color: chooseRegionColor() });
      }

      ensureRegionInteractive(region);
      setSelectedRegionId(region.id);
      syncRegions();
    });

    const unbindRegionUpdated = regionsPlugin.on("region-updated", () => {
      syncRegions();
    });

    const unbindRegionRemoved = regionsPlugin.on("region-removed", () => {
      syncRegions();
    });

    return () => {
      disableDragSelection();
      unbindReady();
      unbindLoad();
      unbindPlay();
      unbindPause();
      unbindFinish();
      unbindTimeUpdate();
      unbindError();
      unbindWaveformClick();
      unbindWaveformDoubleClick();
      unbindRegionCreated();
      unbindRegionUpdated();
      unbindRegionRemoved();
      waveSurfer.destroy();
      waveSurferRef.current = null;
      regionsPluginRef.current = null;
    };
  }, [initToken]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) {
      return;
    }

    if (!audioSource) {
      regionsPluginRef.current?.clearRegions();
      waveSurfer.empty();
      setIsLoading(false);
      setIsReady(false);
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
      setError(null);
      setRegions([]);
      setSelectedRegionId(null);
      setHoveredRegionId(null);
      setRegionContextMenu(null);
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsReady(false);
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    if (audioSource instanceof Blob) {
      void waveSurfer.loadBlob(audioSource);
      return;
    }

    waveSurfer.load(audioSource);
  }, [audioSource, instanceRevision]);

  useEffect(() => {
    waveSurferRef.current?.setVolume(volume);
  }, [volume]);

  const play = async () => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !isReady) {
      return;
    }

    await waveSurfer.play();
  };

  const pause = () => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !isReady) {
      return;
    }

    waveSurfer.pause();
  };

  const stop = () => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !isReady) {
      return;
    }

    waveSurfer.stop();
    setCurrentTime(0);
  };

  const setVolume = (value: number) => {
    const normalized = Number.isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : 1;
    setVolumeState(normalized);
  };

  const selectRegion = (regionId: string | null) => {
    setSelectedRegionId(regionId);
  };

  const playRegion = (regionId: string) => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin || !isReady) {
      return;
    }

    const region = regionsPlugin
      .getRegions()
      .find((item) => item.id === regionId);
    if (!region) {
      return;
    }

    setSelectedRegionId(region.id);
    region.play(true);
  };

  const removeRegion = (regionId: string) => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin) {
      return;
    }

    const region = regionsPlugin
      .getRegions()
      .find((item) => item.id === regionId);
    if (!region) {
      return;
    }

    region.remove();
    setRegionContextMenu((current) =>
      current?.regionId === regionId ? null : current,
    );
    syncRegions();
  };

  const closeRegionContextMenu = () => {
    setRegionContextMenu(null);
  };

  const previewRegionFromContextMenu = () => {
    const targetRegionId = regionContextMenu?.regionId;
    if (!targetRegionId) {
      return;
    }

    playRegion(targetRegionId);
    setRegionContextMenu(null);
  };

  const deleteRegionFromContextMenu = () => {
    const targetRegionId = regionContextMenu?.regionId;
    if (!targetRegionId) {
      return;
    }

    removeRegion(targetRegionId);
    setRegionContextMenu(null);
  };

  return {
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
  };
}
