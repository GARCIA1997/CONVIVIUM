import "@convivium/ui/tokens.css";
import { DeviceGate } from "@convivium/app-shell";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeviceGate kind="caja" deviceLabel="Caja 1" idleMinutes={30}>
      <App />
    </DeviceGate>
  </StrictMode>,
);
