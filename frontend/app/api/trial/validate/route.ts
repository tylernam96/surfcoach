import { NextRequest, NextResponse } from "next/server";
import { checkTrialToken } from "@/lib/trial";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const check = await checkTrialToken(token);

  if (!check.valid) {
    return NextResponse.json({ valid: false, reason: check.reason });
  }
  return NextResponse.json({ valid: true, name: check.row.name });
}
