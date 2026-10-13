import { useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { advisorApi } from "../api/advisorApi";
import { ChatPanel } from "../components/ChatPanel";
import { RequestFailure } from "../components/RequestFailure";
import { RequireRole } from "../components/RequireRole";
import { useMountBase } from "../hooks/useMountBase";
import { failureOf, useRequest } from "../hooks/useRequest";
import { useIdempotencyKey } from "../model/idempotency";

// HU-ADV-002: the person's conversations (AD-03), a new one (AD-02) and the open one. Every
// role talks to the advisor; the tools it gets are chosen by the role, server-side.
export function AdvisorPage() {
  return (
    <RequireRole roles={["STUDENT", "PROFESSOR", "ADMIN"]}>
      <Advisor />
    </RequireRole>
  );
}

function Advisor() {
  const base = useMountBase();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [created, setCreated] = useState(0);
  const conversations = useRequest((signal) => advisorApi.myConversations({ limit: 20 }, signal), [created]);
  const health = useRequest((signal) => advisorApi.health(signal), []);
  const { key, reset } = useIdempotencyKey("conversation");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  async function start() {
    setPending(true);
    setFailure(undefined);
    try {
      const conversation = await advisorApi.startConversation(key);
      reset();
      setCreated((n) => n + 1);
      navigate(`${base}/c/${conversation.id}`);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setFailure(failureOf(error).serverMessage || error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="advisor">
      {health.status === "data" && health.data.llm === "missing" ? (
        <p role="status">The advisor model is not configured in this environment: replies are limited.</p>
      ) : null}
      <aside aria-label="Your conversations">
        <button type="button" onClick={() => void start()} disabled={pending}>
          {pending ? "Starting..." : "New conversation"}
        </button>
        {failure ? <p role="alert">{failure}</p> : null}
        {conversations.status === "loading" ? <p role="status">Loading your conversations...</p> : null}
        {conversations.status === "error" ? <RequestFailure error={conversations.error} retry={conversations.retry} /> : null}
        {conversations.status === "data" ? (
          conversations.data.data.length === 0 ? (
            <p>You have no conversations yet.</p>
          ) : (
            <ul>
              {conversations.data.data.map((c) => (
                <li key={c.id}>
                  <NavLink to={`${base}/c/${c.id}`}>{new Date(c.createdAt).toLocaleString()}</NavLink>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </aside>
      {conversationId ? (
        <ChatPanel key={conversationId} conversationId={conversationId} />
      ) : (
        <p>Open a conversation or start a new one.</p>
      )}
    </div>
  );
}
