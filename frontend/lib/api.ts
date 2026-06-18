const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

export async function triggerAnalysis(params: {
  sessionId: string;
  videoUrl: string;
  userId: string;
}) {
  const res = await fetch(`${BACKEND_URL}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.sessionId,
      video_url: params.videoUrl,
      user_id: params.userId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backend error: ${err}`);
  }

  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${BACKEND_URL}/session/${sessionId}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

import { Analysis, ManualTags } from "@/lib/types";

/**
 * Re-run analysis with rider corrections — takeoff tap, turn relabels, wave
 * trim. `manualTags` is the FULL desired correction set (idempotent). Reuses
 * the stored pose data on the backend — no re-upload, no MediaPipe. Returns the
 * updated analysis (segments + scores).
 */
export async function resegment(params: {
  sessionId: string;
  manualTags: ManualTags;
}): Promise<{ session_id: string; analysis: Analysis }> {
  const res = await fetch(`${BACKEND_URL}/resegment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.sessionId,
      manual_tags: params.manualTags,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resegment failed: ${err}`);
  }
  return res.json();
}