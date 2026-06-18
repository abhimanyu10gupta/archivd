import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { loadClips, toggleStar } from "../../lib/api";
import type { Clip, ClipFilters, DateFilter, NavView } from "../../lib/types";
import {
  buildFileSummaries,
  buildProjectSummaries,
  buildSourceSummaries,
  filterClips,
  formatTimestamp,
  recentClips,
  uniqueValues,
} from "../../lib/clipUtils";
import Sidebar from "./Sidebar";
import ClipCard from "./ClipCard";
import ClipDetail from "./ClipDetail";
import SettingsPanel from "./SettingsPanel";

const DEFAULT_FILTERS: ClipFilters = {
  search: "",
  project: "",
  source: "",
  file: "",
  dateRange: "all",
  starredOnly: false,
};

export default function Dashboard() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<NavView>("all");
  const [filters, setFilters] = useState<ClipFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drillProject, setDrillProject] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadClips();
      setClips(data);
    } catch (e) {
      console.error("Failed to load clips:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubs: Promise<() => void>[] = [
      listen("dashboard-opened", () => refresh()),
      listen<string>("navigate", (e) => setNav(e.payload as NavView)),
    ];
    return () => {
      unsubs.forEach((p) => p.then((fn) => fn()));
    };
  }, [refresh]);

  const handleNavigate = (view: NavView) => {
    setNav(view);
    setDrillProject(null);
    if (view === "favorites") {
      setFilters((f) => ({ ...f, starredOnly: true }));
    } else if (view !== "all" && view !== "recent") {
      setFilters((f) => ({ ...f, starredOnly: false }));
    }
  };

  const navClips = useMemo(() => {
    if (nav === "recent") return recentClips(clips, 100);
    if (nav === "favorites") return clips.filter((c) => c.starred);
    if (nav === "all") return clips;
    return clips;
  }, [clips, nav]);

  const filtered = useMemo(() => {
    let result = filterClips(navClips, filters);
    if (drillProject) {
      result = result.filter((c) => c.project === drillProject);
    }
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [navClips, filters, drillProject]);

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedId) ?? null,
    [clips, selectedId],
  );

  const projects = useMemo(() => buildProjectSummaries(clips), [clips]);
  const sources = useMemo(() => buildSourceSummaries(clips), [clips]);
  const files = useMemo(() => buildFileSummaries(clips), [clips]);

  const handleStar = async (id: string) => {
    const starred = await toggleStar(id);
    setClips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, starred } : c)),
    );
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (filters.search) {
          setFilters((f) => ({ ...f, search: "" }));
        } else {
          setSelectedId(null);
        }
        return;
      }
      if (meta && e.key === "c" && selectedClip) {
        e.preventDefault();
        handleCopy(selectedClip.text);
        return;
      }
      if (meta && e.key === "o" && selectedClip?.markdown_exists) {
        e.preventDefault();
        import("../../lib/api").then(({ openPath }) =>
          openPath(selectedClip.markdown_path),
        );
        return;
      }
      if (e.key === "Enter" && selectedId === null && filtered.length > 0) {
        setSelectedId(filtered[0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filters.search, selectedClip, selectedId, filtered]);

  const counts = {
    all: clips.length,
    projects: projects.length,
    sources: sources.length,
    files: files.length,
    recent: Math.min(clips.length, 100),
    favorites: clips.filter((c) => c.starred).length,
  };

  const projectOptions = uniqueValues(clips, "project");
  const sourceOptions = uniqueValues(clips, "source_name");
  const fileOptions = uniqueValues(clips, "file");

  const showClipLayout =
    nav === "all" ||
    nav === "recent" ||
    nav === "favorites" ||
    drillProject !== null;

  return (
    <div className="flex h-screen bg-surface text-white">
      <Sidebar active={nav} counts={counts} onNavigate={handleNavigate} />

      <div className="flex min-w-0 flex-1 flex-col">
        {nav !== "settings" && (
          <header className="border-b border-surface-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <input
                  ref={searchRef}
                  type="text"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Search clips… (⌘K)"
                  className="w-full rounded-md border border-surface-border bg-surface-raised py-2 pl-3 pr-3 text-sm text-white outline-none focus:border-accent"
                />
              </div>

              <select
                value={filters.project}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, project: e.target.value }))
                }
                className="rounded-md border border-surface-border bg-surface-raised px-2 py-2 text-xs text-white outline-none"
              >
                <option value="">All projects</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={filters.source}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, source: e.target.value }))
                }
                className="rounded-md border border-surface-border bg-surface-raised px-2 py-2 text-xs text-white outline-none"
              >
                <option value="">All sources</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filters.file}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, file: e.target.value }))
                }
                className="rounded-md border border-surface-border bg-surface-raised px-2 py-2 text-xs text-white outline-none"
              >
                <option value="">All files</option>
                {fileOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <select
                value={filters.dateRange}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    dateRange: e.target.value as DateFilter,
                  }))
                }
                className="rounded-md border border-surface-border bg-surface-raised px-2 py-2 text-xs text-white outline-none"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={filters.starredOnly}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, starredOnly: e.target.checked }))
                  }
                  className="rounded"
                />
                Starred
              </label>

              <button
                type="button"
                onClick={refresh}
                className="rounded-md border border-surface-border px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white"
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </header>
        )}

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto">
            {nav === "settings" ? (
              <SettingsPanel onRefresh={refresh} />
            ) : nav === "projects" && !drillProject ? (
              <ProjectsOverview
                projects={projects}
                onSelect={(name) => {
                  setNav("all");
                  setDrillProject(name);
                  setFilters((f) => ({ ...f, project: name }));
                }}
              />
            ) : nav === "sources" ? (
              <SourcesOverview
                sources={sources}
                clips={clips}
                onSelectSource={(name) => {
                  setNav("all");
                  setFilters((f) => ({ ...f, source: name }));
                }}
              />
            ) : nav === "files" ? (
              <FilesOverview files={files} />
            ) : (
              <ClipFeed
                clips={filtered}
                loading={loading}
                selectedId={selectedId}
                drillProject={drillProject}
                onClearDrill={() => {
                  setDrillProject(null);
                  setFilters((f) => ({ ...f, project: "" }));
                }}
                onSelect={setSelectedId}
                onStar={handleStar}
                onCopy={handleCopy}
              />
            )}
          </main>

          {showClipLayout && (
            <ClipDetail
              clip={selectedClip}
              onStar={handleStar}
              onCopy={handleCopy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ClipFeed({
  clips,
  loading,
  selectedId,
  drillProject,
  onClearDrill,
  onSelect,
  onStar,
  onCopy,
}: {
  clips: Clip[];
  loading: boolean;
  selectedId: string | null;
  drillProject: string | null;
  onClearDrill: () => void;
  onSelect: (id: string) => void;
  onStar: (id: string) => void;
  onCopy: (text: string) => void;
}) {
  if (loading && clips.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Loading clips…
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-white/50">No clips found</p>
        <p className="text-xs text-white/30">
          Highlight text anywhere and press ⌘⇧A to capture
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {drillProject && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-white/60">Project: {drillProject}</span>
          <button
            type="button"
            onClick={onClearDrill}
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        </div>
      )}
      <p className="mb-3 text-[11px] text-white/35">
        {clips.length} clip{clips.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-2">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            selected={selectedId === clip.id}
            onSelect={() => onSelect(clip.id)}
            onStar={() => onStar(clip.id)}
            onCopy={() => onCopy(clip.text)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectsOverview({
  projects,
  onSelect,
}: {
  projects: ReturnType<typeof buildProjectSummaries>;
  onSelect: (name: string) => void;
}) {
  if (projects.length === 0) {
    return <EmptyState message="No projects yet" />;
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => onSelect(p.name)}
          className="rounded-lg border border-surface-border bg-surface-raised p-4 text-left transition hover:border-white/15"
        >
          <h3 className="font-medium text-white">{p.name}</h3>
          <p className="mt-1 text-xs text-white/40">
            {p.clipCount} clips · {p.files.length} files
          </p>
          <p className="mt-2 text-[10px] text-white/30">
            Sources: {p.sources.slice(0, 4).join(", ")}
            {p.sources.length > 4 ? "…" : ""}
          </p>
          <p className="mt-1 font-mono text-[10px] text-white/25">
            Updated {formatTimestamp(p.lastUpdated)}
          </p>
        </button>
      ))}
    </div>
  );
}

function SourcesOverview({
  sources,
  clips,
  onSelectSource,
}: {
  sources: ReturnType<typeof buildSourceSummaries>;
  clips: Clip[];
  onSelectSource: (name: string) => void;
}) {
  if (sources.length === 0) return <EmptyState message="No sources yet" />;

  return (
    <div className="space-y-4 p-4">
      {sources.map((s) => {
        const recent = clips
          .filter((c) => c.source_name === s.name)
          .slice(0, 3);
        return (
          <div
            key={s.name}
            className="rounded-lg border border-surface-border bg-surface-raised p-4"
          >
            <button
              type="button"
              onClick={() => onSelectSource(s.name)}
              className="text-left"
            >
              <h3 className="font-medium text-white">{s.name}</h3>
              <p className="text-xs text-white/40">
                {s.clipCount} clips · last {formatTimestamp(s.lastUpdated)}
              </p>
            </button>
            {recent.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-surface-border pt-3">
                {recent.map((c) => (
                  <p key={c.id} className="truncate font-mono text-[11px] text-white/45">
                    {c.project}/{c.file} — {c.text.slice(0, 60)}…
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilesOverview({
  files,
}: {
  files: ReturnType<typeof buildFileSummaries>;
}) {
  if (files.length === 0) return <EmptyState message="No files yet" />;

  return (
    <div className="p-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-white/35">
            <th className="pb-2 pr-4">Project / File</th>
            <th className="pb-2 pr-4">Clips</th>
            <th className="pb-2 pr-4">Last updated</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={`${f.project}/${f.file}`} className="border-b border-surface-border/50">
              <td className="py-3 pr-4">
                <span className="text-white/80">
                  {f.project}/{f.file}
                </span>
                {!f.markdownExists && (
                  <span className="ml-2 text-[10px] text-amber-500">missing</span>
                )}
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-white/50">
                {f.clipCount}
              </td>
              <td className="py-3 pr-4 font-mono text-[11px] text-white/40">
                {formatTimestamp(f.lastUpdated)}
              </td>
              <td className="py-3">
                {f.markdownExists && (
                  <button
                    type="button"
                    onClick={() =>
                      import("../../lib/api").then(({ openPath }) =>
                        openPath(f.markdownPath),
                      )
                    }
                    className="text-xs text-accent hover:underline"
                  >
                    Open
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-white/30">
      {message}
    </div>
  );
}
