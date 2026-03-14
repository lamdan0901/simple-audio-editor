import { Music2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

type TopBarProps = {
  statusText: string;
  audioFilePath: string | null;
  selectError: string | null;
  isSelecting: boolean;
  onSelectAudio: () => Promise<void>;
};

function getFileName(filePath: string | null): string {
  if (!filePath) {
    return "No file loaded";
  }

  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

export function TopBar({
  statusText,
  audioFilePath,
  selectError,
  isSelecting,
  onSelectAudio,
}: TopBarProps) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">
          AudioSlice
        </p>
        <div className="flex items-center gap-2 text-zinc-100">
          <Music2 className="size-4 text-emerald-400" />
          <h1 className="text-xl font-semibold">Waveform Workspace</h1>
        </div>
        <p className="text-sm text-zinc-400">{statusText}</p>
      </div>

      <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
        <Button
          size="lg"
          className="w-full md:w-auto"
          disabled={isSelecting}
          onClick={onSelectAudio}
        >
          <Upload className="size-4" />
          {isSelecting ? "Opening..." : "Select Audio File"}
        </Button>

        <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300 md:max-w-sm">
          <p className="truncate" title={audioFilePath ?? ""}>
            {getFileName(audioFilePath)}
          </p>
        </div>

        {selectError ? (
          <p className="w-full text-xs text-red-300 md:max-w-sm">
            {selectError}
          </p>
        ) : null}
      </div>
    </header>
  );
}
