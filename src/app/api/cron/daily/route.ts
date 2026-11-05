import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDailyRoutine } from "@/features/billing/cron";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** A Vercel Cron envia o CRON_SECRET no cabeçalho Authorization. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, summary: await runDailyRoutine() });
  } catch {
    return NextResponse.json({ error: "Falha na rotina" }, { status: 500 });
  }
}
