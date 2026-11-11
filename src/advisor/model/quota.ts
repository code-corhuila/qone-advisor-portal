// #53: the advisor answers at most a number of messages per student and hour; over it, AD-05
// answers 429 TOO_MANY_REQUESTS with Retry-After in seconds. The chat says so in Spanish, like
// the advisor, with the wait rounded up to whole minutes (unknown when the header did not arrive).
export function quotaMessage(retryAfterSeconds: number | undefined): string {
  const lead = "Enviaste muchos mensajes en poco tiempo.";
  if (retryAfterSeconds === undefined) return `${lead} Intenta de nuevo en unos minutos.`;
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `${lead} Intenta de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
}
