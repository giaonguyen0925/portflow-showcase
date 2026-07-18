type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Structured JSON server logs. Never pass JWTs, R2 secrets, presigned URLs,
 * or full request bodies as fields.
 */
export function logServerEvent(
  level: LogLevel,
  operation: string,
  fields: LogFields = {},
): void {
  const entry = JSON.stringify({
    level,
    operation,
    timestamp: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}
