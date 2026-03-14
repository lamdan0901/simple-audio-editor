# AudioSlice — Implementation Plan

## 0. Decisions & Constraints

| Topic             | Decision                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio formats     | All FFmpeg-supported input formats (MP3, WAV, FLAC, OGG, AAC, M4A, WMA, AIFF, etc.)                                                                                               |
| Output format     | **Default mode:** passthrough for MP3/M4A (`-c copy`) and lossless `.wav`/`.flac` for other inputs. **Optional precise mode:** re-encode selected range for sample-accurate cuts. |
| Regions           | Multiple draggable regions on a single waveform; each can be cut independently                                                                                                    |
| Merge sources     | Clips cut within the app **+** external file imports                                                                                                                              |
| Merge strategy    | If queued clips are stream-compatible, use concat demuxer + `-c copy`; otherwise use `filter_complex concat` and re-encode to WAV/FLAC.                                           |
| Packaging         | electron-builder → Windows installer (NSIS)                                                                                                                                       |
| Persistence       | Stateless — no saved settings between sessions                                                                                                                                    |
| Styling           | Tailwind CSS + shadcn/ui (Radix primitives)                                                                                                                                       |
| Bundler           | electron-vite (Vite for both main & renderer)                                                                                                                                     |
| FFmpeg invocation | User's system-installed FFmpeg via `child_process.execFile`                                                                                                                       |

---

## 1. Project Scaffolding

### 1.1 Initialize with electron-vite

```
npm create @electron-vite@latest . -- --template react-ts
```

This generates the scaffold directly in the current workspace root:

```
./
├── electron.vite.config.ts      # Vite config for main + preload + renderer
├── src/
│   ├── main/                    # Electron main process
│   │   └── index.ts
│   ├── preload/                 # Context bridge (IPC exposure)
│   │   └── index.ts
│   └── renderer/                # React app
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── ...
│       └── index.html
├── resources/                   # App icon, static assets
├── package.json
└── tsconfig.*.json
```

### 1.2 Install core dependencies

**Production:**

```
npm i wavesurfer.js
```

**Dev:**

```
npm i -D tailwindcss @tailwindcss/vite
npm i -D electron-builder
```

### 1.3 shadcn/ui setup

```
npx shadcn@latest init
```

Components to add incrementally:

- `button`, `dialog`, `toast` / `sonner`, `scroll-area`, `card`, `badge`, `tooltip`, `separator`, `dropdown-menu`

### 1.4 Tailwind config

Standard Tailwind v4 setup via `@tailwindcss/vite` plugin in the renderer Vite config. Dark theme as default (Electron apps look better dark).

---

## 2. Main Process (src/main/)

### 2.1 File structure

```
src/main/
├── index.ts              # App lifecycle, window creation
├── ipc/
│   ├── ffmpeg.ts         # FFmpeg check, cut, merge handlers
│   └── dialog.ts         # Open/save file dialogs
└── utils/
    └── ffmpeg.ts          # Command builders & execution helpers
```

### 2.2 IPC Channels

| Channel             | Direction                  | Payload                                                                           | Purpose                           |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| `ffmpeg:check`      | renderer → main → renderer | — / `{ available: boolean, version: string }`                                     | Startup FFmpeg check              |
| `dialog:open-audio` | renderer → main → renderer | — / `{ filePaths: string[] }`                                                     | Native open file dialog           |
| `dialog:save-audio` | renderer → main → renderer | `{ defaultName: string }` / `{ filePath: string }`                                | Native save dialog (cut output)   |
| `dialog:save-merge` | renderer → main → renderer | `{ defaultName: string }` / `{ filePath: string }`                                | Native save dialog (merge output) |
| `audio:cut`         | renderer → main → renderer | `{ inputPath, startTime, endTime, outputPath, mode }` / `{ success, outputPath }` | Execute FFmpeg cut                |
| `audio:merge`       | renderer → main → renderer | `{ filePaths: string[], outputPath: string }` / `{ success, outputPath }`         | Execute FFmpeg merge              |

All IPC uses `ipcMain.handle` / `ipcRenderer.invoke` (promise-based).

### 2.3 FFmpeg Command Details

**Check:**

```ts
execFile("ffmpeg", ["-version"]);
```

**Cut — format-aware output:**

The output strategy depends on the input format:

