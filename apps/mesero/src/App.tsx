import { useSession } from "@convivium/app-shell";
import { Monogram } from "@convivium/ui";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CheckPage } from "./features/check/CheckPage";
import { FloorPage } from "./features/floor/FloorPage";
import { ReadyNotifications } from "./features/notifications/ReadyNotifications";

export function App() {
  const { session, logout } = useSession();
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <header style={{ background: "var(--c-olivo)", color: "var(--c-marfil)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <Monogram size={28} color="var(--c-dorado)" />
        <div style={{ flex: 1 }}>Hola, {session.user.name}</div>
        <button onClick={logout} className="cv-btn cv-btn--ghost" style={{ color: "var(--c-marfil)", minHeight: 36 }}>Salir</button>
      </header>
      <ReadyNotifications />
      <Routes>
        <Route path="/" element={<FloorPage />} />
        <Route path="/cuenta/:checkId" element={<CheckPage />} />
      </Routes>
    </BrowserRouter>
  );
}
