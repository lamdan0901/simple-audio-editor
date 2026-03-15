import { ipcRenderer, contextBridge } from "electron";

type CutParams = {
  inputPath: string;
  startTime: number;
  endTime: number;
  outputPath: string;
  mode?: "copy" | "precise";
};

type SaveAudioParams = {
  defaultName: string;
  inputExtension?: string;
  mode?: "copy" | "precise";
  forceDialog?: boolean;
};

type SaveMergeParams = {
  defaultName: string;
  forceDialog?: boolean;
};

type MergeParams = {
  filePaths: string[];
  outputPath: string;
};

contextBridge.exposeInMainWorld("api", {
  checkFfmpeg: () => ipcRenderer.invoke("ffmpeg:check"),
  readAudioFile: (filePath: string) =>
    ipcRenderer.invoke("audio:read-file", filePath),
  openAudioFile: () => ipcRenderer.invoke("dialog:open-audio"),
  selectOutputFolder: () => ipcRenderer.invoke("dialog:select-output-folder"),
  getDefaultOutputFolder: () =>
    ipcRenderer.invoke("settings:get-default-output-folder"),
  setDefaultOutputFolder: (folderPath: string) =>
    ipcRenderer.invoke("settings:set-default-output-folder", folderPath),
  clearDefaultOutputFolder: () =>
    ipcRenderer.invoke("settings:clear-default-output-folder"),
  saveAudioFile: (params: SaveAudioParams) =>
    ipcRenderer.invoke("dialog:save-audio", params),
  saveMergeFile: (params: SaveMergeParams) =>
    ipcRenderer.invoke("dialog:save-merge", params),
  cutAudio: (params: CutParams) => ipcRenderer.invoke("audio:cut", params),
  mergeAudio: (params: MergeParams) =>
    ipcRenderer.invoke("audio:merge", params),
});
