import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type SaveDialogOptions,
  type OpenDialogOptions,
} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { stat, unlink, writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

type FfmpegCheckResult = {
  available: boolean;
  version: string;
};

type CutPayload = {
  inputPath: string;
  startTime: number;
  endTime: number;
  outputPath: string;
  mode?: "copy" | "precise";
};

type SaveAudioDialogPayload = {
  defaultName?: string;
  inputExtension?: string;
  mode?: "copy" | "precise";
};

type SaveMergeDialogPayload = {
  defaultName?: string;
};

type MergePayload = {
  filePaths: string[];
  outputPath: string;
};

type ProbeJsonStream = {
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
};

type ProbeJson = {
  streams?: ProbeJsonStream[];
};

type AudioStreamInfo = {
  codec: string;
  sampleRate: number;
  channels: number;
  channelLayout: string;
};

const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "flac",
  "ogg",
  "aac",
  "m4a",
  "wma",
  "aiff",
  "aif",
  "opus",
];
const PASSTHROUGH_EXTENSIONS = new Set([".mp3", ".m4a"]);
const LOSSLESS_OUTPUT_EXTENSIONS = new Set([".wav", ".flac"]);
const COPY_MERGE_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".flac"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toAbsolutePath(value: string): string {
  return path.resolve(value);
}

function secondsToArgument(valueInSeconds: number): string {
  return valueInSeconds.toFixed(3);
}

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

async function ensureFile(filePath: string): Promise<void> {
  const target = await stat(filePath);
  if (!target.isFile()) {
    throw new Error("Input path must be a file.");
  }
}

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const parentDir = path.dirname(filePath);
  const target = await stat(parentDir);
  if (!target.isDirectory()) {
    throw new Error("Output directory does not exist.");
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      args,
      { windowsHide: true },
      (error, _stdout, stderr) => {
        if (!error) {
          resolve();
          return;
        }

        const message =
          stderr.trim() || error.message || "FFmpeg command failed.";
        reject(new Error(message));
      },
    );
  });
}

function runFfprobe(filePath: string): Promise<AudioStreamInfo> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_streams",
      "-of",
      "json",
      filePath,
    ];

    execFile(
      "ffprobe",
      args,
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const message =
            stderr.trim() || error.message || "FFprobe command failed.";
          reject(new Error(message));
          return;
        }

        let parsed: ProbeJson;
        try {
          parsed = JSON.parse(stdout) as ProbeJson;
        } catch {
          reject(new Error("Unable to parse FFprobe output."));
          return;
        }

        const stream = parsed.streams?.[0];
        if (!stream?.codec_name) {
          reject(new Error("No primary audio stream found."));
          return;
        }

        const sampleRate = Number.parseInt(stream.sample_rate ?? "", 10);
        if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
          reject(new Error("Invalid audio sample rate from FFprobe."));
          return;
        }

        const channels = stream.channels ?? 0;
        if (!Number.isFinite(channels) || channels <= 0) {
          reject(new Error("Invalid audio channel count from FFprobe."));
          return;
        }

        resolve({
          codec: stream.codec_name,
          sampleRate,
          channels,
          channelLayout: stream.channel_layout ?? "",
        });
      },
    );
  });
}

function validateCutPayload(payload: unknown): CutPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid cut payload.");
  }

  const candidate = payload as Partial<CutPayload>;

  if (!candidate.inputPath || typeof candidate.inputPath !== "string") {
    throw new Error("inputPath is required.");
  }

  if (!candidate.outputPath || typeof candidate.outputPath !== "string") {
    throw new Error("outputPath is required.");
  }

  if (!isFiniteNumber(candidate.startTime) || candidate.startTime < 0) {
    throw new Error("startTime must be a finite number >= 0.");
  }

  if (
    !isFiniteNumber(candidate.endTime) ||
    candidate.endTime <= candidate.startTime
  ) {
    throw new Error("endTime must be greater than startTime.");
  }

  if (candidate.endTime - candidate.startTime < 0.05) {
    throw new Error("Cut duration must be at least 0.05 seconds.");
  }

  if (
    candidate.mode &&
    candidate.mode !== "copy" &&
    candidate.mode !== "precise"
  ) {
    throw new Error("mode must be either copy or precise.");
  }

  return {
    inputPath: toAbsolutePath(candidate.inputPath),
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    outputPath: toAbsolutePath(candidate.outputPath),
    mode: candidate.mode,
  };
}

