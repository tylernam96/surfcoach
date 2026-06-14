"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Session } from "@/lib/types";
import VideoPlayer from "@/components/VideoPlayer";
import ResultsView from "@/components/ResultsView";
import { Nav } from "@/components/UI";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function LoadingState() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 100%)" }}
    >
      <Nav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-ocean-light/30 border-t-ocean-light rounded-full spin mx-auto mb-5" />
          <p className="text-white/50 text-sm">Loading session…</p>
        </div>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 100%)" }}
    >
      <Nav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Session not found</p>
          <Link href="/dashboard" className="text-ocean-light hover:text-ocean-hover text-sm no-underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SessionPage() {
  const params = useParams();
  const id = params?.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);

  const refreshSignedUrls = async (s: Session) => {
    const EXPIRY = 60 * 60 * 24 * 7; // 7 days
    const path = s.video_path ?? s.video_url;
    const annotatedPath = s.annotated_video_path ?? s.annotated_video_url;

    if (path) {
      const { data } = await supabase.storage.from("surf-videos").createSignedUrl(path, EXPIRY);
      if (data) setVideoUrl(data.signedUrl);
    }
    if (annotatedPath) {
      const { data } = await supabase.storage.from("surf-videos").createSignedUrl(annotatedPath, EXPIRY);
      if (data) setAnnotatedUrl(data.signedUrl);
    }
  };

  const fetchSession = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (!error && data) {
      const s = data as Session;
      setSession(s);
      await refreshSignedUrls(s);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    fetchSession(id);

    const interval = setInterval(() => {
      if (session?.status === "processing") {
        fetchSession(id);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [id, session?.status]);

  if (loading) return <LoadingState />;
  if (!session) return <NotFound />;

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 60%, #060d1a 100%)" }}
    >
      <Nav />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-white/35 hover:text-white/70 text-sm transition-colors no-underline mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to dashboard
        </Link>

        <h1
          className="font-serif text-white text-[32px] tracking-tight mb-8"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {session.label ?? "Session Analysis"}
        </h1>

        {/* Two-column layout: video left, results right */}
        <div className="grid grid-cols-[1fr_380px] gap-6">
          {/* Left: video + processing / error states */}
          <div className="space-y-4">
            <VideoPlayer
              originalUrl={videoUrl}
              annotatedUrl={annotatedUrl}
            />

            {session.status === "processing" && (
              <div className="bg-ocean-light/8 border border-ocean-light/20 rounded-2xl p-6 text-center">
                <div className="w-6 h-6 border-2 border-ocean-light/30 border-t-ocean-light rounded-full spin mx-auto mb-3" />
                <p className="text-ocean-light font-medium text-sm mb-1">
                  Analysing your surf session…
                </p>
                <p className="text-ocean-light/50 text-xs">
                  Usually takes 30–60 seconds
                </p>
              </div>
            )}

            {session.status === "error" && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-6">
                <h3 className="text-red-400 font-medium mb-2 text-sm">
                  Analysis failed
                </h3>
                <p className="text-red-400/70 text-sm mb-4">
                  {session.error_message ??
                    "Something went wrong. Please try again."}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-red-500/20 text-red-400 border border-red-500/30 text-sm px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Right: results sidebar */}
          <div>
            {session.status === "complete" &&
            session.analysis &&
            session.critique ? (
              <ResultsView session={session} />
            ) : session.status === "processing" ? (
              /* Skeleton sidebar while processing */
              <div className="space-y-4">
                {[120, 80, 180, 140].map((h, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white/[0.02] border border-subtle shimmer"
                    style={{ height: h }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}