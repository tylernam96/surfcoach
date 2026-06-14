"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Session } from "@/lib/types";
import { Nav, StatusBadge, SectionLabel, SectionHeading } from "@/components/UI";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    const h = Math.floor(diff / 3600000);
    return h === 0 ? "Just now" : `${h}h ago`;
  }
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatDuration(secs?: number) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-5 bg-white/[0.02] border border-subtle rounded-2xl px-6 py-5">
      <div className="w-[72px] h-12 bg-white/5 shimmer rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/5 shimmer rounded w-1/3" />
        <div className="h-3 bg-white/5 shimmer rounded w-1/4" />
      </div>
      <div className="w-12 h-8 bg-white/5 shimmer rounded-lg" />
    </div>
  );
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSessions(data as Session[]);
    setLoading(false);
  };

  const handleDelete = async (sessionId: string) => {
  if (!confirm("Delete this session? This cannot be undone.")) return;
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (!error) setSessions((prev) => prev.filter((s) => s.id !== sessionId));
};

  useEffect(() => {
    fetchSessions();
    // Poll while any sessions are processing
    const interval = setInterval(() => {
      if (sessions.some((s) => s.status === "processing")) {
        fetchSessions();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [sessions]);

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 60%, #060d1a 100%)" }}
    >
      <Nav />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-12">
          <div>
            <SectionLabel>Dashboard</SectionLabel>
            <SectionHeading className="text-[clamp(32px,4vw,46px)]">
              Your sessions
            </SectionHeading>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-ocean-light text-ocean-deep font-medium text-sm px-5 py-2.5 rounded-xl hover:bg-ocean-hover transition-all no-underline"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v6M4 4l2.5-3L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            New upload
          </Link>
        </div>

        {/* Session list */}
        <div className="space-y-3">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : sessions.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
              <div className="w-14 h-14 bg-ocean-teal/15 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v10M8 9l4-5 4 5" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 18h16" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="font-serif text-xl text-white/60 mb-2" style={{ fontFamily: "var(--font-serif)" }}>
                No sessions yet
              </p>
              <p className="text-sm text-white/30 mb-6">Upload your first surf clip to get started.</p>
              <Link href="/" className="text-sm text-ocean-light hover:text-ocean-hover transition-colors no-underline">
                Upload a session →
              </Link>
            </div>
          ) : (
sessions.map((session) => (
  <div
    key={session.id}
    className="flex items-center border border-subtle rounded-2xl hover:border-ocean-light/20 hover:translate-x-1 transition-all group overflow-hidden"
    style={{ background: "rgba(255,255,255,0.03)" }}
  >
    <Link
      href={`/session/${session.id}`}
      className="flex items-center gap-5 flex-1 min-w-0 px-6 py-4 no-underline"
    >
      {/* Thumbnail */}
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ width: 72, height: 48, background: "linear-gradient(135deg, #0c2a4a, #060d1a)" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" opacity="0.4">
          <path d="M3 12c1.5-4 3.5-2 6-5 2.5-3 4.5-1 6-4" stroke="#38bdf8" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-white mb-1 truncate">
          {session.label ?? `Session ${session.id.slice(0, 8)}`}
        </p>
        <div className="flex items-center gap-3 text-[12px] text-white/40">
          <span>{formatDate(session.created_at)}</span>
          {formatDuration(session.duration_seconds) && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>{formatDuration(session.duration_seconds)}</span>
            </>
          )}
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <StatusBadge status={session.status} />
        </div>
      </div>

      {/* Arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0"
      >
        <path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>

    {/* Delete */}
    <button
      onClick={() => handleDelete(session.id)}
      title="Delete session"
      className="flex-shrink-0 self-stretch px-4 flex items-center justify-center text-white/0 group-hover:text-white/25 hover:!text-red-400 hover:bg-red-500/10 transition-all border-l border-white/5"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M3 3.5l.75 7.5h6.5L11 3.5M5.5 6v4M8.5 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </div>
))
          )}
        </div>
      </div>
    </main>
  );
}