/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  api: {
    checkFfmpeg: () => Promise<{ available: boolean; version: string }>;
    openAudioFile: () => Promise<{ filePaths: string[] }>;
    saveAudioFile: (params: {
      defaultName: string;
      inputExtension?: string;
      mode?: "copy" | "precise";
    }) => Promise<{ filePath?: string }>;
    saveMergeFile: (defaultName: string) => Promise<{ filePath?: string }>;
    cutAudio: (params: {
      inputPath: string;
      startTime: number;
      endTime: number;
      outputPath: string;
      mode?: "copy" | "precise";
    }) => Promise<{ success: boolean; outputPath?: string }>;
    mergeAudio: (params: {
      filePaths: string[];
      outputPath: string;
    }) => Promise<{ success: boolean; outputPath?: string }>;
  };
}
