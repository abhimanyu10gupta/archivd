import type { NavView } from "../../lib/types";

interface SidebarProps {
  active: NavView;
  counts: {
    all: number;
    projects: number;
    sources: number;
    files: number;
    recent: number;
    favorites: number;
  };
  onNavigate: (view: NavView) => void;
}

const NAV_ITEMS: { id: NavView; label: string; key: keyof SidebarProps["counts"] }[] = [
  { id: "all", label: "All Clips", key: "all" },
  { id: "recent", label: "Recent", key: "recent" },
  { id: "favorites", label: "Favorites", key: "favorites" },
  { id: "projects", label: "Projects", key: "projects" },
  { id: "sources", label: "Sources", key: "sources" },
  { id: "files", label: "Files", key: "files" },
];

export default function Sidebar({ active, counts, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-surface-border bg-[#141414]">
      <div className="border-b border-surface-border px-4 py-4">
        <h1 className="text-sm font-semibold tracking-tight text-white">Archivd</h1>
        <p className="mt-0.5 text-[10px] text-white/35">Local context archive</p>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
              active === item.id
                ? "bg-white/10 text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <span>{item.label}</span>
            <span className="font-mono text-[10px] text-white/30">{counts[item.key]}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-surface-border p-2">
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
            active === "settings"
              ? "bg-white/10 text-white"
              : "text-white/55 hover:bg-white/5 hover:text-white/80"
          }`}
        >
          Settings
        </button>
      </div>
    </aside>
  );
}
