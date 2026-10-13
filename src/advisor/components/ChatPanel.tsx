import { useEffect, useState, type FormEvent } from "react";
import { advisorApi } from "../api/advisorApi";
import { failureOf, useRequest } from "../hooks/useRequest";
import { useIdempotencyKey } from "../model/idempotency";
import { MESSAGE_MAX, type Message, type Plan } from "../model/advisor";
import { PlanCard } from "./PlanCard";
import { RequestFailure } from "./RequestFailure";

// HU-ADV-002: one conversation (AD-04, AD-05). The history comes newest first and is shown
// oldest first; a reply may take up to the advisor's budget, so the form stays disabled and
// says so; the key of a message is kept until it succeeds, so a retry never asks twice. A
// degraded reply is marked: the rest of Qampus keeps working (D-02).
export function ChatPanel({ conversationId }: { conversationId: string }) {
  const history = useRequest((signal) => advisorApi.messages(conversationId, { limit: 50 }, signal), [conversationId]);
  const [items, setItems] = useState<Message[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [degraded, setDegraded] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | undefined>();
  const { key, reset } = useIdempotencyKey("message");

  useEffect(() => {
    if (history.status === "data") setItems(history.data.data.slice().reverse());
  }, [history]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content || pending) return;
    setPending(true);
    setFailure(undefined);
    try {
      const reply = await advisorApi.send(conversationId, content, key);
      const asked: Message = { id: `${reply.message.id}-question`, conversationId, role: "USER", content, createdAt: reply.message.createdAt };
      setItems((current) => [...current, asked, reply.message]);
      if (reply.plan) setPlans((current) => ({ ...current, [reply.message.id]: reply.plan! }));
      setDegraded(reply.degraded);
      setText("");
      reset();
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      const { traceId, serverMessage } = failureOf(error);
      const message = serverMessage || error.message;
      setFailure(traceId ? { message, traceId } : { message });
    } finally {
      setPending(false);
    }
  }

  if (history.status === "loading") return <p role="status">Loading the conversation...</p>;
  if (history.status === "error") return <RequestFailure error={history.error} retry={history.retry} />;

  return (
    <section aria-label="Conversation">
      <ol aria-label="Messages" className="messages">
        {items.length === 0 ? <li>Ask about your degree progress, your schedule or a subject you want to take.</li> : null}
        {items.map((m) => (
          <li key={m.id} className={m.role === "USER" ? "from-you" : "from-advisor"}>
            <strong>{m.role === "USER" ? "You" : "Advisor"}</strong>
            <p>{m.content}</p>
            {plans[m.id] ? <PlanCard initial={plans[m.id]!} /> : null}
          </li>
        ))}
      </ol>
      {degraded ? (
        <p role="status" aria-label="Advisor unavailable">
          The advisor is answering in limited mode right now. Enrollment, the pensum and payments keep working from their pages.
        </p>
      ) : null}
      {failure ? (
        <div role="alert">
          <p>{failure.message}</p>
          {failure.traceId ? <p>Reference: {failure.traceId}</p> : null}
        </div>
      ) : null}
      <form onSubmit={(e) => void send(e)} aria-label="Ask the advisor">
        <label htmlFor="advisor-question">Your question</label>
        <textarea
          id="advisor-question"
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          rows={3}
        />
        <button type="submit" disabled={pending || !text.trim()}>
          {pending ? "The advisor is thinking..." : "Send"}
        </button>
      </form>
    </section>
  );
}
