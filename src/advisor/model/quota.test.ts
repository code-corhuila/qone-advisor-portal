import { quotaMessage } from "./quota";

// #53: AD-05 answers 429 TOO_MANY_REQUESTS with Retry-After (seconds) when a student goes over the
// advisor's hourly message quota. The chat tells the student, in the advisor's language, when to try again.
describe("quotaMessage", () => {
  it("rounds the wait up to whole minutes", () => {
    expect(quotaMessage(1200)).toBe("Enviaste muchos mensajes en poco tiempo. Intenta de nuevo en 20 minutos.");
    expect(quotaMessage(61)).toBe("Enviaste muchos mensajes en poco tiempo. Intenta de nuevo en 2 minutos.");
  });

  it("says one minute, in singular, for a minute or less", () => {
    expect(quotaMessage(60)).toBe("Enviaste muchos mensajes en poco tiempo. Intenta de nuevo en 1 minuto.");
    expect(quotaMessage(5)).toBe("Enviaste muchos mensajes en poco tiempo. Intenta de nuevo en 1 minuto.");
    expect(quotaMessage(0)).toBe("Enviaste muchos mensajes en poco tiempo. Intenta de nuevo en 1 minuto.");
  });

  it("still explains the limit when the wait is unknown", () => {
    expect(quotaMessage(undefined)).toBe("Enviaste muchos mensajes en poco tiempo. Intenta de nuevo en unos minutos.");
  });
});
