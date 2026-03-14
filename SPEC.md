# Technical Specification: Audio App (Working Title: AudioSlice)

## 1. Project Overview

A lightweight Windows desktop application that allows users to import local audio files, visualize them as waveforms, select specific regions to cut, and merge multiple audio clips together. The application relies on the user's system-installed FFmpeg for audio processing.

## 2. Tech Stack

- **Operating System:** Windows
- **Desktop Framework:** Electron (Node.js backend + Chromium frontend)
- **Frontend UI Framework:** React
- **Language:** TypeScript (for type-safe IPC communication, UI props, and FFmpeg arguments)
- **Audio Visualization:** `wavesurfer.js` (using the **Regions plugin** for visual, draggable time selection)
- **Process Execution:** Node.js native `child_process` (`exec` or `spawn` to run FFmpeg)

## 3. Core Architecture

Due to Electron's security model, terminal commands cannot (and should not) be run directly from the frontend. The app uses a two-process architecture:

- **Renderer Process (React UI):** \* Handles file selection and renders `wavesurfer.js`.
  - Manages audio playback state (play/pause).
  - Captures the exact `startTime` and `endTime` from the user's visual selection.
  - Sends requests to the backend via Electron's `contextBridge` (IPC).
- **Main Process (Node.js Backend):** \* Listens for IPC events from the React frontend.
  - Checks for FFmpeg installation.
  - Executes the FFmpeg commands using Node's `child_process`.
  - Handles file system operations (like generating temporary text files for merging) via the `fs` module.
  - Sends success, progress, or error messages back to the React UI.

## 4. User Interface Layout

- **Top Bar:** \* "Select Audio File" button (triggers native OS file picker).
- **Main Canvas (Center):**
  - The `wavesurfer.js` visual waveform.
  - Draggable "Region" overlays to visually highlight the cut area.
  - Transport controls: Play, Pause, Stop.
- **Sidebar / Bottom Panel (Clip Manager):**
  - **Cut Section:** Displays current selection timestamps (e.g., `Start: 00:12.500 | End: 00:45.000`) and a "Cut & Save" button.
  - **Merge Section:** A dropzone/list where users can queue previously cut files to stitch them together, and a "Merge All" button.

## 5. FFmpeg Command Specification

### A. Initialization Check

Before enabling the UI, the main process must verify FFmpeg is available in the system PATH.

- **Command:** `ffmpeg -version`
- **Behavior:** If it fails, the UI displays a "Please install FFmpeg and add it to your system PATH" error screen.

### B. Cutting Audio

Triggered when the user clicks "Cut & Save".

- **Command:** `ffmpeg -i "input_path.mp3" -ss [START_TIME] -to [END_TIME] -c copy "output_path.mp3"`
- **Note:** The `-c copy` flag copies the stream without re-encoding, which is extremely fast but snaps to the nearest keyframe. For frame-perfect cuts (at the cost of processing time), omit `-c copy`.

### C. Merging Audio

FFmpeg requires a text file to merge files cleanly using the `concat` demuxer. The Node backend must dynamically generate this file.

- **Step 1:** Generate a temporary text file (`merge_list.txt`) formatted as follows:
  ```text
  file 'C:\absolute\path\to\clip1.mp3'
  file 'C:\absolute\path\to\clip2.mp3'
  ```

* **Step 2:** Execute the merge command.
* **Command:** `ffmpeg -f concat -safe 0 -i "merge_list.txt" -c copy "merged_output.mp3"`

* **Step 3:** Clean up (delete) `merge_list.txt`.

## 6. App Workflow / State Machine

1. **Init:** App launches -> Main process runs `ffmpeg -version` -> Signals React UI to render.
2. **Load:** User selects an audio file -> Path is passed to `wavesurfer.js` -> Waveform renders.
3. **Select:** User drags sliders on the waveform -> React state updates with `startTime` and `endTime` (in seconds).
4. **Execute Cut:** User clicks "Cut" -> Native Save Dialog asks for destination -> React sends IPC message to Main process -> FFmpeg cuts file -> UI shows "Success" notification.
5. **Execute Merge:** User queues multiple files in the Merge panel -> Clicks "Merge" -> Main process creates `merge_list.txt` in an OS temp folder -> Executes FFmpeg concat -> Deletes temp file -> UI shows "Success" notification.
