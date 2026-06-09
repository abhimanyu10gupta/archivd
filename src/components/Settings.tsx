import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, saveSettings, ensureBaseDir, hideWindow } from "../lib/api";

export default function Settings() {
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
      if (typeof selected === "string") {
        setBaseDir(selected);
      }
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
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    await hideWindow("settings");
  };

  const inputClass =
    "flex-1 rounded-md border border-surface-border bg-surface-raised px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent";

  return (
    <div className="flex h-screen flex-col bg-surface p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <button
          type="button"
          onClick={handleClose}
          className="text-sm text-white/40 transition hover:text-white"
        >
          Close
        </button>
      </div>

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
            className="shrink-0 rounded-md border border-surface-border px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Browse
          </button>
        </div>
        <p className="mt-2 text-xs text-white/30">
          Type a custom path or browse to select a folder. Projects are
          subfolders inside this directory.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-surface-border bg-surface-raised p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/40">
          Hotkey
        </p>
        <p className="font-mono text-sm text-white/70">⌘ + Shift + A</p>
        <p className="mt-1 text-xs text-white/30">
          Hotkey customization coming soon.
        </p>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mb-3 text-xs text-green-400">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !baseDir.trim()}
        className="mt-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}
