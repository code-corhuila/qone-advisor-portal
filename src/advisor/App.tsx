import { Route, Routes } from "react-router";

// The module the shell mounts at /advisor/* (exposed as ./App). Routes are relative to that
// mount. The chat and the plans of HU-ADV-002 and HU-ADV-003 register their pages here.
export function App() {
  return (
    <section aria-labelledby="advisor-title">
      <h2 id="advisor-title">Advisor</h2>
      <Routes>
        <Route index element={<p>The academic advisor of Qampus.</p>} />
        <Route path="*" element={<p>Not found</p>} />
      </Routes>
    </section>
  );
}

export default App;
