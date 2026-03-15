import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { readFile, mkdir, writeFile, unlink, stat } from "node:fs/promises";
const DEFAULT_SETTINGS = {
  defaultOutputFolder: null
};
function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}
function normalizeFolderPath(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return path.resolve(trimmed);
}
async function loadSettings() {
  try {
    const raw = await readFile(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      defaultOutputFolder: normalizeFolderPath(parsed.defaultOutputFolder)
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
async function saveSettings(settings) {
  const settingsPath = getSettingsPath();
  await mkdir(path.dirname(settingsPath), { recursive: true });
  const normalized = {
    defaultOutputFolder: normalizeFolderPath(settings.defaultOutputFolder)
  };
  await writeFile(settingsPath, JSON.stringify(normalized, null, 2), "utf8");
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const APP_ICON_PATH = path.join(process.env.APP_ROOT, "resources", "icon.ico");
const FALLBACK_ICON_PATH = path.join(
  process.env.VITE_PUBLIC,
  "electron-vite.svg"
);
const WINDOW_ICON_PATH = existsSync(APP_ICON_PATH) ? APP_ICON_PATH : FALLBACK_ICON_PATH;
let win;
let appSettings = { defaultOutputFolder: null };
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
  "opus"
];
const PASSTHROUGH_EXTENSIONS = /* @__PURE__ */ new Set([".mp3", ".m4a"]);
const LOSSLESS_OUTPUT_EXTENSIONS = /* @__PURE__ */ new Set([".wav", ".flac"]);
const COPY_MERGE_EXTENSIONS = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]);
const MERGE_OUTPUT_EXTENSIONS = /* @__PURE__ */ new Set([".mp3", ".m4a", ".wav", ".flac"]);
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function toAbsolutePath(value) {
  return path.resolve(value);
}
function secondsToArgument(valueInSeconds) {
  return valueInSeconds.toFixed(3);
}
function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}
async function ensureFile(filePath) {
  const target = await stat(filePath);
  if (!target.isFile()) {
    throw new Error("Input path must be a file.");
  }
}
async function ensureDirectoryExists(filePath) {
  const parentDir = path.dirname(filePath);
  const target = await stat(parentDir);
  if (!target.isDirectory()) {
    throw new Error("Output directory does not exist.");
  }
}
async function isExistingDirectory(folderPath) {
  try {
    const target = await stat(folderPath);
    return target.isDirectory();
  } catch {
    return false;
  }
}
function runFfmpeg(args) {
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
        const message = stderr.trim() || error.message || "FFmpeg command failed.";
        reject(new Error(message));
      }
    );
  });
}
function runFfprobe(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_streams",
      "-of",
      "json",
      filePath
    ];
    execFile(
      "ffprobe",
      args,
      { windowsHide: true },
      (error, stdout, stderr) => {
        var _a;
        if (error) {
          const message = stderr.trim() || error.message || "FFprobe command failed.";
          reject(new Error(message));
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(new Error("Unable to parse FFprobe output."));
          return;
        }
        const stream = (_a = parsed.streams) == null ? void 0 : _a[0];
        if (!(stream == null ? void 0 : stream.codec_name)) {
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
          channelLayout: stream.channel_layout ?? ""
        });
      }
    );
  });
}
function validateCutPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid cut payload.");
  }
  const candidate = payload;
  if (!candidate.inputPath || typeof candidate.inputPath !== "string") {
    throw new Error("inputPath is required.");
  }
  if (!candidate.outputPath || typeof candidate.outputPath !== "string") {
    throw new Error("outputPath is required.");
  }
  if (!isFiniteNumber(candidate.startTime) || candidate.startTime < 0) {
    throw new Error("startTime must be a finite number >= 0.");
  }
  if (!isFiniteNumber(candidate.endTime) || candidate.endTime <= candidate.startTime) {
    throw new Error("endTime must be greater than startTime.");
  }
  if (candidate.endTime - candidate.startTime < 0.05) {
    throw new Error("Cut duration must be at least 0.05 seconds.");
  }
  if (candidate.mode && candidate.mode !== "copy" && candidate.mode !== "precise") {
    throw new Error("mode must be either copy or precise.");
  }
  return {
    inputPath: toAbsolutePath(candidate.inputPath),
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    outputPath: toAbsolutePath(candidate.outputPath),
    mode: candidate.mode
  };
}
function validateMergePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid merge payload.");
  }
  const candidate = payload;
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
    outputPath: toAbsolutePath(candidate.outputPath)
  };
}
function normalizeForCompare(filePath) {
  return path.normalize(filePath).toLowerCase();
}
function buildCutCodecArgs(inputExt, outputExt, mode) {
  const shouldUseCopy = mode !== "precise" && PASSTHROUGH_EXTENSIONS.has(inputExt);
  if (shouldUseCopy) {
    if (outputExt !== inputExt) {
      throw new Error(
        "For MP3/M4A passthrough cuts, output extension must match input extension."
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
    "Unsupported output extension. Use .mp3, .m4a, .wav, or .flac."
  );
}
function normalizeExtension(value) {
  if (!value) {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}
function sanitizeDefaultName(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const basenameOnly = path.basename(trimmed);
  const noControlChars = [...basenameOnly].filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("");
  const safe = noControlChars.trim();
  return safe || fallback;
}
function validateSaveAudioDialogPayload(payload) {
  if (payload == null) {
    return { defaultName: "clip.wav", forceDialog: false };
  }
  if (typeof payload !== "object") {
    throw new Error("Invalid save-audio payload.");
  }
  const candidate = payload;
  const mode = candidate.mode;
  if (mode && mode !== "copy" && mode !== "precise") {
    throw new Error("save-audio mode must be either copy or precise.");
  }
  if (candidate.forceDialog != null && typeof candidate.forceDialog !== "boolean") {
    throw new Error("save-audio forceDialog must be a boolean.");
  }
  return {
    defaultName: sanitizeDefaultName(candidate.defaultName, "clip.wav"),
    inputExtension: normalizeExtension(candidate.inputExtension),
    mode,
    forceDialog: candidate.forceDialog ?? false
  };
}
function validateSaveMergeDialogPayload(payload) {
  if (payload == null) {
    return { defaultName: "merged.wav", forceDialog: false };
  }
  if (typeof payload !== "object") {
    throw new Error("Invalid save-merge payload.");
  }
  const candidate = payload;
  if (candidate.forceDialog != null && typeof candidate.forceDialog !== "boolean") {
    throw new Error("save-merge forceDialog must be a boolean.");
  }
  return {
    defaultName: sanitizeDefaultName(candidate.defaultName, "merged.wav"),
    forceDialog: candidate.forceDialog ?? false
  };
}
function buildSaveAudioFilters(inputExtension, mode) {
  if (PASSTHROUGH_EXTENSIONS.has(inputExtension) && mode !== "precise") {
    if (inputExtension === ".mp3") {
      return [{ name: "MP3", extensions: ["mp3"] }];
    }
    return [{ name: "M4A", extensions: ["m4a"] }];
  }
  if (!PASSTHROUGH_EXTENSIONS.has(inputExtension)) {
    return [
      { name: "WAV", extensions: ["wav"] },
      { name: "FLAC", extensions: ["flac"] }
    ];
  }
  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function buildSaveMergeFilters() {
  return [
    { name: "MP3", extensions: ["mp3"] },
    { name: "M4A", extensions: ["m4a"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "FLAC", extensions: ["flac"] }
  ];
}
function buildMergeCodecArgs(outputExt) {
  if (outputExt === ".wav") {
    return ["-c:a", "pcm_s16le"];
  }
  if (outputExt === ".flac") {
    return ["-c:a", "flac"];
  }
  throw new Error("Mixed-format merges must be saved as .wav or .flac.");
}
function buildNormalizedConcatFilter(inputCount) {
  const normalizeChains = [];
  const concatInputs = [];
  for (let index = 0; index < inputCount; index += 1) {
    const outputLabel = `a${index}`;
    normalizeChains.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[${outputLabel}]`
    );
    concatInputs.push(`[${outputLabel}]`);
  }
  normalizeChains.push(
    `${concatInputs.join("")}concat=n=${inputCount}:v=0:a=1[outa]`
  );
  return normalizeChains.join(";");
}
function escapeConcatListPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}
function buildConcatListContent(filePaths) {
  return filePaths.map((filePath) => `file '${escapeConcatListPath(filePath)}'`).join("\n");
}
function isStreamCompatibleForCopy(streams) {
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
function alignDefaultNameExtension(defaultName, filters) {
  var _a;
  const allowed = new Set(
    (filters == null ? void 0 : filters.flatMap((filter) => filter.extensions)) ?? []
  );
  if (allowed.size === 0) {
    return defaultName;
  }
  const currentExt = path.extname(defaultName).toLowerCase().replace(/^\./, "");
  if (currentExt && allowed.has(currentExt)) {
    return defaultName;
  }
  const firstAllowed = (_a = filters == null ? void 0 : filters[0]) == null ? void 0 : _a.extensions[0];
  if (!firstAllowed) {
    return defaultName;
  }
  const baseName = path.extname(defaultName).length > 0 ? defaultName.slice(0, -path.extname(defaultName).length) : defaultName;
  return `${baseName}.${firstAllowed}`;
}
function checkFfmpeg() {
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
  ipcMain.handle("audio:read-file", async (_event, payload) => {
    if (typeof payload !== "string" || payload.trim().length === 0) {
      throw new Error("A valid file path is required.");
    }
    const targetPath = toAbsolutePath(payload);
    await ensureFile(targetPath);
    const bytes = await readFile(targetPath);
    const byteOffset = bytes.byteOffset;
    const byteLength = bytes.byteLength;
    const arrayBuffer = bytes.buffer.slice(byteOffset, byteOffset + byteLength);
    return { arrayBuffer };
  });
  ipcMain.handle("dialog:open-audio", async () => {
    const options = {
      title: "Select Audio File",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio Files",
          extensions: AUDIO_EXTENSIONS
        }
      ]
    };
    const browserWindow = win ?? BrowserWindow.getFocusedWindow();
    const result = browserWindow ? await dialog.showOpenDialog(browserWindow, options) : await dialog.showOpenDialog(options);
    if (result.canceled) {
      return { filePaths: [] };
    }
    return {
      filePaths: result.filePaths.map(
        (selectedPath) => path.resolve(selectedPath)
      )
    };
  });
  ipcMain.handle("dialog:select-output-folder", async () => {
    const options = {
      title: "Select Default Output Folder",
      properties: ["openDirectory", "createDirectory"]
    };
    const browserWindow = win ?? BrowserWindow.getFocusedWindow();
    const result = browserWindow ? await dialog.showOpenDialog(browserWindow, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return { folderPath: void 0 };
    }
    return {
      folderPath: toAbsolutePath(result.filePaths[0])
    };
  });
  ipcMain.handle("settings:get-default-output-folder", () => {
    return { folderPath: appSettings.defaultOutputFolder ?? void 0 };
  });
  ipcMain.handle(
    "settings:set-default-output-folder",
    async (_event, payload) => {
      if (typeof payload !== "string" || payload.trim().length === 0) {
        throw new Error("A valid output folder path is required.");
      }
      const folderPath = toAbsolutePath(payload);
      const exists = await isExistingDirectory(folderPath);
      if (!exists) {
        throw new Error("Selected output folder does not exist.");
      }
      appSettings = {
        ...appSettings,
        defaultOutputFolder: folderPath
      };
      await saveSettings(appSettings);
      return { folderPath };
    }
  );
  ipcMain.handle("settings:clear-default-output-folder", async () => {
    appSettings = {
      ...appSettings,
      defaultOutputFolder: null
    };
    await saveSettings(appSettings);
    return { success: true };
  });
  ipcMain.handle("dialog:save-audio", async (_event, payload) => {
    const validated = validateSaveAudioDialogPayload(payload);
    const requestedDefaultName = validated.defaultName ?? "clip.wav";
    const filters = buildSaveAudioFilters(
      validated.inputExtension ?? "",
      validated.mode
    );
    const defaultName = alignDefaultNameExtension(
      requestedDefaultName,
      filters
    );
    const savedFolder = appSettings.defaultOutputFolder;
    const hasSavedFolder = typeof savedFolder === "string" && savedFolder.length > 0 && await isExistingDirectory(savedFolder);
    if (!validated.forceDialog && hasSavedFolder) {
      return {
        filePath: toAbsolutePath(path.join(savedFolder, defaultName))
      };
    }
    const options = {
      title: "Save Cut Audio",
      defaultPath: hasSavedFolder ? path.join(savedFolder, defaultName) : defaultName,
      filters
    };
    const browserWindow = win ?? BrowserWindow.getFocusedWindow();
    const result = browserWindow ? await dialog.showSaveDialog(browserWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return { filePath: void 0 };
    }
    const selectedFolder = path.dirname(result.filePath);
    if (selectedFolder !== appSettings.defaultOutputFolder) {
      appSettings = {
        ...appSettings,
        defaultOutputFolder: selectedFolder
      };
      await saveSettings(appSettings).catch(() => void 0);
    }
    return { filePath: toAbsolutePath(result.filePath) };
  });
  ipcMain.handle("dialog:save-merge", async (_event, payload) => {
    const validated = validateSaveMergeDialogPayload(payload);
    const requestedDefaultName = validated.defaultName ?? "merged.wav";
    const filters = buildSaveMergeFilters();
    const defaultName = alignDefaultNameExtension(
      requestedDefaultName,
      filters
    );
    const savedFolder = appSettings.defaultOutputFolder;
    const hasSavedFolder = typeof savedFolder === "string" && savedFolder.length > 0 && await isExistingDirectory(savedFolder);
    if (!validated.forceDialog && hasSavedFolder) {
      return {
        filePath: toAbsolutePath(path.join(savedFolder, defaultName))
      };
    }
    const options = {
      title: "Save Merged Audio",
      defaultPath: hasSavedFolder ? path.join(savedFolder, defaultName) : defaultName,
      filters
    };
    const browserWindow = win ?? BrowserWindow.getFocusedWindow();
    const result = browserWindow ? await dialog.showSaveDialog(browserWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return { filePath: void 0 };
    }
    const selectedFolder = path.dirname(result.filePath);
    if (selectedFolder !== appSettings.defaultOutputFolder) {
      appSettings = {
        ...appSettings,
        defaultOutputFolder: selectedFolder
      };
      await saveSettings(appSettings).catch(() => void 0);
    }
    return { filePath: toAbsolutePath(result.filePath) };
  });
  ipcMain.handle("audio:cut", async (_event, payload) => {
    const params = validateCutPayload(payload);
    await ensureFile(params.inputPath);
    await ensureDirectoryExists(params.outputPath);
    const inputExt = getExtension(params.inputPath);
    const outputExt = getExtension(params.outputPath);
    if (PASSTHROUGH_EXTENSIONS.has(inputExt)) {
      if (params.mode !== "precise" && outputExt !== inputExt) {
        throw new Error(
          "Output extension must match input for MP3/M4A passthrough cuts."
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
      params.outputPath
    ];
    await runFfmpeg(ffmpegArgs);
    return { success: true, outputPath: params.outputPath };
  });
  ipcMain.handle("audio:merge", async (_event, payload) => {
    const params = validateMergePayload(payload);
    await ensureDirectoryExists(params.outputPath);
    await Promise.all(params.filePaths.map((filePath) => ensureFile(filePath)));
    const sourceExtensions = params.filePaths.map(
      (filePath) => getExtension(filePath)
    );
    const firstSourceExt = sourceExtensions[0];
    const outputExt = getExtension(params.outputPath);
    if (!MERGE_OUTPUT_EXTENSIONS.has(outputExt)) {
      throw new Error("Merge output must use .mp3, .m4a, .wav, or .flac.");
    }
    const allSameSourceExtension = sourceExtensions.every(
      (ext) => ext === firstSourceExt
    );
    let useStreamCopy = false;
    if (allSameSourceExtension && COPY_MERGE_EXTENSIONS.has(firstSourceExt)) {
      const streamInfo = await Promise.all(
        params.filePaths.map((filePath) => runFfprobe(filePath))
      );
      useStreamCopy = isStreamCompatibleForCopy(streamInfo);
    }
    if (useStreamCopy) {
      if (outputExt !== firstSourceExt) {
        throw new Error(
          "For stream-copy merge, output extension must match source files."
        );
      }
      const mergeListPath = path.join(
        tmpdir(),
        `audioslice-merge-${randomUUID()}.txt`
      );
      try {
        await writeFile(
          mergeListPath,
          buildConcatListContent(params.filePaths),
          {
            encoding: "utf8"
          }
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
          params.outputPath
        ]);
      } finally {
        await unlink(mergeListPath).catch(() => void 0);
      }
    } else {
      if (!LOSSLESS_OUTPUT_EXTENSIONS.has(outputExt)) {
        throw new Error("Mixed-format merges must be saved as .wav or .flac.");
      }
      const inputArgs = params.filePaths.flatMap((filePath) => [
        "-i",
        filePath
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
        params.outputPath
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
    icon: WINDOW_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(async () => {
  appSettings = await loadSettings();
  registerIpcHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
