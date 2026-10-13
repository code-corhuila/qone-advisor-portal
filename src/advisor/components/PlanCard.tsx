import { useState } from "react";
import { advisorApi } from "../api/advisorApi";
import { failureOf } from "../hooks/useRequest";
import { PLAN_STATUS_TEXT, REASON_TEXT, formatSlots, type Plan } from "../model/advisor";

// HU-ADV-003: what the agent proposed, frozen at proposal time, and the only two actions on it.
// Nothing is enrolled until the student presses Confirm (INV-ADV-003); the advisor then starts
// the saga with its own token (D-08). A rejected saga is reported with its reason (scenario 4).
export function PlanCard({ initial }: { initial: Plan }) {
  const [plan, setPlan] = useState(initial);
  const [pending, setPending] = useState<"confirm" | "dismiss" | undefined>();
  const [reason, setReason] = useState<string | undefined>();
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | undefined>();
  const s = plan.summary;

  async function act(action: "confirm" | "dismiss") {
    setPending(action);
    setFailure(undefined);
    try {
      if (action === "dismiss") {
        setPlan(await advisorApi.dismiss(plan.id));
        return;
      }
      const result = await advisorApi.confirm(plan.id);
      setPlan(result.plan);
      if (result.plan.status === "FAILED") {
        const saga = await advisorApi.saga(result.sagaId).catch(() => undefined);
        setReason(saga?.reason ?? undefined);
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      const { traceId, serverMessage, code } = failureOf(error);
      if (code === "INVALID_STATUS_TRANSITION") setPlan(await advisorApi.plan(plan.id).catch(() => plan));
      const message = serverMessage || error.message;
      setFailure(traceId ? { message, traceId } : { message });
    } finally {
      setPending(undefined);
    }
  }

  return (
    <article aria-label={`Plan ${s.subjectCode}`} className="plan-card">
      <h4>
        {s.subjectCode} {s.subjectName}, group {s.groupNumber}
      </h4>
      <dl>
        <dt>Professor</dt>
        <dd>{s.professorName}</dd>
        <dt>Schedule</dt>
        <dd>{formatSlots(s.slots)}</dd>
        <dt>Seats when proposed</dt>
        <dd>{s.seatsAvailable}</dd>
        <dt>Why</dt>
        <dd>{s.reason}</dd>
        <dt>Status</dt>
        <dd>{PLAN_STATUS_TEXT[plan.status]}</dd>
      </dl>
      {plan.status === "PROPOSED" ? (
        <>
          <p>Nothing is enrolled until you confirm. The plan expires at {new Date(plan.expiresAt).toLocaleTimeString()}</p>
          <button type="button" onClick={() => void act("confirm")} disabled={pending !== undefined}>
            {pending === "confirm" ? "Enrolling..." : "Confirm enrollment"}
          </button>
          <button type="button" onClick={() => void act("dismiss")} disabled={pending !== undefined}>
            Dismiss
          </button>
        </>
      ) : null}
      {plan.status === "EXECUTED" ? <p role="status">You are enrolled in {s.subjectCode} group {s.groupNumber}.</p> : null}
      {plan.status === "FAILED" ? (
        <p role="status">The enrollment was rejected{reason ? `: ${REASON_TEXT[reason] ?? reason}` : ""}.</p>
      ) : null}
      {failure ? (
        <div role="alert">
          <p>{failure.message}</p>
          {failure.traceId ? <p>Reference: {failure.traceId}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