| Input format | Output                         | FFmpeg flags                   | Rationale                          |
| ------------ | ------------------------------ | ------------------------------ | ---------------------------------- |
| `.mp3`       | `.mp3`                         | `-c copy`                      | Keep original format, near-instant |
| `.m4a`       | `.m4a`                         | `-c copy`                      | Keep original format, near-instant |
| All others   | `.wav` or `.flac` (user picks) | `-c:a pcm_s16le` / `-c:a flac` | Lossless re-encode for accuracy    |

```bash
# MP3 / M4A input → stream copy (keep format)
ffmpeg -ss 12.500 -to 45.000 -i "input.mp3" -c copy "output.mp3"
ffmpeg -ss 12.500 -to 45.000 -i "input.m4a" -c copy "output.m4a"

# Other inputs → lossless re-encode
ffmpeg -ss 12.500 -to 45.000 -i "input.ogg" -c:a pcm_s16le "output.wav"
ffmpeg -ss 12.500 -to 45.000 -i "input.aiff" -c:a flac "output.flac"
```

- MP3/M4A use `-c copy` (stream copy) — extremely fast, keeps original format.
- All other formats re-encode to lossless to guarantee quality.
- Optional "Precise cut" mode can force re-encode for MP3/M4A to avoid packet-boundary trim behavior.

**Merge:**

1. Write temp `merge_list.txt` to `os.tmpdir()`:
   ```
   file 'C:\path\to\clip1.mp3'
   file 'C:\path\to\clip2.mp3'
   ```
2. Execute — format-aware:

   ```bash
   # If all inputs share the same format (e.g. all .mp3) → stream copy
   ffmpeg -f concat -safe 0 -i "merge_list.txt" -c copy "merged.mp3"

   # If mixed formats/codecs/sample rates → use filter graph concat and re-encode
   ffmpeg -i "clip1.wav" -i "clip2.mp3" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[outa]" -map "[outa]" -c:a pcm_s16le "merged.wav"
   ```

3. Delete `merge_list.txt` in `finally` block.

- When all queued files are the same MP3/M4A format, use `-c copy` to preserve the original format.
- When formats are mixed, use filter-based concat and re-encode everything to a common lossless format (WAV/FLAC).
- For concat list files, escape single quotes in paths (`'` → `'\''`) and write UTF-8 text.
- Preflight with `ffprobe` to determine codec/channel/sample-rate compatibility before selecting merge path.

**Security:** Use `execFile` (not `exec`) to prevent shell injection. Validate all file paths. Sanitize input — never interpolate user strings into a shell command.

### 2.5 Validation Rules (Main Process)

- `audio:cut`
  - `inputPath` exists and is a file.
  - `startTime >= 0`, `endTime > startTime`, and duration `>= 0.05s`.
  - `outputPath` directory exists and extension is allowed for selected mode.
- `audio:merge`
  - At least 2 files in queue.
  - Every path exists and is a file.
  - No duplicate paths after normalization.
  - Output extension matches selected merge mode (copy or re-encode).
- Dialog validation
  - Reject empty/canceled paths.
  - Normalize to absolute paths before execution.

### 2.4 Window configuration

- Default size: 1200×800, min 900×600
- `webPreferences.contextIsolation = true`
- `webPreferences.nodeIntegration = false`
- Load preload script

---

## 3. Preload Script (src/preload/)

### 3.1 Context Bridge API

```ts
// Exposed as window.api
contextBridge.exposeInMainWorld("api", {
  // FFmpeg
  checkFfmpeg: () => ipcRenderer.invoke("ffmpeg:check"),

  // Dialogs
  openAudioFile: () => ipcRenderer.invoke("dialog:open-audio"),
  saveAudioFile: (defaultName: string) =>
    ipcRenderer.invoke("dialog:save-audio", { defaultName }),
  saveMergeFile: (defaultName: string) =>
    ipcRenderer.invoke("dialog:save-merge", { defaultName }),

  // Audio operations
  cutAudio: (params: CutParams) => ipcRenderer.invoke("audio:cut", params),
  mergeAudio: (params: MergeParams) =>
    ipcRenderer.invoke("audio:merge", params),
});
```

### 3.2 Type declarations

```ts
// src/preload/types.d.ts — augment Window
interface CutParams {
  inputPath: string;
  startTime: number; // seconds
  endTime: number; // seconds
  outputPath: string;
  mode?: "copy" | "precise";
}

interface MergeParams {
  filePaths: string[];
  outputPath: string;
}
```

