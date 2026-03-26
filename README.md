# AudioEditor

A desktop audio cutter and merger application built with Electron + React, powered by FFmpeg for precise audio processing.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-windows-lightgrey)
![License](https://img.shields.io/badge/license-private-green)

## Features

- **Audio Cutting**: Extract segments from audio files with precise or copy mode
- **Batch Cutting**: Cut multiple regions at once from a single source file
- **Fade In/Out**: Apply smooth fade effects to cut regions with configurable duration
- **Audio Merging**: Combine multiple audio files into a single track
- **Waveform Visualization**: Interactive waveform display using wavesurfer.js
- **Region Management**: Create, select, and manage multiple cut regions
- **Smart Output Handling**: Automatic format detection and appropriate codec selection
- **Default Output Folder**: Configure a persistent output location for exported files

## Supported Formats

| Format | Extension | Cut Mode | Merge Support |
|--------|-----------|----------|---------------|
| MP3    | `.mp3`    | Copy, Precise | ✅ |
| M4A    | `.m4a`    | Copy, Precise | ✅ |
| WAV    | `.wav`    | Precise   | ✅ |
| FLAC   | `.flac`   | Precise   | ✅ |
| OGG    | `.ogg`    | Precise   | ✅ |
| AAC    | `.aac`    | Precise   | ✅ |
| Opus   | `.opus`   | Precise   | ✅ |

**Note**: MP3 and M4A files support fast "copy" mode for lossless cutting without re-encoding when using the same output format.

## Requirements

- **Windows** (primary target platform)
- **FFmpeg** must be installed and available on your system `PATH`
- Node.js 18+ (for development)

### Installing FFmpeg

1. Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add the `bin` folder to your system PATH
4. Verify installation: `ffmpeg -version`

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd audio-ffmpg

# Install dependencies
npm install

# Build the application
npm run build
```

### Pre-built Installers

Check the `release/` folder for platform-specific installers:
- **Windows**: `AudioEditor-Windows-<version>-Setup.exe`
- **macOS**: `AudioEditor-Mac-<version>-Installer.dmg`
- **Linux**: `AudioEditor-Linux-<version>.AppImage`

## Development

```bash
# Start Vite dev server (renderer process)
npm run dev

# Run ESLint
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
audio-ffmpg/
├── electron/           # Electron main process
│   ├── main.ts        # Main entry point, IPC handlers
│   ├── preload.ts     # Preload script (context bridge)
│   └── settings.ts    # Settings persistence
├── src/               # React renderer process
│   ├── components/    # UI components
│   │   ├── cut/       # Cut panel and controls
│   │   ├── merge/     # Merge queue and items
│   │   ├── regions/   # Region list and management
│   │   ├── waveform/  # Waveform player and controls
│   │   ├── layout/    # Layout components (TopBar, etc.)
│   │   └── ui/        # Base UI components (buttons, etc.)
│   ├── hooks/         # React hooks
│   │   └── useWaveSurfer.ts  # Waveform integration
│   ├── lib/           # Utility libraries
│   ├── assets/        # Static assets
│   ├── App.tsx        # Main application component
│   └── main.tsx       # React entry point
├── public/            # Public static assets
├── resources/         # Electron resources (icons, etc.)
├── dist/              # Renderer build output
├── dist-electron/     # Electron build output
└── release/           # Final packaged installers
```

## Usage Guide

### Audio Cutter

1. **Load Audio**: Click "Select Audio File" to load an audio file
2. **Create Regions**: Click and drag on the waveform to select regions
3. **Configure Settings**:
   - Toggle **Precise Mode** for re-encoded cuts (required for format conversion)
   - Enable **Fade In/Out** with customizable duration (0.1s - 30s)
4. **Cut & Save**:
   - Single region: Saves directly to output folder
   - Multiple regions: Batch cuts with sequential naming
   - Use "Cut (Save As...)" to choose a custom location

### Audio Merger

1. **Switch to Merger Tab**: Click the "Merger" tab
2. **Add Files**:
   - Import files directly using "Add Files"
   - Add recent cut results using "Add Last Cut"
3. **Reorder**: Drag and drop items to change merge order
4. **Remove Items**: Click the remove button on any item
5. **Merge**: Click "Merge" (uses default folder) or "Merge As..." (custom location)

### Output Folder Settings

- **Set Default Folder**: Configure a persistent output location
- **Auto-save**: Files save directly to default folder without dialogs
- **Clear Folder**: Reset to show save dialogs

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause playback |
| `Delete` | Remove selected region |

## Technical Details

### Cut Modes

- **Copy Mode**: Fast, lossless cutting without re-encoding (MP3/M4A only, same format output)
- **Precise Mode**: Accurate cuts with re-encoding (required for fade effects, format conversion, or non-MP3/M4A sources)

### Fade Processing

Fade effects automatically switch to precise mode and apply:
- Configurable fade duration (default: 2 seconds)
- Automatic duration clamping based on region length
- Smooth logarithmic fade curves

### Merge Processing

- **Same-format merges**: Uses FFmpeg concat demuxer for efficiency
- **Mixed-format merges**: Normalizes all inputs to 48kHz stereo before merging
- **Output formats**: MP3, M4A, WAV, or FLAC

### IPC Architecture

The application uses Electron IPC for secure communication between renderer and main processes:

```typescript
// Renderer → Main communication
window.api.cutAudio(params)
window.api.mergeAudio(params)
window.api.saveAudioFile(params)
window.api.openAudioFile()
// ... etc
```

## Configuration

### FFmpeg Integration

The main process (`electron/main.ts`) invokes FFmpeg commands for all audio processing. Ensure FFmpeg is properly installed and accessible via the system PATH.

### Settings Storage

Application settings are stored in Electron's user data directory:
- **Location**: `%APPDATA%\AudioEditor\settings.json` (Windows)
- **Settings**: Default output folder path

## Build Configuration

### Electron Builder

See `electron-builder.json5` for packaging configuration:
- **App ID**: `com.audioslice.app`
- **Output**: `release/` folder
- **Windows Target**: NSIS installer (x64)
- **macOS Target**: DMG
- **Linux Target**: AppImage

### Vite Configuration

See `vite.config.ts` for build configuration:
- React plugin for JSX transformation
- Tailwind CSS v4 integration
- Electron main/preload bundling
- Path alias: `@/` → `src/`

### TypeScript

Strict TypeScript configuration with:
- ES2020 target
- Module resolution: bundler
- Strict null checks enabled

## Troubleshooting

### FFmpeg Not Found

**Error**: "FFmpeg not found in PATH"

**Solution**:
1. Verify FFmpeg installation: `ffmpeg -version`
2. Add FFmpeg `bin` folder to system PATH
3. Restart the application

### Waveform Loading Issues

**Error**: "Waveform is still loading" after 8 seconds

**Solution**:
- Try a different file format (WAV or MP3 recommended)
- Check file integrity
- Report the specific file type if the issue persists

### Cut/Merge Failures

**Common causes**:
- Unsupported output format
- Invalid region duration (< 0.05 seconds)
- Source file is corrupted
- Output folder does not exist

## Limitations

- **Windows-only**: Primary development and testing platform
- **No real-time preview**: Fade effects applied during export only
- **Single audio track**: Multi-track editing not supported
- **No effects processing**: Limited to cutting, merging, and fades

## Dependencies

### Core
- **Electron** 30.0.1 - Desktop application framework
- **React** 18.2.0 - UI library
- **TypeScript** 5.2.2 - Type safety
- **Vite** 5.1.6 - Build tool

### UI & Styling
- **Tailwind CSS** 4.2.1 - Utility-first CSS
- **Base UI** 1.3.0 - Unstyled UI components
- **Lucide React** 0.577.0 - Icon library
- **Fontsource Variable Geist** 5.2.8 - Typography

### Audio Processing
- **wavesurfer.js** 7.12.2 - Waveform visualization
- **FFmpeg** (system dependency) - Audio processing backend

### Utilities
- **Sonner** 2.0.7 - Toast notifications
- **Class Variance Authority** 0.7.1 - Component variants
- **clsx** 2.1.1 - Conditional class names
- **tailwind-merge** 3.5.0 - Tailwind class merging

## Contributing

This is a private project. For internal development:

1. Follow the existing code style (2-space indentation, semicolons, trailing commas)
2. Run `npm run lint` before committing
3. Use TypeScript strictly (no `any` types)
4. Follow React best practices (function components, hooks)
5. Name constants in UPPER_CASE for IPC event names

## License

Private - All rights reserved

## Acknowledgments

- Built with [Electron Vite template](https://github.com/electron-vite/electron-vite-react)
- Icons by [Lucide](https://lucide.dev/)
- Font by [Fontsource](https://fontsource.org/)
