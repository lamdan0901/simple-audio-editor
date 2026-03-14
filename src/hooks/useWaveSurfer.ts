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

type UseWaveSurferResult = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isReady: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  error: string | null;
  regions: WaveformRegion[];
  selectedRegionId: string | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  selectRegion: (regionId: string | null) => void;
  playRegion: (regionId: string) => void;
  removeRegion: (regionId: string) => void;
};

export function useWaveSurfer(audioUrl: string | null): UseWaveSurferResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const regionColorIndexRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<WaveformRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

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
  };

  const chooseRegionColor = () => {
    const color =
      REGION_COLORS[regionColorIndexRef.current % REGION_COLORS.length];
    regionColorIndexRef.current += 1;
    return color;
  };

  const ensureRegionInteractive = (region: Region) => {
    region.on("click", (event) => {
      event.stopPropagation();
      setSelectedRegionId(region.id);
    });

    region.on("dblclick", (event) => {
      event.stopPropagation();
      region.play(true);
      setSelectedRegionId(region.id);
    });
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

    waveSurferRef.current = waveSurfer;
    regionsPluginRef.current = regionsPlugin;
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
    });

    const unbindWaveformClick = waveSurfer.on("click", (relativeX) => {
      const regionsApi = regionsPluginRef.current;
      if (!regionsApi) {
        return;
      }

      const durationInSeconds = waveSurfer.getDuration();
      if (
        !Number.isFinite(durationInSeconds) ||
        durationInSeconds < MIN_REGION_DURATION_SECONDS
      ) {
        return;
      }

      const boundedRatio = Math.min(1, Math.max(0, relativeX));
      const clickTime = boundedRatio * durationInSeconds;
      const clickedRegion = regionsApi
        .getRegions()
        .find((region) => clickTime >= region.start && clickTime <= region.end);
      if (clickedRegion) {
        setSelectedRegionId(clickedRegion.id);
        return;
      }

      const end = Math.min(
        durationInSeconds,
        clickTime + DEFAULT_REGION_DURATION_SECONDS,
      );

      let start = clickTime;
      if (end - start < MIN_REGION_DURATION_SECONDS) {
        start = Math.max(0, end - MIN_REGION_DURATION_SECONDS);
      }

      regionsApi.addRegion({
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
      unbindRegionCreated();
      unbindRegionUpdated();
      unbindRegionRemoved();
      waveSurfer.destroy();
      waveSurferRef.current = null;
      regionsPluginRef.current = null;
    };
  }, []);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) {
      return;
    }

    if (!audioUrl) {
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
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsReady(false);
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    waveSurfer.load(audioUrl);
  }, [audioUrl]);

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
    syncRegions();
  };

  return {
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
  };
}
