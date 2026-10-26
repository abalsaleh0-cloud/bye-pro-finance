import { useEffect, useState } from "react";
import ApplicationSettingsView from "../../components/ApplicationSettingsView";
import ProfileSettingsView from "../../components/ProfileSettingsView";

type SettingsView = "profile" | "settings";

function readView(): SettingsView {
  return typeof document !== "undefined" && document.body.dataset.byeSettingsView === "profile" ? "profile" : "settings";
}

export default function SettingsRouter() {
  const [view, setView] = useState<SettingsView>(readView);

  useEffect(() => {
    const sync = () => setView(readView());
    window.addEventListener("bye-settings-view-changed", sync);
    sync();
    return () => window.removeEventListener("bye-settings-view-changed", sync);
  }, []);

  return view === "profile" ? <ProfileSettingsView /> : <ApplicationSettingsView />;
}
