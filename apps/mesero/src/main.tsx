import "@convivium/ui/tokens.css";
import "@convivium/ui/convivium.css";
import { DeviceGate } from "@convivium/app-shell";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeviceGate kind="mesero" deviceLabel="Celular de mesero">
      <App />
    </DeviceGate>
  </StrictMode>,
);
