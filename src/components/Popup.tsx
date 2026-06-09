import { useCallback, useEffect, useState } from "react";
import {
  listProjects,
  listMarkdownFiles,
  saveEntry,
  hideWindow,
} from "../lib/api";

interface PopupProps {
  capturedText: string;
}

export default function Popup({ capturedText }: PopupProps) {
  const [projects, setProjects] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [file, setFile] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then((p) => {
        setProjects(p);
        if (p.length > 0) setProject(p[0]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!project.trim()) {
      setFiles([]);
      setFile("");
      return;
    }
    listMarkdownFiles(project.trim())
      .then((f) => {
        setFiles(f);
        if (f.length > 0 && !f.includes(file)) {
          setFile(f[0]);
        }
      })
      .catch((e) => setError(String(e)));
  }, [project]);

  const handleCancel = useCallback(async () => {
    setError(null);
    await hideWindow("popup");
  }, []);

  const handleSave = useCallback(async () => {
    const projectName = project.trim();
    const fileName = file.trim();

    if (!projectName || !fileName) {
      setError("Enter a project and file name");
      return;
    }
    if (!capturedText.trim()) {
      setError("No text captured");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveEntry(projectName, fileName, capturedText);
      await hideWindow("popup");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [project, file, capturedText]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCancel, handleSave]);

  const preview =
    capturedText.length > 200
      ? capturedText.slice(0, 200) + "…"
      : capturedText;

  const inputClass =
    "w-full rounded-md border border-surface-border bg-surface-raised px-3 py-2 text-sm text-white outline-none focus:border-accent";

  return (
    <div className="flex h-screen flex-col bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight text-white/90">
          Archivd
        </h1>
        <span className="font-mono text-[10px] text-white/30">⌘⇧A</span>
      </div>

      <div className="mb-3 rounded-md border border-surface-border bg-surface-raised p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/40">
          Captured
        </p>
        <p className="line-clamp-4 font-mono text-xs leading-relaxed text-white/70">
          {preview || <span className="italic text-white/30">Empty</span>}
        </p>
      </div>

      <div className="mb-2">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">
          Project
        </label>
        <input
          type="text"
          list="project-list"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="e.g. playgrnd"
          className={inputClass}
        />
        <datalist id="project-list">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <p className="mt-1 text-[10px] text-white/30">
          Pick existing or type a new project name
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">
          File
        </label>
        <input
          type="text"
          list="file-list"
          value={file}
          onChange={(e) => setFile(e.target.value)}
          placeholder="e.g. ideas or ideas.md"
          className={inputClass}
        />
        <datalist id="file-list">
          {files.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <p className="mt-1 text-[10px] text-white/30">
          Pick existing or type a new filename (.md added automatically)
        </p>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 rounded-md border border-surface-border px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !project.trim() || !file.trim()}
          className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
