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
};

type MergeParams = {
  filePaths: string[];
  outputPath: string;
};

contextBridge.exposeInMainWorld("api", {
  checkFfmpeg: () => ipcRenderer.invoke("ffmpeg:check"),
  openAudioFile: () => ipcRenderer.invoke("dialog:open-audio"),
  saveAudioFile: (params: SaveAudioParams) =>
    ipcRenderer.invoke("dialog:save-audio", params),
  saveMergeFile: (defaultName: string) =>
    ipcRenderer.invoke("dialog:save-merge", { defaultName }),
  cutAudio: (params: CutParams) => ipcRenderer.invoke("audio:cut", params),
  mergeAudio: (params: MergeParams) =>
    ipcRenderer.invoke("audio:merge", params),
});
