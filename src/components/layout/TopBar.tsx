import { Folder, FolderCog, Music2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type TopBarProps = {
  statusText: string;
  defaultOutputFolder: string | null;
  isUpdatingOutputFolder: boolean;
  onPickOutputFolder: () => Promise<void>;
  onClearOutputFolder: () => Promise<void>;
};

function getFolderLabel(folderPath: string | null): string {
  if (!folderPath) {
    return "Not set";
  }

  const normalized = folderPath.replace(/\\/g, "/");
  return normalized.split("/").pop() || folderPath;
}

export function TopBar({
  statusText,
  defaultOutputFolder,
  isUpdatingOutputFolder,
  onPickOutputFolder,
  onClearOutputFolder,
}: TopBarProps) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">
          AudioEditor
        </p>
        <div className="flex items-center gap-2 text-zinc-100">
          <Music2 className="size-4 text-emerald-400" />
          <h1 className="text-xl font-semibold">Waveform Workspace</h1>
        </div>
        <p className="text-xs text-zinc-400">{statusText}</p>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 md:min-w-80">
        <div className="flex items-center gap-2 text-zinc-300">
          <FolderCog className="size-4 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em]">
            Output Folder
          </h2>
        </div>

        <p
          className="mt-2 truncate text-sm text-zinc-200"
          title={defaultOutputFolder ?? ""}
        >
          {defaultOutputFolder
            ? `Default: ${getFolderLabel(defaultOutputFolder)}`
            : "Default: Not set"}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isUpdatingOutputFolder}
            onClick={onPickOutputFolder}
          >
            <Folder className="size-3.5" />
            {defaultOutputFolder ? "Change Folder" : "Set Folder"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isUpdatingOutputFolder || !defaultOutputFolder}
            onClick={onClearOutputFolder}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        </div>
      </section>
    </header>
  );
}
