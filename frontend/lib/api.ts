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