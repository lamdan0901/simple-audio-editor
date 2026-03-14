import { ipcRenderer, contextBridge } from 'electron'

type CutParams = {
  inputPath: string
  startTime: number
  endTime: number
  outputPath: string
  mode?: 'copy' | 'precise'
}

type MergeParams = {
  filePaths: string[]
  outputPath: string
}

contextBridge.exposeInMainWorld('api', {
  checkFfmpeg: () => ipcRenderer.invoke('ffmpeg:check'),
  openAudioFile: () => ipcRenderer.invoke('dialog:open-audio'),
  saveAudioFile: (defaultName: string) =>
    ipcRenderer.invoke('dialog:save-audio', { defaultName }),
  saveMergeFile: (defaultName: string) =>
    ipcRenderer.invoke('dialog:save-merge', { defaultName }),
  cutAudio: (params: CutParams) => ipcRenderer.invoke('audio:cut', params),
  mergeAudio: (params: MergeParams) => ipcRenderer.invoke('audio:merge', params),
})
