import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import Popup from "./components/Popup";
import Dashboard from "./components/dashboard/Dashboard";
import type { CaptureMetadata } from "./lib/api";

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
  const [windowLabel, setWindowLabel] = useState<string>("");
  const [capturedText, setCapturedText] = useState("");
  const [captureId, setCaptureId] = useState(0);
  const [captureMetadata, setCaptureMetadata] =
    useState<CaptureMetadata>(defaultMetadata);

  useEffect(() => {
    setWindowLabel(getCurrentWindow().label);
  }, []);

  useEffect(() => {
    if (windowLabel !== "popup") return;

    const unlisten = listen<ShowPopupPayload>("show-popup", (event) => {
      setCapturedText(event.payload.text);
      setCaptureId(event.payload.id);
      setCaptureMetadata(event.payload.metadata ?? defaultMetadata);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [windowLabel]);

  if (windowLabel === "dashboard") {
    return <Dashboard />;
  }

  if (windowLabel === "popup") {
    return (
      <Popup
        key={captureId}
        capturedText={capturedText}
        captureMetadata={captureMetadata}
      />
    );
  }

  return null;
}

export default App;
