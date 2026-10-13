import type { Msw } from "../msw";
import { callerOf } from "../caller";
import type { Conversation, Message, Plan } from "../../advisor/model/advisor";
import { DEGRADED_TEXT, advisorFixtures, paginate } from "../fixtures/advisor";

// MSW handlers of qone-advisor-api (AD-01..AD-08) and WF-03 over the fixtures, with the rules
// of the contract: a conversation and its plans belong to their user (404 for anyone else, D-03),
// replies and conversations are idempotent by key, a plan is confirmed only while PROPOSED and
// before it expires, dismissing any other state returns it unchanged (D-04). A message that
// says "degraded" answers like the advisor without its model (D-02); one that asks to enroll
// gets the ISW-602 plan; confirming "Teoría" completes, anything else is rejected for seats.
let conversations: Conversation[] = [];
let messages: Message[] = [];
let plans: Plan[] = [];
const sagas = new Map<string, { status: "COMPLETED" | "COMPENSATED"; reason: string | null }>();
const byKey = new Map<string, Conversation | { message: Message; plan: Plan | null; degraded: boolean }>();
reset();

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function advisorHandlers({ http, HttpResponse }: Msw) {
  const envelope = (status: number, error: string, message: string, details?: Array<{ field: string; message: string }>) =>
    HttpResponse.json({ error, message, ...(details ? { details } : {}), traceId: crypto.randomUUID() }, { status });
  const badKey = () => envelope(400, "VALIDATION_ERROR", "the request has invalid fields", [{ field: "Idempotency-Key", message: "header required, 8 to 128 characters" }]);
  const keyOf = (request: Request) => request.headers.get("idempotency-key") ?? "";
  const page = (request: Request) => {
    const url = new URL(request.url);
    return [Number(url.searchParams.get("page") ?? "1"), Number(url.searchParams.get("limit") ?? "20")] as const;
  };
  const ownPlan = (request: Request, planId: unknown) => {
    const who = callerOf(request);
    return who ? plans.find((p) => p.id === planId && p.studentId === who.userId) : undefined;
  };

  return [
    http.get("*/api/v1/advisor/health", () => HttpResponse.json({ status: "ok", service: "qone-advisor-api", version: "2.0.0", llm: "configured", model: "gpt-4o-mini" })),

    http.post("*/api/v1/advisor/conversations", ({ request }) => {
      const who = callerOf(request);
      if (!who) return envelope(401, "UNAUTHORIZED", "missing or invalid token");
      const key = keyOf(request);
      if (key.length < 8 || key.length > 128) return badKey();
      if (byKey.has(key)) return HttpResponse.json(byKey.get(key));
      const created: Conversation = { id: crypto.randomUUID(), userId: who.userId, userRole: who.role as Conversation["userRole"], model: "gpt-4o-mini", createdAt: now() };
      conversations.push(created);
      byKey.set(key, created);
      return HttpResponse.json(created, { status: 201, headers: { Location: `/api/v1/advisor/conversations/${created.id}/messages` } });
    }),

    http.get("*/api/v1/advisor/conversations/me", ({ request }) => {
      const who = callerOf(request);
      if (!who) return envelope(401, "UNAUTHORIZED", "missing or invalid token");
      const mine = conversations.filter((c) => c.userId === who.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return HttpResponse.json(paginate(mine, ...page(request)));
    }),

    http.get("*/api/v1/advisor/conversations/:id/messages", ({ request, params }) => {
      const who = callerOf(request);
      if (!who) return envelope(401, "UNAUTHORIZED", "missing or invalid token");
      if (!conversations.some((c) => c.id === params["id"] && c.userId === who.userId)) return envelope(404, "NOT_FOUND", "resource not found");
      const rows = messages.filter((m) => m.conversationId === params["id"]).reverse();
      return HttpResponse.json(paginate(rows, ...page(request)));
    }),

    http.post("*/api/v1/advisor/conversations/:id/messages", async ({ request, params }) => {
      const who = callerOf(request);
      if (!who) return envelope(401, "UNAUTHORIZED", "missing or invalid token");
      const conversation = conversations.find((c) => c.id === params["id"] && c.userId === who.userId);
      if (!conversation) return envelope(404, "NOT_FOUND", "resource not found");
      const key = keyOf(request);
      if (key.length < 8 || key.length > 128) return badKey();
      if (byKey.has(key)) return HttpResponse.json(byKey.get(key));
      const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
      const content = typeof body?.content === "string" ? body.content.trim() : "";
      if (!content || content.length > 2000) return envelope(400, "VALIDATION_ERROR", "the request has invalid fields", [{ field: "content", message: "must be 1 to 2000 characters" }]);
      const at = now();
      messages.push({ id: crypto.randomUUID(), conversationId: conversation.id, role: "USER", content, createdAt: at });
      const degraded = /degraded/i.test(content);
      const wantsEnrollment = !degraded && who.role === "STUDENT" && /matr[ií]c|inscr[ií]b|enroll/i.test(content);
      const plan = wantsEnrollment ? advisorFixtures.planFor(conversation.id, who.userId, at) : null;
      if (plan) plans.push(plan);
      const text = degraded ? DEGRADED_TEXT : plan ? "Te propongo Teoría de la Computación, grupo 1. Confírmalo o descártalo; el plan vence en 10 minutos." : "Llevas 11 de 42 créditos aprobados.";
      const answer: Message = { id: crypto.randomUUID(), conversationId: conversation.id, role: "ASSISTANT", content: text, createdAt: at };
      messages.push(answer);
      const reply = { message: answer, plan, degraded };
      byKey.set(key, reply);
      return HttpResponse.json(reply, { status: 201 });
    }),

    http.get("*/api/v1/advisor/plans/:id", ({ request, params }) => {
      const plan = ownPlan(request, params["id"]);
      return plan ? HttpResponse.json(plan) : envelope(404, "NOT_FOUND", "resource not found");
    }),

    http.post("*/api/v1/advisor/plans/:id/confirm", ({ request, params }) => {
      const plan = ownPlan(request, params["id"]);
      if (!plan) return envelope(404, "NOT_FOUND", "resource not found");
      if (plan.status !== "PROPOSED" || Date.parse(plan.expiresAt) <= Date.now()) {
        return envelope(422, "INVALID_STATUS_TRANSITION", plan.status === "PROPOSED" ? "the plan expired: ask the advisor for a new one (INV-ADV-003)" : `a ${plan.status} plan cannot be confirmed`);
      }
      const sagaId = crypto.randomUUID();
      const completed = plan.summary.subjectName.startsWith("Teoría");
      sagas.set(sagaId, completed ? { status: "COMPLETED", reason: null } : { status: "COMPENSATED", reason: "NO_SEATS" });
      Object.assign(plan, { status: completed ? "EXECUTED" : "FAILED", confirmationId: crypto.randomUUID(), sagaId });
      return HttpResponse.json({ plan, sagaId }, { status: 202 });
    }),

    http.post("*/api/v1/advisor/plans/:id/dismiss", ({ request, params }) => {
      const plan = ownPlan(request, params["id"]);
      if (!plan) return envelope(404, "NOT_FOUND", "resource not found");
      if (plan.status === "PROPOSED") plan.status = "DISMISSED";
      return HttpResponse.json(plan);
    }),

    http.get("*/api/v1/sagas/:id", ({ params }) => {
      const saga = sagas.get(String(params["id"]));
      return saga ? HttpResponse.json({ id: params["id"], ...saga }) : envelope(404, "NOT_FOUND", "resource not found");
    }),
  ];
}

/** Test support: back to the fixtures (Laura's earlier conversation, no plans). */
export function reset(): void {
  conversations = [{ ...advisorFixtures.conversation }];
  messages = advisorFixtures.messages.map((m) => ({ ...m }));
  plans = [];
  sagas.clear();
  byKey.clear();
}

/** Test support: a plan that must fail at the saga, or that expired. */
export function seedPlan(plan: Plan): void {
  plans.push(plan);
}