---

## 4. Renderer / React UI (src/renderer/)

### 4.1 File structure

```
src/renderer/src/
├── App.tsx
├── main.tsx
├── index.css                 # Tailwind directives
├── components/
│   ├── layout/
│   │   └── TopBar.tsx        # File selection button, app title
│   ├── waveform/
│   │   ├── WaveformPlayer.tsx   # wavesurfer.js instance + regions
│   │   └── TransportControls.tsx # Play, Pause, Stop buttons
│   ├── regions/
│   │   └── RegionList.tsx       # List of active regions with timestamps
│   ├── cut/
│   │   └── CutPanel.tsx         # Shows selected region info + "Cut" button
│   ├── merge/
│   │   ├── MergePanel.tsx       # Merge queue + "Merge All" button
│   │   └── MergeItem.tsx        # Single file in merge queue (draggable)
│   └── ui/                      # shadcn components (auto-generated)
├── hooks/
│   ├── useWaveSurfer.ts         # Init & destroy wavesurfer instance
│   └── useFfmpeg.ts             # Wraps IPC calls for cut/merge
├── lib/
│   └── utils.ts                 # cn(), time formatters
└── types/
    └── index.ts                 # Shared UI types
```

### 4.2 Component Tree

```
App
├── FfmpegGuard                 # Blocks UI if FFmpeg not found
│   ├── TopBar                  # [Select Audio File]
│   ├── MainCanvas
│   │   ├── WaveformPlayer      # wavesurfer.js + regions plugin
│   │   └── TransportControls   # Play | Pause | Stop
│   └── BottomPanel
│       ├── RegionList          # All regions with start/end times
│       ├── CutPanel            # Cut selected region
│       └── MergePanel          # Merge queue
│           └── MergeItem[]     # Draggable merge items
```

### 4.3 State Management

Plain React state + `useReducer` — no external state library needed at this scale.

**Key state:**

```ts
// App-level
const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
const [regions, setRegions] = useState<Region[]>([]);
const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
const [mergeQueue, setMergeQueue] = useState<MergeItem[]>([]);
const [isProcessing, setIsProcessing] = useState(false);

// Region type
interface Region {
  id: string;
  start: number; // seconds
  end: number; // seconds
  color: string;
}

// MergeItem type
interface MergeItem {
  id: string;
  filePath: string;
  fileName: string;
  source: "cut" | "import"; // tracks origin
}
```

### 4.4 wavesurfer.js Integration

```ts
// useWaveSurfer.ts — core hook
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

// Init in useEffect with ref to container div
// Enable multiple region creation
// Listen to region-created, region-updated, region-removed events
// Sync region data ↔ React state
```

**Region interactions:**

- Click waveform to create region (default 5-second span)
- Drag edges to resize
- Click region to select it (highlights in RegionList)
- Double-click region to play just that region
- Right-click or delete button to remove

### 4.5 Key UI Flows

**Cut flow:**

1. User selects a region (click on waveform region or RegionList item)
2. CutPanel shows: `Start: 00:12.500 | End: 00:45.000 | Duration: 32.500s`
3. User clicks "Cut & Save"
4. Save dialog opens:

- MP3/M4A source: default keep source extension (optional precise re-encode mode if enabled)
- Other sources: user picks `.wav` or `.flac`

5. IPC call → FFmpeg processes → Toast notification on success
6. Option to "Add to merge queue" appears on success

**Merge flow:**

1. User adds files to merge queue via:
   - "Add to merge" after a successful cut
   - "Import files" button in MergePanel (opens file picker)
2. Drag-and-drop reordering in the queue
3. Click "Merge All" → save dialog → IPC → FFmpeg concat → toast

---

## 5. Implementation Phases

### Progress Tracking Rule

- After implementing and verifying any checklist item in this plan, immediately update its checkbox from `[ ]` to `[x]` in the same working session.
- If implementation is partial or unverified, keep the item unchecked and add a short note in the relevant phase section.

### Phase 1: Skeleton & FFmpeg Check

- [x] Scaffold project with electron-vite (react-ts template)
- [x] Configure Tailwind CSS + shadcn/ui
- [x] Set up main process with window creation
- [x] Implement preload context bridge (empty stubs)
- [x] Implement `ffmpeg:check` IPC handler
- [x] Build `FfmpegGuard` component (blocks UI if FFmpeg missing)
- [x] Verify dev workflow: `npm run dev` launches Electron with React HMR

