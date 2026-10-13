import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { App } from "./App";

test("the portal renders under its mount route", () => {
  render(
    <MemoryRouter initialEntries={["/advisor"]}>
      <Routes>
        <Route path="/advisor/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Advisor" })).toBeInTheDocument();
});
