import { advisorApi } from "./advisorApi";
import { reset } from "../../mocks/handlers/advisor";
import { advisorFixtures } from "../../mocks/fixtures/advisor";
import { testSession } from "../../test/shell/session";

const laura = { id: advisorFixtures.students.laura.id, role: "STUDENT" as const, name: "Laura Gómez" };
const santiago = { id: advisorFixtures.students.santiago.id, role: "STUDENT" as const, name: "Santiago Rojas" };

beforeEach(() => {
  reset();
  testSession.signInAs(laura);
});

test("a conversation is created once per key and listed newest first", async () => {
  const first = await advisorApi.startConversation("conversation-key-1");
  const again = await advisorApi.startConversation("conversation-key-1");
  expect(again.id).toBe(first.id);
  const page = await advisorApi.myConversations();
  expect(page.data.map((c) => c.id)).toEqual([first.id, advisorFixtures.conversation.id]);
});

test("asking to enroll returns a proposed plan; the same key returns the same reply", async () => {
  const reply = await advisorApi.send(advisorFixtures.conversation.id, "Matricúlame en Teoría", "message-key-1");
  expect(reply.plan?.status).toBe("PROPOSED");
  const again = await advisorApi.send(advisorFixtures.conversation.id, "otra cosa", "message-key-1");
  expect(again.message.id).toBe(reply.message.id);
  const page = await advisorApi.messages(advisorFixtures.conversation.id);
  expect(page.data[0]?.role).toBe("ASSISTANT");
});

test("confirming answers with the saga id and the settled plan; dismissing it later changes nothing", async () => {
  const { plan } = await advisorApi.send(advisorFixtures.conversation.id, "inscríbeme", "message-key-2");
  const confirmation = await advisorApi.confirm(plan!.id);
  expect(confirmation.plan.status).toBe("EXECUTED");
  expect((await advisorApi.saga(confirmation.sagaId)).status).toBe("COMPLETED");
  expect((await advisorApi.dismiss(plan!.id)).status).toBe("EXECUTED");
  await expect(advisorApi.confirm(plan!.id)).rejects.toMatchObject({ status: 422, code: "INVALID_STATUS_TRANSITION" });
});

test("another student's conversation and plan do not exist", async () => {
  const { plan } = await advisorApi.send(advisorFixtures.conversation.id, "matricúlame", "message-key-3");
  testSession.signInAs(santiago);
  await expect(advisorApi.messages(advisorFixtures.conversation.id)).rejects.toMatchObject({ status: 404 });
  await expect(advisorApi.plan(plan!.id)).rejects.toMatchObject({ status: 404 });
});

test("a degraded reply is still a reply", async () => {
  const reply = await advisorApi.send(advisorFixtures.conversation.id, "degraded please", "message-key-4");
  expect(reply.degraded).toBe(true);
  expect(reply.plan).toBeNull();
});
