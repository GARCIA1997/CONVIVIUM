import "@convivium/ui/convivium.css";
import { DeviceGate } from "@convivium/app-shell";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";


// La TV del KDS es de solo lectura (?modo=tv); la táctil despacha.
const mode = new URLSearchParams(location.search).get("modo") === "tv" ? "tv" : "tactil";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeviceGate kind={mode === "tv" ? "kds_tv" : "estacion_tactil"} deviceLabel={mode === "tv" ? "KDS · TV" : "Estación · táctil"} idleMinutes={720}>
      <App mode={mode} />
    </DeviceGate>
  </StrictMode>,
);
