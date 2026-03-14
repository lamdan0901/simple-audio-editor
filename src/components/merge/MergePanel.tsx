import { useRef } from "react";
import { FolderPlus, ListPlus, Loader2, Sparkles } from "lucide-react";

import { MergeItem, type MergeQueueItem } from "@/components/merge/MergeItem";
import { Button } from "@/components/ui/button";

type MergePanelProps = {
  items: MergeQueueItem[];
  isProcessing: boolean;
  onImportFiles: () => Promise<void>;
  onMergeAll: () => Promise<void>;
  onRemoveItem: (itemId: string) => void;
  onReorderItems: (sourceId: string, targetId: string) => void;
};

export function MergePanel({
  items,
  isProcessing,
  onImportFiles,
  onMergeAll,
  onRemoveItem,
  onReorderItems,
}: MergePanelProps) {
  const dragSourceIdRef = useRef<string | null>(null);

  const handleDragStart = (itemId: string) => {
    dragSourceIdRef.current = itemId;
  };

  const handleDrop = (targetId: string) => {
    const sourceId = dragSourceIdRef.current;
    dragSourceIdRef.current = null;

    if (!sourceId || sourceId === targetId) {
      return;
    }

    onReorderItems(sourceId, targetId);
  };

  const handleDragEnd = () => {
    dragSourceIdRef.current = null;
  };

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-300">
          <ListPlus className="size-4 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
            Merge Queue
          </h2>
        </div>
        <p className="text-xs text-zinc-400">{items.length} queued</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isProcessing}
          onClick={onImportFiles}
        >
          <FolderPlus className="size-3.5" />
          Import Files
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={isProcessing || items.length < 2}
          onClick={onMergeAll}
        >
          {isProcessing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {isProcessing ? "Merging..." : "Merge All"}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-4 text-sm text-zinc-400">
          Add clips from successful cuts or import external files.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <MergeItem
              key={item.id}
              item={item}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onRemove={onRemoveItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}
