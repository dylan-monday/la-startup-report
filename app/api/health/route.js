import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../../../lib/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const anthropic = new Anthropic();

// Lightweight model health check (prototype).
//
// Asks the Anthropic Models API whether the model we call is still served.
// A retired model 404s HERE before it 404s a user's chat request, so hitting
// /api/health (manually, or from an uptime monitor / Vercel Cron) gives an
// early warning. Returns 200 when healthy, 503 when the model is gone.
export async function GET() {
  try {
    const model = await anthropic.models.retrieve(MODEL);
    return Response.json({
      ok: true,
      model: model.id,
      display_name: model.display_name,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    const status = err?.status;
    const retired = status === 404; // model id no longer served
    console.error("[health] model check failed:", status, err?.message);
    return Response.json(
      {
        ok: false,
        model: MODEL,
        retired,
        message: retired
          ? `Model "${MODEL}" is not available — it may have been retired. Update MODEL in lib/model.js and redeploy.`
          : `Health check failed (status ${status ?? "unknown"}): ${err?.message ?? "unknown error"}`,
        checked_at: new Date().toISOString(),
      },
      { status: retired ? 503 : 502 },
    );
  }
}
