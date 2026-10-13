import type { Conversation, Message, Page, Plan } from "../../advisor/model/advisor";

// Synthetic data of the advisor domain (ADR-009): the people and sections of the seed (same ids
// as the identity, catalog and enrollment fixtures), one earlier conversation of Laura and a
// plan for ISW-602 group 1. The handlers answer like the advisor: an enrollment request gets a
// plan, anything else a short grounded reply.

export const students = {
  laura: { id: "11111111-1111-4111-8111-111111111111", name: "Laura Gómez" },
  santiago: { id: "11111111-1111-4111-8111-111111111112", name: "Santiago Rojas" },
} as const;

export const ISW_602_G1 = "55555555-5555-4555-8555-555555555510";

export const conversation: Conversation = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
  userId: students.laura.id,
  userRole: "STUDENT",
  model: "gpt-4o-mini",
  createdAt: "2026-10-12T15:00:00Z",
};

export const messages: Message[] = [
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01", conversationId: conversation.id, role: "USER", content: "¿Qué me falta para graduarme?", createdAt: "2026-10-12T15:00:05Z" },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: "Te faltan ISW-602 Teoría de la Computación y ISW-604 Sistemas Distribuidos, entre otras. Llevas 11 de 42 créditos aprobados.",
    createdAt: "2026-10-12T15:00:09Z",
  },
];

export function planFor(conversationId: string, studentId: string, createdAt: string): Plan {
  const expires = new Date(new Date(createdAt).getTime() + 10 * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    id: crypto.randomUUID(),
    conversationId,
    studentId,
    sectionId: ISW_602_G1,
    summary: {
      subjectCode: "ISW-602",
      subjectName: "Teoría de la Computación",
      groupNumber: 1,
      professorName: "Ana Torres",
      slots: [
        { day: "TUE", start: "16:00", end: "18:00" },
        { day: "THU", start: "16:00", end: "18:00" },
      ],
      seatsAvailable: 30,
      reason: "Encaja en tus tardes libres de martes y jueves y no tiene prerrequisitos pendientes.",
    },
    status: "PROPOSED",
    confirmationId: null,
    sagaId: null,
    expiresAt: expires,
    createdAt,
  };
}

export function paginate<T>(rows: readonly T[], page: number, limit: number): Page<T> {
  const start = (page - 1) * limit;
  return { data: rows.slice(start, start + limit), meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } };
}

export const DEGRADED_TEXT =
  "El asesor no está disponible en este momento. Puedes seguir consultando tu pensum, matricular y pagar desde el portal; intenta de nuevo en unos minutos.";

export const advisorFixtures = { conversation, messages, planFor, paginate, students };
