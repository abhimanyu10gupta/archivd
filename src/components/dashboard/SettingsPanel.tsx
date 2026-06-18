import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getSettings,
  saveSettings,
  ensureBaseDir,
  openBaseDir,
  loadClips,
} from "../../lib/api";

interface SettingsPanelProps {
  onRefresh: () => void;
}

export default function SettingsPanel({ onRefresh }: SettingsPanelProps) {
  const [baseDir, setBaseDir] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => setBaseDir(s.base_dir))
      .catch((e) => setError(String(e)));
  }, []);

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: baseDir || undefined,
        title: "Choose Archivd base directory",
      });
      if (typeof selected === "string") setBaseDir(selected);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveSettings({ base_dir: baseDir.trim() });
      await ensureBaseDir();
      setMessage("Settings saved");
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "flex-1 rounded-md border border-surface-border bg-surface-raised px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent";

  return (
    <div className="max-w-xl p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">Settings</h2>

      <div className="mb-6">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">
          Base Directory
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={baseDir}
            onChange={(e) => setBaseDir(e.target.value)}
            placeholder="~/Archivd"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleBrowse}
            className="shrink-0 rounded-md border border-surface-border px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Browse
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openBaseDir()}
          className="rounded-md border border-surface-border px-3 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Open in Finder
        </button>
        <button
          type="button"
          onClick={async () => {
            await loadClips();
            onRefresh();
            setMessage("Archive refreshed");
          }}
          className="rounded-md border border-surface-border px-3 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Refresh Archive
        </button>
      </div>

      <div className="mb-6 rounded-md border border-surface-border bg-surface-raised p-4">
        <p className="text-xs text-white/40">Capture hotkey</p>
        <p className="mt-1 font-mono text-sm text-white/70">⌘ + Shift + A</p>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mb-3 text-xs text-green-400">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !baseDir.trim()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}
