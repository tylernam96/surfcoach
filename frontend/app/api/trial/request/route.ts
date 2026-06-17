import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTrialEmail } from "@/lib/email";
import { TrialRequestRow } from "@/lib/trial";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (name.length < 1) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }

  // Reuse an existing unused, unexpired request for this email rather than
  // minting a duplicate — resend the same link instead.
  const { data: existing } = await getSupabaseAdmin()
    .from("trial_requests")
    .select("*")
    .eq("email", email)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .maybeSingle();

  let row = existing as TrialRequestRow | null;

  if (!row) {
    const token = randomUUID();
    const { data: inserted, error: insertError } = await getSupabaseAdmin()
      .from("trial_requests")
      .insert({ email, name, token, status: "pending" })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ error: "Could not create trial request." }, { status: 500 });
    }
    row = inserted as TrialRequestRow;
  }

  const link = `${APP_URL}/trial/${row.token}`;

  try {
    await sendTrialEmail(email, name || row.name, link);
  } catch (err) {
    console.error("Trial email send failed:", err);
    return NextResponse.json({ error: "Could not send the trial email. Please try again." }, { status: 502 });
  }

  await getSupabaseAdmin().from("trial_requests").update({ status: "sent" }).eq("id", row.id);

  return NextResponse.json({ ok: true });
}
