import type { Clip } from "../../lib/types";
import { formatTimestamp } from "../../lib/clipUtils";
import { openPath, openUrl, revealInFinder } from "../../lib/api";

interface ClipDetailProps {
  clip: Clip | null;
  onStar: (id: string) => void;
  onCopy: (text: string) => void;
}

export default function ClipDetail({ clip, onStar, onCopy }: ClipDetailProps) {
  if (!clip) {
    return (
      <div className="flex flex-1 items-center justify-center border-l border-surface-border bg-surface p-8 text-sm text-white/30">
        Select a clip to view details
      </div>
    );
  }

  return (
    <div className="flex w-[420px] shrink-0 flex-col border-l border-surface-border bg-[#141414]">
      <div className="border-b border-surface-border p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{clip.source_name}</h2>
          <button
            type="button"
            onClick={() => onStar(clip.id)}
            className={`text-lg ${clip.starred ? "text-amber-400" : "text-white/25 hover:text-amber-400"}`}
            title={clip.starred ? "Unstar" : "Star"}
          >
            ★
          </button>
        </div>
        <p className="text-[11px] text-white/40">{formatTimestamp(clip.timestamp)}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/35">
            Captured Text
          </p>
          <pre className="whitespace-pre-wrap rounded-md border border-surface-border bg-surface p-3 font-mono text-xs leading-relaxed text-white/75">
            {clip.text}
          </pre>
        </section>

        <MetaRow label="Project" value={clip.project} />
        <MetaRow label="File" value={clip.file} />
        <MetaRow label="Source App" value={clip.source_app} />
        <MetaRow label="Source" value={clip.source_name} />
        {clip.window_title && <MetaRow label="Window" value={clip.window_title} />}
        {clip.url && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/35">
              URL
            </p>
            <button
              type="button"
              onClick={() => openUrl(clip.url!)}
              className="break-all text-left font-mono text-xs text-accent hover:underline"
            >
              {clip.url}
            </button>
          </div>
        )}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/35">
            Markdown Path
          </p>
          <p className="break-all font-mono text-[11px] text-white/50">
            {clip.markdown_path}
            {!clip.markdown_exists && (
              <span className="ml-2 text-amber-500/80">(missing)</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-surface-border p-4">
        <ActionBtn label="Copy" onClick={() => onCopy(clip.text)} />
        {clip.url && <ActionBtn label="Open URL" onClick={() => openUrl(clip.url!)} />}
        {clip.markdown_exists && (
          <ActionBtn label="Open MD" onClick={() => openPath(clip.markdown_path)} />
        )}
        <ActionBtn
          label="Reveal"
          onClick={() => revealInFinder(clip.markdown_path)}
        />
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/35">
        {label}
      </p>
      <p className="text-sm text-white/70">{value}</p>
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-surface-border px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {label}
    </button>
  );
}
