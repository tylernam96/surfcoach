import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkTrialToken } from "@/lib/trial";

const BUCKET = "surf-videos";
const ALLOWED_EXT = ["mp4", "mov", "avi", "m4v", "webm"];

export async function POST(req: NextRequest) {
  let body: { token?: string; ext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const check = await checkTrialToken(body.token ?? null);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }

  const ext = (body.ext ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExt = ALLOWED_EXT.includes(ext) ? ext : "mp4";
  const path = `trials/${check.row.token}/${Date.now()}.${safeExt}`;

  const { data, error } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
  }

  // token + path returned so the client can call uploadToSignedUrl, then /complete.
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl });
}
