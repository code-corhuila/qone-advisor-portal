import { apiClient, type RequestOptions } from "shell/apiClient";
import {
  CONFIRM_TIMEOUT_MS,
  REPLY_TIMEOUT_MS,
  type AdvisorHealth,
  type ChatReply,
  type Conversation,
  type Message,
  type Page,
  type Plan,
  type PlanConfirmation,
  type SagaOutcome,
} from "../model/advisor";

// Typed calls of qone-advisor-api over the shell's client (Annex H: never fetch). Paths are
// relative; the shell knows the gateway and the token.
const BASE = "/api/v1/advisor";
type PageQuery = { page?: number; limit?: number };
const opts = (options: RequestOptions, signal?: AbortSignal): RequestOptions => (signal ? { ...options, signal } : options);
const id = (value: string) => encodeURIComponent(value);

export const advisorApi = {
  /** AD-01: whether the model is configured (the chat warns when it is not). */
  health: (signal?: AbortSignal) => apiClient.get<AdvisorHealth>(`${BASE}/health`, opts({}, signal)),
  /** AD-02: one Idempotency-Key per intention, reused on retry (norm 5.4.2). */
  startConversation: (idempotencyKey: string) => apiClient.post<Conversation>(`${BASE}/conversations`, undefined, { idempotencyKey }),
  /** AD-03, newest first */
  myConversations: (query: PageQuery = {}, signal?: AbortSignal) =>
    apiClient.get<Page<Conversation>>(`${BASE}/conversations/me`, opts({ query }, signal)),
  /** AD-04, newest first */
  messages: (conversationId: string, query: PageQuery = {}, signal?: AbortSignal) =>
    apiClient.get<Page<Message>>(`${BASE}/conversations/${id(conversationId)}/messages`, opts({ query }, signal)),
  /** AD-05: waits for the agent (up to its 120 s budget); a degraded reply is still a reply. */
  send: (conversationId: string, content: string, idempotencyKey: string) =>
    apiClient.post<ChatReply>(`${BASE}/conversations/${id(conversationId)}/messages`, { content }, { idempotencyKey, timeoutMs: REPLY_TIMEOUT_MS }),
  /** AD-06 */
  plan: (planId: string, signal?: AbortSignal) => apiClient.get<Plan>(`${BASE}/plans/${id(planId)}`, opts({}, signal)),
  /** AD-07: 202 with the saga id; the saga runs before the answer. */
  confirm: (planId: string) => apiClient.post<PlanConfirmation>(`${BASE}/plans/${id(planId)}/confirm`, undefined, { timeoutMs: CONFIRM_TIMEOUT_MS }),
  /** AD-08: a plan in any other state comes back unchanged (D-04). */
  dismiss: (planId: string) => apiClient.post<Plan>(`${BASE}/plans/${id(planId)}/dismiss`),
  /** WF-03 of qone-workflow: the reason of a rejected enrollment, readable by its student. */
  saga: (sagaId: string, signal?: AbortSignal) => apiClient.get<SagaOutcome>(`/api/v1/sagas/${id(sagaId)}`, opts({}, signal)),
};
