import { env } from "cloudflare:workers";

export async function GET() {
  await env.DB.prepare("SELECT COUNT(*) AS total FROM installations").first();
  return Response.json(
    { ok: true, database: "ready" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
