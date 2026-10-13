// Types copied from 07-api/contracts/openapi/qone-advisor-api.yaml and _shared.yaml (Annex H:
// the portal's types mirror the contract field by field). The contract test validates the
// fixtures against the YAML; these types keep the compiler honest.

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export type Role = "STUDENT" | "PROFESSOR" | "ADMIN";
export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export interface Slot {
  day: Day;
  start: string;
  end: string;
}

export interface AdvisorHealth {
  status: "ok";
  service: string;
  version?: string;
  llm: "configured" | "missing";
  model?: string | null;
}

export interface Conversation {
  id: string;
  userId: string;
  userRole: Role;
  model: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export type PlanStatus = "PROPOSED" | "EXECUTING" | "EXECUTED" | "FAILED" | "DISMISSED" | "EXPIRED";

export interface PlanSummary {
  subjectCode: string;
  subjectName: string;
  groupNumber: number;
  professorName: string;
  slots: Slot[];
  seatsAvailable: number;
  reason: string;
}

export interface Plan {
  id: string;
  conversationId: string;
  studentId: string;
  sectionId: string;
  summary: PlanSummary;
  status: PlanStatus;
  confirmationId?: string | null;
  sagaId?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ChatReply {
  message: Message;
  plan?: Plan | null;
  degraded: boolean;
}

export interface PlanConfirmation {
  plan: Plan;
  sagaId: string;
}

/** The part of qone-workflow's saga (WF-03) the plan card shows: why an enrollment was rejected. */
export interface SagaOutcome {
  id: string;
  status: "RUNNING" | "COMPLETED" | "COMPENSATED" | "FAILED";
  reason?: string | null;
}

/** The advisor's provider budget is 120 s per reply; the chat waits a little longer than that. */
export const REPLY_TIMEOUT_MS = 130_000;
/** Confirming runs the whole saga (three participants) before it answers. */
export const CONFIRM_TIMEOUT_MS = 60_000;
export const MESSAGE_MAX = 2000;

export const PLAN_STATUS_TEXT: Record<PlanStatus, string> = {
  PROPOSED: "Waiting for your confirmation",
  EXECUTING: "Enrolling...",
  EXECUTED: "Enrolled",
  FAILED: "Not enrolled",
  DISMISSED: "Dismissed",
  EXPIRED: "Expired",
};

export const REASON_TEXT: Record<string, string> = {
  TUITION_UNPAID: "your tuition for the term is not paid",
  PREREQ_MISSING: "a prerequisite is missing",
  SCHEDULE_CONFLICT: "it overlaps a class you already have",
  NO_SEATS: "the group has no seats left",
  DUPLICATE: "you already have that subject this term",
};

const DAY_TEXT: Record<Day, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat" };

export function formatSlots(slots: readonly Slot[]): string {
  return slots.map((s) => `${DAY_TEXT[s.day]} ${s.start}-${s.end}`).join(", ");
}
