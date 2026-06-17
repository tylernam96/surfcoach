import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "surf-videos";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
const DOWNLOAD_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    path?: string;
    wave_direction?: "left" | "right" | null;
    stance?: "regular" | "goofy" | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token, path, wave_direction = null, stance = null } = body;
  if (!token || !path) {
    return NextResponse.json({ error: "Missing token or path." }, { status: 400 });
  }

  // ── Atomic one-video guard ──────────────────────────────────────────────
  // A single UPDATE … WHERE used_at IS NULL claims the trial. Concurrent
  // requests race on the same row; only one matches and gets a row back.
  const { data: claimed, error: claimError } = await getSupabaseAdmin()
    .from("trial_requests")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();

  if (claimError || !claimed) {
    return NextResponse.json(
      { error: "This trial link has already been used or has expired." },
      { status: 403 }
    );
  }

  const sessionId = randomUUID();
  const trialUserId = randomUUID(); // synthetic; trial sessions have no real account

  // Create the session row with the trial markers the backend won't set itself.
  const { error: sessionError } = await getSupabaseAdmin().from("sessions").insert({
    id: sessionId,
    user_id: trialUserId,
    video_path: path,
    status: "processing",
    is_trial: true,
    trial_request_id: claimed.id,
  });

  if (sessionError) {
    // Roll back the claim so the user can retry.
    await getSupabaseAdmin().from("trial_requests").update({ used_at: null }).eq("id", claimed.id);
    console.error("Trial session insert failed:", sessionError);
    return NextResponse.json({ error: "Could not start analysis. Please try again." }, { status: 500 });
  }

  await getSupabaseAdmin()
    .from("trial_requests")
    .update({ session_id: sessionId })
    .eq("id", claimed.id);

  // Short-lived signed URL the backend uses to download the clip once.
  const { data: signed, error: signError } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .createSignedUrl(path, DOWNLOAD_EXPIRY);

  if (signError || !signed) {
    return NextResponse.json({ error: "Could not access the uploaded video." }, { status: 500 });
  }

  // Kick off analysis (server→server; backend CORS is irrelevant here).
  try {
    const res = await fetch(`${BACKEND_URL}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        video_url: signed.signedUrl,
        user_id: trialUserId,
        wave_direction,
        stance,
      }),
    });
    if (!res.ok) {
      console.error("Backend /analyse error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Backend /analyse request failed:", err);
    // Session row exists in 'processing'; the result page will keep polling.
  }

  return NextResponse.json({ sessionId });
}
