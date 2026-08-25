import { env } from "cloudflare:workers";

import { buildHealthPayload } from "@/lib/health";

export async function GET() {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM needle_meta WHERE key = ? LIMIT 1",
    )
      .bind("schema_version")
      .first<{ value: string }>();

    if (!row) {
      return Response.json(buildHealthPayload("missing", null), { status: 503 });
    }

    return Response.json(buildHealthPayload("ok", row.value));
  } catch {
    return Response.json(buildHealthPayload("error", null), { status: 503 });
  }
}
