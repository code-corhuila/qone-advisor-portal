import { Route, Routes } from "react-router";
import { AdvisorPage } from "./pages/AdvisorPage";

// The module the shell mounts at /advisor/* (exposed as ./App). Routes are relative to that
// mount: the conversations, and one open at c/<id> (HU-ADV-002, HU-ADV-003).
export function App() {
  return (
    <section aria-labelledby="advisor-title">
      <h2 id="advisor-title">Advisor</h2>
      <Routes>
        <Route index element={<AdvisorPage />} />
        <Route path="c/:conversationId" element={<AdvisorPage />} />
        <Route path="*" element={<p>Not found</p>} />
      </Routes>
    </section>
  );
}

export default App;
