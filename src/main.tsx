import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { App } from "./advisor/App";

// Standalone entry for developing the portal on its own (port 5005). It still imports the
// shell's client and session through federation, so the shell must be running at
// VITE_SHELL_URL; in the product the shell mounts ./App at /advisor/* and this file is unused.
const container = document.getElementById("root");
if (!container) {
  throw new Error("index.html must contain an element with id 'root'");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/advisor/*" element={<App />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
