import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import Popup from "./components/Popup";
import Settings from "./components/Settings";

type View = "popup" | "settings";

function App() {
  const [view, setView] = useState<View>("popup");
  const [capturedText, setCapturedText] = useState("");
  const [captureId, setCaptureId] = useState(0);

  useEffect(() => {
    const label = getCurrentWindow().label;
    if (label === "settings") {
      setView("settings");
    }
  }, []);

  useEffect(() => {
    const unlisten = listen<{ text: string; id: number }>("show-popup", (event) => {
      setCapturedText(event.payload.text);
      setCaptureId(event.payload.id);
      setView("popup");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);


  if (view === "settings") {
    return <Settings />;
  }

  return <Popup key={captureId} capturedText={capturedText} />;
}

export default App;
