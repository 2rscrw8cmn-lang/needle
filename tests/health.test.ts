import { describe, expect, it } from "vitest";

import { buildHealthPayload } from "../lib/health";

describe("buildHealthPayload", () => {
  it("reports a healthy D1 binding", () => {
    expect(buildHealthPayload("ok", "0")).toEqual({
      service: "needle",
      status: "ok",
      database: "ok",
      schemaVersion: "0",
    });
  });

  it("degrades when D1 is unavailable", () => {
    expect(buildHealthPayload("error", null).status).toBe("degraded");
  });
});
