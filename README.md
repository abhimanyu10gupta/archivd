# Archivd

Local-first macOS menu bar app for capturing highlighted text into project markdown files.

Highlight text anywhere → press **⌘⇧A** → pick a project and file → save.

## Stack

- **Tauri 2** + **Rust** (hotkey, clipboard, filesystem)
- **React** + **TypeScript** + **TailwindCSS** (popup UI)

## Prerequisites

- macOS 10.15+
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)

## Setup

```bash
# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build production app
npm run tauri build
```

## First Run

On first launch, Archivd creates `~/Archivd/` with sample project folders if none exist:

```
~/Archivd/
  playgrnd/
    ideas.md
    debugging.md
    decisions.md
  jrnld/
    prompts.md
    architecture.md
  spendsmart/
    bugs.md
```

Projects are folders. Categories are `.md` files inside each project folder.

## Usage

1. Highlight text in any app (browser, editor, chat, etc.)
2. Press **⌘ + Shift + A**
3. Archivd captures the selection via clipboard (saves/restores your clipboard automatically)
4. Choose **Project** and **File** in the popup
5. Click **Save** (or **⌘+Enter**)

Entries are appended in this format:

```markdown
## 2026-06-10 11:42 PM

Source: Clipboard

> The highlighted text goes here

```

## Menu Bar

Archivd lives in the menu bar (no dock icon by default).

- **Click tray icon** → open Settings
- **Right-click tray icon** → Capture / Settings / Quit

## Settings

Open from the tray menu. Configure:

- **Base directory** — defaults to `~/Archivd`

Settings are stored at `~/Library/Application Support/archivd/settings.json` (via `dirs::config_dir()`).

## macOS Permissions

Archivd needs **Accessibility** permission to simulate ⌘C for clipboard capture.

When prompted, go to:

**System Settings → Privacy & Security → Accessibility**

Enable **Archivd** (or your terminal app when running `npm run tauri dev`).

Without this permission, hotkey capture will fail.

## Project Structure

```
archivd/
├── src/                  # React frontend
│   ├── components/       # Popup, Settings
│   └── lib/api.ts        # Tauri command wrappers
├── src-tauri/
│   └── src/
│       ├── clipboard.rs  # Save → Cmd+C → read → restore
│       ├── filesystem.rs # Projects, files, append
│       ├── settings.rs   # Config persistence
│       └── lib.rs        # Tray, hotkey, window orchestration
└── README.md
```

## Development

```bash
npm run dev          # Vite frontend only
npm run tauri dev    # Full app with hot reload
npm run build        # Frontend production build
npm run tauri build  # macOS .app bundle
```

## License

MIT
