"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Session } from "@/lib/types";
import VideoPlayer, { PlayerHandle } from "@/components/VideoPlayer";
import ResultsView from "@/components/ResultsView";
import TurnBreakdown from "@/components/TurnBreakdown";
import { Nav } from "@/components/UI";
import TrialSteps from "@/components/TrialSteps";

function TrialResult() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const token = searchParams.get("token");

  const [session, setSession] = useState<Session | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const playerRef = useRef<PlayerHandle>(null);

  useEffect(() => {
    if (!id || !token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let active = true;
    const fetchSession = async () => {
      const res = await fetch(`/api/trial/session/${id}?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        if (active) { setNotFound(true); setLoading(false); }
        return;
      }
      const data = await res.json();
      if (!active) return;
      setSession(data.session as Session);
      setVideoUrl(data.videoUrl);
      setAnnotatedUrl(data.annotatedUrl);
      setLoading(false);
    };

    fetchSession();
    const interval = setInterval(() => {
      if (session?.status === "processing" || !session) fetchSession();
    }, 4000);

    return () => { active = false; clearInterval(interval); };
  }, [id, token, session?.status]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-ocean-light/30 border-t-ocean-light rounded-full spin mx-auto mb-5" />
          <p className="text-white/50 text-sm">Loading your analysis…</p>
        </div>
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">We couldn&rsquo;t load this analysis.</p>
          <Link href="/trial" className="text-ocean-light hover:text-ocean-hover text-sm no-underline">
            ← Back to trial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 w-full">
      <TrialSteps current={4} />

      <h1 className="font-serif text-white text-[32px] tracking-tight mb-8" style={{ fontFamily: "var(--font-serif)" }}>
        {session.label ?? "Your Surf Analysis"}
      </h1>

      <div className="grid grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-4 sticky top-6 self-start">
          <VideoPlayer
            ref={playerRef}
            originalUrl={videoUrl}
            annotatedUrl={annotatedUrl}
            segments={session.analysis?.segments ?? null}
          />

          {session.status === "complete" &&
            session.analysis?.segments?.available && (
              <TurnBreakdown
                segments={session.analysis.segments}
                onPlayTurn={(start, end) => playerRef.current?.playRange(start, end)}
                onSeek={(time) => playerRef.current?.seek(time)}
              />
            )}

          {session.status === "processing" && (
            <div className="bg-ocean-light/8 border border-ocean-light/20 rounded-2xl p-6 text-center">
              <div className="w-6 h-6 border-2 border-ocean-light/30 border-t-ocean-light rounded-full spin mx-auto mb-3" />
              <p className="text-ocean-light font-medium text-sm mb-1">Analysing your surf session…</p>
              <p className="text-ocean-light/50 text-xs">Usually takes 30–60 seconds</p>
            </div>
          )}

          {session.status === "error" && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-6">
              <h3 className="text-red-400 font-medium mb-2 text-sm">Analysis failed</h3>
              <p className="text-red-400/70 text-sm">
                {session.error_message ?? "Something went wrong while analysing your clip."}
              </p>
            </div>
          )}
        </div>

        <div>
          {session.status === "complete" && session.analysis && session.critique ? (
            <ResultsView session={session} />
          ) : session.status === "processing" ? (
            <div className="space-y-4">
              {[120, 80, 180, 140].map((h, i) => (
                <div key={i} className="rounded-2xl bg-white/[0.02] border border-subtle shimmer" style={{ height: h }} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Conversion CTA */}
      {session.status === "complete" && (
        <div className="mt-12 rounded-3xl px-10 py-10 text-center" style={{ background: "rgba(8, 18, 38, 0.55)", border: "1px solid rgba(56,189,248,0.18)" }}>
          <h2 className="font-serif text-white text-[26px] tracking-tight mb-2" style={{ fontFamily: "var(--font-serif)" }}>
            Loved your breakdown?
          </h2>
          <p className="text-white/55 text-[15px] mb-6 max-w-md mx-auto">
            Create an account to analyse every session and track your progress against the world&rsquo;s best.
          </p>
          <Link href="/pricing" className="inline-flex items-center gap-2 bg-ocean-light text-ocean-deep font-semibold text-[15px] px-8 py-4 rounded-xl hover:bg-ocean-hover transition-all hover:-translate-y-0.5 no-underline">
            See plans &amp; keep surfing smarter
          </Link>
        </div>
      )}
    </div>
  );
}

export default function TrialResultPage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 60%, #060d1a 100%)" }}>
      <Nav />
      <Suspense fallback={<div className="flex-1" />}>
        <TrialResult />
      </Suspense>
    </main>
  );
}
