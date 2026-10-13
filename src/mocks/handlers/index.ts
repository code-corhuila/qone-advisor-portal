import { http, HttpResponse } from "msw";
import type { Msw } from "../msw";
import { advisorHandlers } from "./advisor";

// Every handler of the advisor portal, built with the given msw primitives (ADR-009):
// AD-01..AD-08 and the saga read over the fixtures of the seed.
export function createHandlers(msw: Msw) {
  return [...advisorHandlers(msw)];
}

/** The handlers for this portal's own tests (Node server in src/mocks/server.ts). */
export const handlers = createHandlers({ http, HttpResponse });
