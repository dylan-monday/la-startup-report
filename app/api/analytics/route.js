import { getAnalytics } from "../../../lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(7, parseInt(searchParams.get("days") || "30")));
  return Response.json(getAnalytics(days));
}
