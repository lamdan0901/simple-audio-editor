"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  checkFfmpeg: () => electron.ipcRenderer.invoke("ffmpeg:check"),
  readAudioFile: (filePath) => electron.ipcRenderer.invoke("audio:read-file", filePath),
  openAudioFile: () => electron.ipcRenderer.invoke("dialog:open-audio"),
  selectOutputFolder: () => electron.ipcRenderer.invoke("dialog:select-output-folder"),
  getDefaultOutputFolder: () => electron.ipcRenderer.invoke("settings:get-default-output-folder"),
  setDefaultOutputFolder: (folderPath) => electron.ipcRenderer.invoke("settings:set-default-output-folder", folderPath),
  clearDefaultOutputFolder: () => electron.ipcRenderer.invoke("settings:clear-default-output-folder"),
  saveAudioFile: (params) => electron.ipcRenderer.invoke("dialog:save-audio", params),
  saveMergeFile: (params) => electron.ipcRenderer.invoke("dialog:save-merge", params),
  cutAudio: (params) => electron.ipcRenderer.invoke("audio:cut", params),
  mergeAudio: (params) => electron.ipcRenderer.invoke("audio:merge", params)
});
