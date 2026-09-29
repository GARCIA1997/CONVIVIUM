import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CaptainPage } from "./features/captain/CaptainPage";
import { CheckPage } from "./features/check/CheckPage";
import { FloorPage } from "./features/floor/FloorPage";

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<FloorPage />} />
        <Route path="/cuenta/:checkId" element={<CheckPage />} />
        <Route path="/capitan" element={<CaptainPage />} />
      </Routes>
    </BrowserRouter>
  );
}
