import { http, HttpResponse } from "msw";
import type { Msw } from "../msw";

// Every handler of the advisor portal, built with the given msw primitives (ADR-009). The
// handlers of AD-01..AD-08 arrive with the advisor's client.
export function createHandlers(_msw: Msw) {
  return [];
}

/** The handlers for this portal's own tests (Node server in src/mocks/server.ts). */
export const handlers = createHandlers({ http, HttpResponse });
