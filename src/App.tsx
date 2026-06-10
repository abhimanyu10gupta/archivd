import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import Popup from "./components/Popup";
import Settings from "./components/Settings";
import type { CaptureMetadata } from "./lib/api";

type View = "popup" | "settings";

interface ShowPopupPayload {
  text: string;
  id: number;
  metadata: CaptureMetadata;
}

const defaultMetadata: CaptureMetadata = {
  source_app: "Unknown",
  source_name: "Clipboard",
  url: null,
  window_title: null,
};

function App() {
  const [view, setView] = useState<View>("popup");
  const [capturedText, setCapturedText] = useState("");
  const [captureId, setCaptureId] = useState(0);
  const [captureMetadata, setCaptureMetadata] =
    useState<CaptureMetadata>(defaultMetadata);

  useEffect(() => {
    const label = getCurrentWindow().label;
    if (label === "settings") {
      setView("settings");
    }
  }, []);

  useEffect(() => {
    const unlisten = listen<ShowPopupPayload>("show-popup", (event) => {
      setCapturedText(event.payload.text);
      setCaptureId(event.payload.id);
      setCaptureMetadata(event.payload.metadata ?? defaultMetadata);
      setView("popup");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (view === "settings") {
    return <Settings />;
  }

  return (
    <Popup
      key={captureId}
      capturedText={capturedText}
      captureMetadata={captureMetadata}
    />
  );
}

export default App;
