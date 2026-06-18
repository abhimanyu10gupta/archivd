import type { Clip } from "../../lib/types";
import { formatTimestamp, previewText, urlDomain } from "../../lib/clipUtils";

interface ClipCardProps {
  clip: Clip;
  selected: boolean;
  onSelect: () => void;
  onStar: () => void;
  onCopy: () => void;
}

export default function ClipCard({
  clip,
  selected,
  onSelect,
  onStar,
  onCopy,
}: ClipCardProps) {
  const domain = urlDomain(clip.url);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group cursor-pointer rounded-lg border p-3 transition ${
        selected
          ? "border-accent/60 bg-accent/10"
          : "border-surface-border bg-surface-raised hover:border-white/15"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white/90">
              {clip.source_name}
            </span>
            {clip.starred && <span className="text-amber-400">★</span>}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-white/40">
            {clip.project} / {clip.file}
            {domain ? ` · ${domain}` : ""}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-white/30">
          {formatTimestamp(clip.timestamp)}
        </span>
      </div>

      <p className="line-clamp-2 font-mono text-xs leading-relaxed text-white/60">
        {previewText(clip.text, 160)}
      </p>

      <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          className="rounded px-2 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
        >
          {clip.starred ? "Unstar" : "Star"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="rounded px-2 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