### Phase 2: Audio Loading & Waveform

- [ ] Implement `dialog:open-audio` IPC handler (native file picker, filter by audio extensions)
- [ ] Build `TopBar` with "Select Audio File" button
- [ ] Create `useWaveSurfer` hook — init wavesurfer.js on a container ref
- [ ] Build `WaveformPlayer` component — render waveform from selected file
- [ ] Build `TransportControls` — Play / Pause / Stop
- [ ] Style waveform container + controls with Tailwind

### Phase 3: Regions & Cutting

- [ ] Enable Regions plugin in wavesurfer.js
- [ ] Implement multi-region creation, resize, delete
- [ ] Build `RegionList` — display all regions with formatted timestamps
- [ ] Build `CutPanel` — show selected region details + "Cut & Save" button
- [ ] Implement `dialog:save-audio` IPC handler
- [ ] Implement `audio:cut` IPC handler (default passthrough for MP3/M4A + precise mode toggle)
- [ ] Wire up full cut flow: select region → cut → save → toast notification
- [ ] Add "Add to merge queue" action on successful cut

### Phase 4: Merge

- [ ] Build `MergePanel` with file queue list
- [ ] Add "Import files" button to queue external audio files
- [ ] Implement drag-and-drop reordering in merge queue
- [ ] Build `MergeItem` component (file name, remove button, drag handle)
- [ ] Implement `dialog:save-merge` IPC handler
- [ ] Implement `audio:merge` IPC handler (compatibility preflight → concat demuxer copy or filter-concat re-encode)
- [ ] Wire up merge flow end-to-end with toast notifications

### Phase 5: Polish & Packaging

- [ ] Error handling: FFmpeg failures surface as user-friendly toasts
- [ ] Loading states: disable buttons + show spinner during processing
- [ ] Edge cases: empty regions, 0-duration selections, duplicate merge items
- [ ] Main-process payload validation rules enforced for all IPC write operations
- [ ] Keyboard shortcuts: Space = play/pause, Delete = remove selected region
- [ ] Configure electron-builder for Windows (NSIS installer)
- [ ] App icon + metadata (name, version, description)
- [ ] Build & test installer: `npm run build`
- [ ] Final smoke test on clean Windows machine

---

## 6. Packaging Configuration

```jsonc
// package.json electron-builder config
{
  "build": {
    "appId": "com.audioslice.app",
    "productName": "AudioSlice",
    "directories": {
      "output": "release",
    },
    "win": {
      "target": ["nsis"],
      "icon": "resources/icon.ico",
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
    },
  },
}
```

---

## 7. File / Folder Conventions

| Convention        | Rule                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| Components        | PascalCase, one component per file                                         |
| Hooks             | `use` prefix, camelCase                                                    |
| IPC channels      | `namespace:action` (e.g. `audio:cut`)                                      |
| Types             | Co-located `types.ts` or inline, shared types in `src/renderer/src/types/` |
| shadcn components | Auto-generated in `src/renderer/src/components/ui/`                        |

---

## 8. Key Dependencies

| Package               | Purpose                          | Version guidance |
| --------------------- | -------------------------------- | ---------------- |
| `electron`            | Desktop shell                    | latest stable    |
| `electron-vite`       | Vite-based Electron build tool   | latest           |
| `react` + `react-dom` | UI framework                     | 19.x             |
| `typescript`          | Type safety                      | 5.x              |
| `wavesurfer.js`       | Waveform rendering + regions     | 7.x              |
| `tailwindcss`         | Utility-first CSS                | 4.x              |
| `@tailwindcss/vite`   | Tailwind Vite plugin             | latest           |
| `shadcn/ui`           | Radix-based component primitives | latest           |
| `electron-builder`    | Windows installer packaging      | latest           |
| `sonner`              | Toast notifications              | latest           |

---

## 9. Security Checklist

- [ ] `contextIsolation: true` in webPreferences
- [ ] `nodeIntegration: false` in webPreferences
- [ ] All FFmpeg calls via `execFile` (no shell interpolation)
- [ ] File paths validated before passing to FFmpeg
- [ ] Temp files created in `os.tmpdir()` and cleaned up in `finally`
- [ ] No remote content loaded — all local
- [ ] IPC channels use `handle`/`invoke` pattern (not `send`/`on` for sensitive ops)
