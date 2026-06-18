export interface Clip {
  id: string;
  project: string;
  file: string;
  source_app: string;
  source_name: string;
  window_title?: string | null;
  url?: string | null;
  timestamp: string;
  text: string;
  markdown_path: string;
  markdown_exists: boolean;
  starred: boolean;
}

export type NavView =
  | "all"
  | "projects"
  | "sources"
  | "files"
  | "recent"
  | "favorites"
  | "settings";

export type DateFilter = "all" | "today" | "week" | "month";

export interface ClipFilters {
  search: string;
  project: string;
  source: string;
  file: string;
  dateRange: DateFilter;
  starredOnly: boolean;
}

export interface FileSummary {
  project: string;
  file: string;
  clipCount: number;
  lastUpdated: string;
  markdownPath: string;
  markdownExists: boolean;
}

export interface ProjectSummary {
  name: string;
  clipCount: number;
  files: string[];
  sources: string[];
  lastUpdated: string;
}

export interface SourceSummary {
  name: string;
  clipCount: number;
  lastUpdated: string;
}