function validateMergePayload(payload: unknown): MergePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid merge payload.");
  }

  const candidate = payload as Partial<MergePayload>;
  if (!Array.isArray(candidate.filePaths)) {
    throw new Error("filePaths must be an array.");
  }

  if (candidate.filePaths.length < 2) {
    throw new Error("At least two files are required to merge.");
  }

  if (!candidate.outputPath || typeof candidate.outputPath !== "string") {
    throw new Error("outputPath is required.");
  }

  const normalizedFilePaths = candidate.filePaths.map((filePath) => {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      throw new Error("Each merge file path must be a non-empty string.");
    }

    return toAbsolutePath(filePath);
  });

  const dedupeSet = new Set(normalizedFilePaths.map(normalizeForCompare));
  if (dedupeSet.size !== normalizedFilePaths.length) {
    throw new Error("Duplicate file paths are not allowed in merge queue.");
  }

  return {
    filePaths: normalizedFilePaths,
    outputPath: toAbsolutePath(candidate.outputPath),
  };
}

function normalizeForCompare(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}

function buildCutCodecArgs(
  inputExt: string,
  outputExt: string,
  mode?: "copy" | "precise",
): string[] {
  const shouldUseCopy =
    mode !== "precise" && PASSTHROUGH_EXTENSIONS.has(inputExt);

  if (shouldUseCopy) {
    if (outputExt !== inputExt) {
      throw new Error(
        "For MP3/M4A passthrough cuts, output extension must match input extension.",
      );
    }

    return ["-c", "copy"];
  }

  if (outputExt === ".mp3") {
    return ["-c:a", "libmp3lame", "-b:a", "192k"];
  }

  if (outputExt === ".m4a") {
    return ["-c:a", "aac", "-b:a", "192k"];
  }

  if (outputExt === ".wav") {
    return ["-c:a", "pcm_s16le"];
  }

  if (outputExt === ".flac") {
    return ["-c:a", "flac"];
  }

  throw new Error(
    "Unsupported output extension. Use .mp3, .m4a, .wav, or .flac.",
  );
}

function normalizeExtension(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function buildSaveAudioFilters(
  inputExtension: string,
  mode?: "copy" | "precise",
): SaveDialogOptions["filters"] {
  if (PASSTHROUGH_EXTENSIONS.has(inputExtension) && mode !== "precise") {
    if (inputExtension === ".mp3") {
      return [{ name: "MP3", extensions: ["mp3"] }];
    }

    return [{ name: "M4A", extensions: ["m4a"] }];
  }

  if (!PASSTHROUGH_EXTENSIONS.has(inputExtension)) {
    return [
      { name: "WAV", extensions: ["wav"] },
      { name: "FLAC", extensions: ["flac"] },
    ];
  }

  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] },
  ];
}

function buildSaveMergeFilters(): SaveDialogOptions["filters"] {
  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] },
  ];
}

function buildMergeCodecArgs(outputExt: string): string[] {
  if (outputExt === ".wav") {
    return ["-c:a", "pcm_s16le"];
  }

  if (outputExt === ".flac") {
    return ["-c:a", "flac"];
  }

  throw new Error("Mixed-format merges must be saved as .wav or .flac.");
}

