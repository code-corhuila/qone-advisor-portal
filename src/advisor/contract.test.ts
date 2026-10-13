// @vitest-environment node
// Contract level (ADR-009): the synthetic data and the handler answers must match the YAML copy
// of qone-advisor-api, so "aligned with 07" is a test result.
import { advisorFixtures } from "../mocks/fixtures/advisor";
import { expectValid, loadContract, type Contract } from "../test/contracts";

let advisor: Contract;
beforeAll(async () => {
  advisor = await loadContract("qone-advisor-api.yaml");
});

describe("advisor fixtures against qone-advisor-api.yaml", () => {
  it("the conversation and its messages match their schemas and pages", () => {
    expectValid(advisor.schema("Conversation"), advisorFixtures.conversation, "conversation");
    expectValid(advisor.response("get", "/advisor/conversations/me", 200), advisorFixtures.paginate([advisorFixtures.conversation], 1, 20), "conversations page");
    for (const m of advisorFixtures.messages) expectValid(advisor.schema("Message"), m, `message ${m.id}`);
    expectValid(advisor.response("get", "/advisor/conversations/{id}/messages", 200), advisorFixtures.paginate(advisorFixtures.messages, 1, 20), "messages page");
  });

  it("a proposed plan, the reply that carries it and its confirmation match", () => {
    const plan = advisorFixtures.planFor(advisorFixtures.conversation.id, advisorFixtures.students.laura.id, "2026-10-12T15:00:00Z");
    expectValid(advisor.schema("Plan"), plan, "plan");
    expect(plan.expiresAt).toBe("2026-10-12T15:10:00Z");
    expectValid(advisor.response("post", "/advisor/conversations/{id}/messages", 201), { message: advisorFixtures.messages[1], plan, degraded: false }, "reply");
    expectValid(advisor.response("post", "/advisor/conversations/{id}/messages", 201), { message: advisorFixtures.messages[1], plan: null, degraded: true }, "degraded reply");
    const confirmed = { ...plan, status: "EXECUTED", confirmationId: crypto.randomUUID(), sagaId: crypto.randomUUID() };
    expectValid(advisor.response("post", "/advisor/plans/{id}/confirm", 202), { plan: confirmed, sagaId: confirmed.sagaId }, "confirmation");
  });

  it("rejects a plan that drifts from the contract (an unknown status)", () => {
    const plan = { ...advisorFixtures.planFor(advisorFixtures.conversation.id, advisorFixtures.students.laura.id, "2026-10-12T15:00:00Z"), status: "PENDING" };
    expect(advisor.schema("Plan")(plan)).toBe(false);
  });
});
