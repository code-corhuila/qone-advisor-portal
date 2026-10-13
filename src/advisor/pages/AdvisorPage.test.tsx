import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { App } from "../App";
import { advisorFixtures } from "../../mocks/fixtures/advisor";
import { reset, seedPlan } from "../../mocks/handlers/advisor";
import { server } from "../../mocks/server";
import { testSession } from "../../test/shell/session";

const laura = { id: advisorFixtures.students.laura.id, role: "STUDENT" as const, name: "Laura Gómez" };

function open(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/advisor/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function ask(text: string) {
  await userEvent.type(await screen.findByLabelText("Your question"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  reset();
  testSession.signInAs(laura);
});

test("the conversations are listed and a new one opens", async () => {
  open("/advisor");
  expect(await screen.findByRole("link", { name: /2026/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "New conversation" }));
  expect(await screen.findByLabelText("Your question")).toBeInTheDocument();
  expect(await screen.findAllByRole("link")).toHaveLength(2);
});

test("the history is shown oldest first and a reply is appended", async () => {
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  const list = await screen.findByRole("list", { name: "Messages" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("¿Qué me falta para graduarme?");
  await ask("¿Cuántos créditos llevo?");
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(4));
  expect(within(list).getAllByRole("listitem")[3]).toHaveTextContent("11 de 42");
});

test("a proposed plan is confirmed and the enrollment is reported", async () => {
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  await ask("Matricúlame en Teoría de la Computación");
  const card = await screen.findByRole("article", { name: "Plan ISW-602" });
  expect(within(card).getByText("Waiting for your confirmation")).toBeInTheDocument();
  expect(within(card).getByText("Tue 16:00-18:00, Thu 16:00-18:00")).toBeInTheDocument();
  await userEvent.click(within(card).getByRole("button", { name: "Confirm enrollment" }));
  expect(await within(card).findByText("You are enrolled in ISW-602 group 1.")).toBeInTheDocument();
  expect(within(card).queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
});

test("a dismissed plan shows no actions", async () => {
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  await ask("inscríbeme por favor");
  const card = await screen.findByRole("article", { name: "Plan ISW-602" });
  await userEvent.click(within(card).getByRole("button", { name: "Dismiss" }));
  expect(await within(card).findByText("Dismissed")).toBeInTheDocument();
  expect(within(card).queryByRole("button")).not.toBeInTheDocument();
});

test("the reason of a rejected saga is shown", async () => {
  const plan = advisorFixtures.planFor(advisorFixtures.conversation.id, laura.id, new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  plan.summary.subjectName = "Sistemas Distribuidos";
  plan.summary.subjectCode = "ISW-604";
  seedPlan(plan);
  const { PlanCard } = await import("../components/PlanCard");
  render(<PlanCard initial={plan} />);
  await userEvent.click(screen.getByRole("button", { name: "Confirm enrollment" }));
  expect(await screen.findByText("The enrollment was rejected: the group has no seats left.")).toBeInTheDocument();
});

test("an expired plan cannot be confirmed and says so", async () => {
  const plan = advisorFixtures.planFor(advisorFixtures.conversation.id, laura.id, "2026-01-01T00:00:00Z");
  seedPlan(plan);
  const { PlanCard } = await import("../components/PlanCard");
  render(<PlanCard initial={plan} />);
  await userEvent.click(screen.getByRole("button", { name: "Confirm enrollment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("the plan expired");
});

test("a degraded reply is marked and the chat keeps working", async () => {
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  await ask("degraded");
  expect(await screen.findByRole("status", { name: "Advisor unavailable" })).toBeInTheDocument();
  expect(screen.getByLabelText("Your question")).toBeEnabled();
});

test("another person's conversation is not found", async () => {
  testSession.signInAs({ id: advisorFixtures.students.santiago.id, role: "STUDENT", name: "Santiago Rojas" });
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

test("the question shows at once and the advisor thinks until it answers", async () => {
  // A slower advisor: the handler waits, then lets the synthetic advisor answer.
  server.use(http.post("*/api/v1/advisor/conversations/:id/messages", async () => void (await delay(200))));
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  const list = await screen.findByRole("list", { name: "Messages" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));

  await ask("¿Cuántos créditos llevo?");

  expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent("¿Cuántos créditos llevo?");
  expect(screen.getByRole("status", { name: "The advisor is thinking" })).toBeInTheDocument();
  expect(screen.getByLabelText("Your question")).toHaveValue("");
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(4));
  expect(within(list).getAllByRole("listitem")[3]).toHaveTextContent("11 de 42");
  expect(screen.queryByRole("status", { name: "The advisor is thinking" })).not.toBeInTheDocument();
});

test("Enter sends the question and Shift+Enter starts a new line", async () => {
  open(`/advisor/c/${advisorFixtures.conversation.id}`);
  const box = await screen.findByLabelText("Your question");

  await userEvent.type(box, "Primera línea{Shift>}{Enter}{/Shift}segunda");
  expect(box).toHaveValue("Primera línea\nsegunda");
  await userEvent.type(box, "{Enter}");

  const list = screen.getByRole("list", { name: "Messages" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(4));
  expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent("Primera línea");
});

test("a new conversation greets the student and a suggestion asks it", async () => {
  open("/advisor");
  await userEvent.click(await screen.findByRole("button", { name: "New conversation" }));

  expect(await screen.findByRole("heading", { name: "How can I help you?" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "¿Cuántos créditos llevo y cuántos me faltan?" }));

  const list = screen.getByRole("list", { name: "Messages" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
  expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent("11 de 42");
});

