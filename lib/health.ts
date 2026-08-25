export type HealthPayload = {
  service: "needle";
  status: "ok" | "degraded";
  database: "ok" | "missing" | "error";
  schemaVersion: string | null;
};

export function buildHealthPayload(
  database: HealthPayload["database"],
  schemaVersion: string | null,
): HealthPayload {
  return {
    service: "needle",
    status: database === "ok" ? "ok" : "degraded",
    database,
    schemaVersion,
  };
}
