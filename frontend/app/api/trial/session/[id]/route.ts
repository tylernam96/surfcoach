import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "surf-videos";
const EXPIRY = 60 * 60 * 24 * 7; // 7 days

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.nextUrl.searchParams.get("token");
  const sessionId = params.id;

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  // The token must map to this exact session — this is the trial user's auth.
  const { data: trial } = await getSupabaseAdmin()
    .from("trial_requests")
    .select("session_id")
    .eq("token", token)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!trial) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: session, error } = await getSupabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Fresh signed URLs for the video player.
  let videoUrl: string | null = null;
  let annotatedUrl: string | null = null;

  if (session.video_path) {
    const { data } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .createSignedUrl(session.video_path, EXPIRY);
    videoUrl = data?.signedUrl ?? null;
  }
  if (session.annotated_video_path) {
    const { data } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .createSignedUrl(session.annotated_video_path, EXPIRY);
    annotatedUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ session, videoUrl, annotatedUrl });
}
