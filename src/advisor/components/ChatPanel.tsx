import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { advisorApi } from "../api/advisorApi";
import { failureOf, useRequest } from "../hooks/useRequest";
import { useIdempotencyKey } from "../model/idempotency";
import { MESSAGE_MAX, type Message, type Plan } from "../model/advisor";
import { PlanCard } from "./PlanCard";
import { RequestFailure } from "./RequestFailure";
import { RichText } from "./RichText";
import { useSessionUser } from "./RequireRole";

// What a student may start with. The advisor talks in Spanish (its tools are described in Spanish),
// so the questions are written as a student would ask them. A professor or an admin only gets the
// section listing, so they get the one question it answers.
const SUGGESTIONS: Record<string, readonly string[]> = {
  STUDENT: [
    "¿Cuántos créditos llevo y cuántos me faltan?",
    "¿Qué materias puedo inscribir este semestre?",
    "¿Qué grupos de Sistemas Distribuidos tienen cupo?",
    "Inscríbeme en Teoría de la Computación",
  ],
  PROFESSOR: ["¿Qué grupos se ofrecen este semestre?"],
  ADMIN: ["¿Qué grupos se ofrecen este semestre?"],
};

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function AdvisorAvatar() {
  return (
    <span className="chat-avatar" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        <path d="m12 8 1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5z" />
      </svg>
    </span>
  );
}

// HU-ADV-002: one conversation (AD-04, AD-05), as a chat. The history comes newest first and is
// shown oldest first. A question shows at once with the advisor thinking below it until the reply,
// which may take up to the advisor's budget; meanwhile the person may type, not send. The key of a
// message is kept until it succeeds, so a retry never asks twice; on a failure the question goes
// back to the box. A degraded reply is marked: the rest of Qampus keeps working (D-02).
export function ChatPanel({ conversationId }: { conversationId: string }) {
  const user = useSessionUser();
  const history = useRequest((signal) => advisorApi.messages(conversationId, { limit: 50 }, signal), [conversationId]);
  const [items, setItems] = useState<Message[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [degraded, setDegraded] = useState(false);
  const [text, setText] = useState("");
  const [asking, setAsking] = useState<{ content: string; at: string } | undefined>();
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | undefined>();
  const { key, reset } = useIdempotencyKey("message");
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (history.status === "data") setItems(history.data.data.slice().reverse());
  }, [history]);

  // The newest message, or the advisor thinking, stays in view (the welcome stays at its top).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && (items.length > 0 || asking)) el.scrollTop = el.scrollHeight;
  }, [items, asking, failure]);

  // The box grows with what is typed, up to the height the stylesheet allows.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  async function send(question: string) {
    const content = question.trim();
    if (!content || asking) return;
    setAsking({ content, at: new Date().toISOString() });
    setFailure(undefined);
    setText("");
    try {
      const reply = await advisorApi.send(conversationId, content, key);
      const asked: Message = { id: `${reply.message.id}-question`, conversationId, role: "USER", content, createdAt: reply.message.createdAt };
      setItems((current) => [...current, asked, reply.message]);
      if (reply.plan) setPlans((current) => ({ ...current, [reply.message.id]: reply.plan! }));
      setDegraded(reply.degraded);
      reset();
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      const { traceId, serverMessage } = failureOf(error);
      const message = serverMessage || error.message;
      setFailure(traceId ? { message, traceId } : { message });
      setText((typed) => typed || content);
    } finally {
      setAsking(undefined);
      box.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(text);
    }
  }

  if (history.status === "loading") return <p role="status">Loading the conversation...</p>;
  if (history.status === "error") return <RequestFailure error={history.error} retry={history.retry} />;

  const suggestions = SUGGESTIONS[user?.role ?? ""] ?? [];
  const empty = items.length === 0 && !asking;

  return (
    <section aria-label="Conversation" className="chat">
      <header className="chat-header">
        <AdvisorAvatar />
        <div>
          <strong>Academic advisor</strong>
          <span>{degraded ? "Limited mode right now" : "Answers from your real record"}</span>
        </div>
      </header>
      <div className="chat-scroll" ref={scroller}>
        {empty ? (
          <div className="chat-welcome">
            <AdvisorAvatar />
            <h3>How can I help you?</h3>
            <p>
              Ask about your progress, the subjects you can take, groups with seats or your schedule. I can propose an
              enrollment; nothing happens until you confirm it.
            </p>
            {suggestions.length ? (
              <ul className="suggestions" aria-label="Suggested questions">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => void send(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <ol aria-label="Messages" className="messages">
          {items.map((m) => (
            <li key={m.id} className={m.role === "USER" ? "from-you" : "from-advisor"}>
              {m.role === "USER" ? null : <AdvisorAvatar />}
              <div className="bubble">
                <strong className="visually-hidden">{m.role === "USER" ? "You" : "Advisor"}</strong>
                {m.role === "USER" ? <p>{m.content}</p> : <RichText text={m.content} />}
                {plans[m.id] ? <PlanCard initial={plans[m.id]!} /> : null}
                <time dateTime={m.createdAt}>{timeOf(m.createdAt)}</time>
              </div>
            </li>
          ))}
          {asking ? (
            <li className="from-you">
              <div className="bubble">
                <strong className="visually-hidden">You</strong>
                <p>{asking.content}</p>
                <time dateTime={asking.at}>{timeOf(asking.at)}</time>
              </div>
            </li>
          ) : null}
        </ol>
        {asking ? (
          <div className="thinking" role="status" aria-label="The advisor is thinking">
            <AdvisorAvatar />
            <div className="bubble">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>Thinking...</span>
            </div>
          </div>
        ) : null}
        {failure ? (
          <div role="alert">
            <p>{failure.message}</p>
            {failure.traceId ? <p>Reference: {failure.traceId}</p> : null}
          </div>
        ) : null}
      </div>
      {degraded ? (
        <p role="status" aria-label="Advisor unavailable">
          The advisor is answering in limited mode right now. Enrollment, the pensum and payments keep working from their pages.
        </p>
      ) : null}
      <form onSubmit={onSubmit} aria-label="Ask the advisor" className="composer">
        <label htmlFor="advisor-question" className="visually-hidden">
          Your question
        </label>
        <textarea
          ref={box}
          id="advisor-question"
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask the advisor..."
          rows={1}
        />
        <button type="submit" aria-label="Send" title="Send" disabled={Boolean(asking) || !text.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
      <p className="composer-hint">Enter to send, Shift+Enter for a new line.</p>
    </section>
  );
}
