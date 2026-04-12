import { NextResponse } from "next/server";

/** Used by Railway `healthcheckPath`; must not depend on Supabase or slow I/O. */
export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