function buildNormalizedConcatFilter(inputCount: number): string {
  const normalizeChains: string[] = [];
  const concatInputs: string[] = [];

  for (let index = 0; index < inputCount; index += 1) {
    const outputLabel = `a${index}`;
    normalizeChains.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[${outputLabel}]`,
    );
    concatInputs.push(`[${outputLabel}]`);
  }

  normalizeChains.push(
    `${concatInputs.join("")}concat=n=${inputCount}:v=0:a=1[outa]`,
  );

  return normalizeChains.join(";");
}

function escapeConcatListPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

function buildConcatListContent(filePaths: string[]): string {
  return filePaths
    .map((filePath) => `file '${escapeConcatListPath(filePath)}'`)
    .join("\n");
}

function isStreamCompatibleForCopy(streams: AudioStreamInfo[]): boolean {
  if (streams.length < 2) {
    return false;
  }

  const base = streams[0];

  return streams.every((stream) => {
    if (stream.codec !== base.codec) {
      return false;
    }

    if (stream.sampleRate !== base.sampleRate) {
      return false;
    }

    if (stream.channels !== base.channels) {
      return false;
    }

    if (base.channelLayout && stream.channelLayout) {
      return stream.channelLayout === base.channelLayout;
    }

    return true;
  });
}

function alignDefaultNameExtension(
  defaultName: string,
  filters: SaveDialogOptions["filters"],
): string {
  const allowed = new Set(
    filters?.flatMap((filter) => filter.extensions) ?? [],
  );
  if (allowed.size === 0) {
    return defaultName;
  }

  const currentExt = path.extname(defaultName).toLowerCase().replace(/^\./, "");
  if (currentExt && allowed.has(currentExt)) {
    return defaultName;
  }

  const firstAllowed = filters?.[0]?.extensions[0];
  if (!firstAllowed) {
    return defaultName;
  }

  const baseName =
    path.extname(defaultName).length > 0
      ? defaultName.slice(0, -path.extname(defaultName).length)
      : defaultName;

  return `${baseName}.${firstAllowed}`;
}

function checkFfmpeg(): Promise<FfmpegCheckResult> {
  return new Promise((resolve) => {
    execFile("ffmpeg", ["-version"], { windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve({ available: false, version: "" });
        return;
      }

      const firstLine = stdout.split(/\r?\n/, 1)[0] ?? "";
      resolve({ available: true, version: firstLine.trim() });
    });
  });
}

function registerIpcHandlers() {
  ipcMain.handle("ffmpeg:check", () => checkFfmpeg());
  ipcMain.handle("dialog:open-audio", async () => {
    const options: OpenDialogOptions = {
      title: "Select Audio File",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: AUDIO_EXTENSIONS,
        },
      ],
    };

    const browserWindow = win ?? BrowserWindow.getFocusedWindow();
    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled) {
      return { filePaths: [] };
    }

    return {
      filePaths: result.filePaths.map((selectedPath) =>
        path.resolve(selectedPath),
      ),
    };
  });

  ipcMain.handle(
    "dialog:save-audio",
    async (_event, payload?: SaveAudioDialogPayload) => {
      const requestedDefaultName =
        typeof payload?.defaultName === "string" &&
        payload.defaultName.trim().length > 0
          ? payload.defaultName.trim()
          : "clip.wav";

      const inputExtension = normalizeExtension(payload?.inputExtension);
      const filters = buildSaveAudioFilters(inputExtension, payload?.mode);
      const defaultName = alignDefaultNameExtension(
        requestedDefaultName,
        filters,
      );

      const options: SaveDialogOptions = {
        title: "Save Cut Audio",
        defaultPath: defaultName,
        filters,
      };

      const browserWindow = win ?? BrowserWindow.getFocusedWindow();
      const result = browserWindow
        ? await dialog.showSaveDialog(browserWindow, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || !result.filePath) {
        return { filePath: undefined };
      }

      return { filePath: toAbsolutePath(result.filePath) };
    },
  );

  ipcMain.handle(
    "dialog:save-merge",
    async (_event, payload?: SaveMergeDialogPayload) => {
      const requestedDefaultName =
        typeof payload?.defaultName === "string" &&
        payload.defaultName.trim().length > 0
          ? payload.defaultName.trim()
          : "merged.wav";

      const filters = buildSaveMergeFilters();
      const defaultName = alignDefaultNameExtension(
        requestedDefaultName,
        filters,
      );

      const options: SaveDialogOptions = {
        title: "Save Merged Audio",
        defaultPath: defaultName,
        filters,
      };

      const browserWindow = win ?? BrowserWindow.getFocusedWindow();
      const result = browserWindow
        ? await dialog.showSaveDialog(browserWindow, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || !result.filePath) {
        return { filePath: undefined };
      }

      return { filePath: toAbsolutePath(result.filePath) };
    },
  );

  ipcMain.handle("audio:cut", async (_event, payload: unknown) => {
    const params = validateCutPayload(payload);

    await ensureFile(params.inputPath);
    await ensureDirectoryExists(params.outputPath);

    const inputExt = getExtension(params.inputPath);
    const outputExt = getExtension(params.outputPath);

    if (PASSTHROUGH_EXTENSIONS.has(inputExt)) {
      if (params.mode !== "precise" && outputExt !== inputExt) {
        throw new Error(
          "Output extension must match input for MP3/M4A passthrough cuts.",
        );
      }
    } else if (!LOSSLESS_OUTPUT_EXTENSIONS.has(outputExt)) {
      throw new Error("For non-MP3/M4A sources, output must be .wav or .flac.");
    }

    const codecArgs = buildCutCodecArgs(inputExt, outputExt, params.mode);

    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      secondsToArgument(params.startTime),
      "-to",
      secondsToArgument(params.endTime),
      "-i",
      params.inputPath,
      ...codecArgs,
      params.outputPath,
    ];

    await runFfmpeg(ffmpegArgs);

    return { success: true, outputPath: params.outputPath };
  });

  ipcMain.handle("audio:merge", async (_event, payload: unknown) => {
    const params = validateMergePayload(payload);

    await ensureDirectoryExists(params.outputPath);
    await Promise.all(params.filePaths.map((filePath) => ensureFile(filePath)));

    const sourceExtensions = params.filePaths.map((filePath) =>
      getExtension(filePath),
    );
    const firstSourceExt = sourceExtensions[0];
    const outputExt = getExtension(params.outputPath);

    const allSameSourceExtension = sourceExtensions.every(
      (ext) => ext === firstSourceExt,
    );

    let useStreamCopy = false;

    if (allSameSourceExtension && COPY_MERGE_EXTENSIONS.has(firstSourceExt)) {
      const streamInfo = await Promise.all(
        params.filePaths.map((filePath) => runFfprobe(filePath)),
      );

      useStreamCopy = isStreamCompatibleForCopy(streamInfo);
    }

    if (useStreamCopy) {
      if (outputExt !== firstSourceExt) {
        throw new Error(
          "For stream-copy merge, output extension must match source files.",
        );
      }

      const mergeListPath = path.join(
        tmpdir(),
        `audioslice-merge-${randomUUID()}.txt`,
      );

      try {
        await writeFile(
          mergeListPath,
          buildConcatListContent(params.filePaths),
          {
            encoding: "utf8",
          },
        );

        await runFfmpeg([
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          mergeListPath,
          "-c",
          "copy",
          params.outputPath,
        ]);
      } finally {
        await unlink(mergeListPath).catch(() => undefined);
      }
    } else {
      if (!LOSSLESS_OUTPUT_EXTENSIONS.has(outputExt)) {
        throw new Error("Mixed-format merges must be saved as .wav or .flac.");
      }

      const inputArgs = params.filePaths.flatMap((filePath) => [
        "-i",
        filePath,
      ]);
      const filterGraph = buildNormalizedConcatFilter(params.filePaths.length);
      const codecArgs = buildMergeCodecArgs(outputExt);

      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        ...inputArgs,
        "-filter_complex",
        filterGraph,
        "-map",
        "[outa]",
        ...codecArgs,
        params.outputPath,
      ]);
    }

    return { success: true, outputPath: params.outputPath };
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
