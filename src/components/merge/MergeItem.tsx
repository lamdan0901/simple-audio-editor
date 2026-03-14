import type { DragEvent } from "react";
import { FileAudio, GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type MergeQueueItem = {
  id: string;
  filePath: string;
  source: "cut" | "import";
};

type MergeItemProps = {
  item: MergeQueueItem;
  index: number;
  onDragStart: (itemId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  onRemove: (itemId: string) => void;
};

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? filePath;
}

export function MergeItem({
  item,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
}: MergeItemProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(item.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(item.id)}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
    >
      <GripVertical className="size-4 shrink-0 text-zinc-500" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-200" title={item.filePath}>
          {getFileName(item.filePath)}
        </p>
        <p className="text-xs text-zinc-500">
          #{index + 1} • {item.source === "cut" ? "From cut" : "Imported"}
        </p>
      </div>

      <FileAudio className="size-4 shrink-0 text-zinc-400" />

      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        onClick={() => onRemove(item.id)}
        aria-label="Remove merge item"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
