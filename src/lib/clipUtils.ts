import type { Clip, ClipFilters, DateFilter, FileSummary, ProjectSummary, SourceSummary } from "./types";

export function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function urlDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function previewText(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max) + "…";
}

function inDateRange(timestamp: string, range: DateFilter): boolean {
  if (range === "all") return true;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    start.setDate(now.getDate() - 7);
  } else if (range === "month") {
    start.setMonth(now.getMonth() - 1);
  }
  return d >= start;
}

export function filterClips(clips: Clip[], filters: ClipFilters): Clip[] {
  const q = filters.search.trim().toLowerCase();

  return clips.filter((clip) => {
    if (filters.starredOnly && !clip.starred) return false;
    if (filters.project && clip.project !== filters.project) return false;
    if (filters.source && clip.source_name !== filters.source) return false;
    if (filters.file && clip.file !== filters.file) return false;
    if (!inDateRange(clip.timestamp, filters.dateRange)) return false;

    if (!q) return true;

    const haystack = [
      clip.text,
      clip.project,
      clip.file,
      clip.source_name,
      clip.source_app,
      clip.window_title ?? "",
      clip.url ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function uniqueValues(clips: Clip[], key: keyof Clip): string[] {
  const set = new Set<string>();
  for (const clip of clips) {
    const val = clip[key];
    if (typeof val === "string" && val.trim()) set.add(val);
  }
  return Array.from(set).sort();
}

export function buildProjectSummaries(clips: Clip[]): ProjectSummary[] {
  const map = new Map<string, ProjectSummary>();

  for (const clip of clips) {
    let entry = map.get(clip.project);
    if (!entry) {
      entry = {
        name: clip.project,
        clipCount: 0,
        files: [],
        sources: [],
        lastUpdated: clip.timestamp,
      };
      map.set(clip.project, entry);
    }
    entry.clipCount += 1;
    if (!entry.files.includes(clip.file)) entry.files.push(clip.file);
    if (!entry.sources.includes(clip.source_name)) entry.sources.push(clip.source_name);
    if (clip.timestamp > entry.lastUpdated) entry.lastUpdated = clip.timestamp;
  }

  return Array.from(map.values())
    .map((p) => ({
      ...p,
      files: p.files.sort(),
      sources: p.sources.sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSourceSummaries(clips: Clip[]): SourceSummary[] {
  const map = new Map<string, SourceSummary>();

  for (const clip of clips) {
    let entry = map.get(clip.source_name);
    if (!entry) {
      entry = { name: clip.source_name, clipCount: 0, lastUpdated: clip.timestamp };
      map.set(clip.source_name, entry);
    }
    entry.clipCount += 1;
    if (clip.timestamp > entry.lastUpdated) entry.lastUpdated = clip.timestamp;
  }

  return Array.from(map.values()).sort((a, b) => b.clipCount - a.clipCount);
}

export function buildFileSummaries(clips: Clip[]): FileSummary[] {
  const map = new Map<string, FileSummary>();

  for (const clip of clips) {
    const key = `${clip.project}/${clip.file}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        project: clip.project,
        file: clip.file,
        clipCount: 0,
        lastUpdated: clip.timestamp,
        markdownPath: clip.markdown_path,
        markdownExists: clip.markdown_exists,
      };
      map.set(key, entry);
    }
    entry.clipCount += 1;
    if (clip.timestamp > entry.lastUpdated) entry.lastUpdated = clip.timestamp;
    entry.markdownExists = entry.markdownExists || clip.markdown_exists;
  }

  return Array.from(map.values()).sort((a, b) => {
    const p = a.project.localeCompare(b.project);
    return p !== 0 ? p : a.file.localeCompare(b.file);
  });
}

export function recentClips(clips: Clip[], limit = 50): Clip[] {
  return [...clips]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
