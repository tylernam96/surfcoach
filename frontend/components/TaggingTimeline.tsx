"use client";

import { useEffect, useRef, useState } from "react";
import { Popup } from "@/lib/types";
import { Card, CardTitle } from "@/components/UI";

type Props = {
  /** Clip duration in seconds (0 until the video metadata loads). */
  duration: number;
  /** Live playhead time from the video player. */
  currentTime: number;
  /** Current pop-up segmentation (auto-detected or previously tapped). */
  popup: Popup | null;
  /** Active wave trim [start_s, end_s], or null when analysing the whole clip. */
  clip: [number, number] | null;
  /** Jump the video playhead to a time. */
  onSeek: (time: number) => void;
  /** Persist the takeoff tap (seconds), or null to clear the manual override. */
  onSaveTakeoff: (takeoffS: number | null) => Promise<void>;
  /** Persist the wave trim, or null to analyse the whole clip again. */
  onSaveClip: (clip: [number, number] | null) => Promise<void>;
};

function fmt(s: number): string {
  return `${s.toFixed(2)}s`;
}

export default function TaggingTimeline({
  duration,
  currentTime,
  popup,
  clip,
  onSeek,
  onSaveTakeoff,
  onSaveClip,
}: Props) {
  const [busy, setBusy] = useState(false);
  const clamp = (t: number) => Math.max(0, Math.min(duration || t, t));
  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TakeoffSection
        duration={duration}
        currentTime={currentTime}
        popup={popup}
        clamp={clamp}
        pct={pct}
        busy={busy}
        onSeek={onSeek}
        onSave={(t) => run(() => onSaveTakeoff(t))}
      />
      <TrimSection
        duration={duration}
        currentTime={currentTime}
        clip={clip}
        clamp={clamp}
        pct={pct}
        busy={busy}
        onSeek={onSeek}
        onSave={(c) => run(() => onSaveClip(c))}
      />
    </>
  );
}

/* ── Shared types for the sub-sections ── */
type Geom = {
  duration: number;
  currentTime: number;
  clamp: (t: number) => number;
  pct: (t: number) => number;
  busy: boolean;
  onSeek: (t: number) => void;
};

/* ── Takeoff (item 4) ── */
function TakeoffSection({
  popup,
  onSave,
  ...g
}: Geom & { popup: Popup | null; onSave: (t: number | null) => void }) {
  const { duration, currentTime, clamp, pct, busy, onSeek } = g;
  const [candidate, setCandidate] = useState<number | null>(null);
  const seededFor = useRef<number | null>(null);

  const existing = popup?.detected ? popup.time_to_feet_s : null;

  useEffect(() => {
    if (existing != null && seededFor.current !== existing && candidate == null) {
      setCandidate(existing);
      seededFor.current = existing;
    }
  }, [existing, candidate]);

  const setAt = (t: number) => {
    const v = clamp(t);
    setCandidate(v);
    onSeek(v);
  };
  const dirty =
    candidate != null && (existing == null || Math.abs(candidate - existing) > 0.01);

  let status: { text: string; tone: "good" | "auto" | "missing" };
  if (popup?.source === "manual") {
    status = { text: `Marked by you — ${fmt(popup.time_to_feet_s)} to your feet`, tone: "good" };
  } else if (popup?.detected) {
    status = {
      text: `Auto-detected ${fmt(popup.time_to_feet_s)} to feet — tap to correct it`,
      tone: "auto",
    };
  } else {
    status = { text: "Takeoff not detected — mark the frame you got to your feet", tone: "missing" };
  }
  const toneColor = { good: "#4ade80", auto: "#38bdf8", missing: "#fbbf24" }[status.tone];

  return (
    <Card>
      <CardTitle>Takeoff</CardTitle>

      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: toneColor }} />
        <p className="text-[12.5px] text-white/65 leading-snug">{status.text}</p>
      </div>

      <p className="text-[11px] text-white/35 leading-relaxed mb-3">
        Detecting the pop-up from pose alone is unreliable, so it&apos;s best-effort.
        Scrub to the exact frame you&apos;re to your feet and mark it — one tap fixes
        your time-to-feet.
      </p>

      <div
        className="relative h-9 rounded-lg bg-white/[0.04] border border-subtle cursor-pointer overflow-hidden"
        onClick={(e) => {
          if (duration <= 0) return;
          const r = e.currentTarget.getBoundingClientRect();
          setAt(((e.clientX - r.left) / r.width) * duration);
        }}
        title="Click to place the takeoff and jump the video there"
      >
        {candidate != null && (
          <div className="absolute inset-y-0 left-0 bg-amber-500/15" style={{ width: `${pct(candidate)}%` }} />
        )}
        <span className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${pct(currentTime)}%` }} />
        {candidate != null && (
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-6 rounded-full"
            style={{ left: `${pct(candidate)}%`, background: "#4ade80" }}
          />
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={() => setCandidate(clamp(currentTime))}
          disabled={duration <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ocean-light/15 text-ocean-light border border-ocean-light/25 px-3 py-1.5 text-[11.5px] font-medium hover:bg-ocean-light/25 transition-colors disabled:opacity-40"
        >
          Mark current frame
        </button>
        <NudgeButtons disabled={candidate == null} onNudge={(d) => setAt((candidate ?? currentTime) + d)} />
        {candidate != null && (
          <span className="text-[12px] text-white/55 tabular-nums">Takeoff at {fmt(candidate)}</span>
        )}
        <div className="flex-1" />
        {popup?.source === "manual" && (
          <button
            onClick={() => onSave(null)}
            disabled={busy}
            className="text-[11.5px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => candidate != null && onSave(candidate)}
          disabled={busy || candidate == null || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 px-3.5 py-1.5 text-[11.5px] font-medium hover:bg-green-500/25 transition-colors disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save takeoff"}
        </button>
      </div>
    </Card>
  );
}

/* ── Trim to one wave (item 6) ── */
function TrimSection({
  clip,
  onSave,
  ...g
}: Geom & { clip: [number, number] | null; onSave: (c: [number, number] | null) => void }) {
  const { duration, currentTime, clamp, pct, busy, onSeek } = g;
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const seeded = useRef(false);

  // Seed handles from the active clip, or default to the full clip once we know
  // the duration.
  useEffect(() => {
    if (seeded.current) return;
    if (clip) {
      setStart(clip[0]);
      setEnd(clip[1]);
      seeded.current = true;
    } else if (duration > 0) {
      setStart(0);
      setEnd(duration);
      seeded.current = true;
    }
  }, [clip, duration]);

  const s = start ?? 0;
  const e = end ?? duration;
  const isFull = s <= 0.01 && Math.abs(e - duration) <= 0.01;
  const matchesActive = clip ? Math.abs(s - clip[0]) < 0.01 && Math.abs(e - clip[1]) < 0.01 : isFull;

  const setStartAt = (t: number) => {
    const v = clamp(Math.min(t, e - 0.2));
    setStart(v);
    onSeek(v);
  };
  const setEndAt = (t: number) => {
    const v = clamp(Math.max(t, s + 0.2));
    setEnd(v);
    onSeek(v);
  };

  return (
    <Card>
      <CardTitle>Trim to one wave</CardTitle>

      <p className="text-[11px] text-white/35 leading-relaxed mb-3">
        Clips often include the paddle-out or a second wave, which inflates the
        &quot;stall&quot; count and skews the scores. Set the wave&apos;s start and end so
        analysis focuses only on the ride.
      </p>

      {/* Track with a highlighted kept region */}
      <div
        className="relative h-9 rounded-lg bg-white/[0.04] border border-subtle cursor-pointer overflow-hidden"
        onClick={(e2) => {
          if (duration <= 0) return;
          const r = e2.currentTarget.getBoundingClientRect();
          const t = ((e2.clientX - r.left) / r.width) * duration;
          // Move whichever handle is nearer the click.
          if (Math.abs(t - s) <= Math.abs(t - e)) setStartAt(t);
          else setEndAt(t);
        }}
        title="Click near a handle to move it"
      >
        {/* Trimmed-out regions dimmed */}
        <div className="absolute inset-y-0 left-0 bg-black/40" style={{ width: `${pct(s)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/40" style={{ left: `${pct(e)}%` }} />
        {/* Kept region */}
        <div
          className="absolute inset-y-0 bg-ocean-light/12 border-x border-ocean-light/40"
          style={{ left: `${pct(s)}%`, width: `${pct(e) - pct(s)}%` }}
        />
        <span className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${pct(currentTime)}%` }} />
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={() => setStartAt(currentTime)}
          disabled={duration <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ocean-light/15 text-ocean-light border border-ocean-light/25 px-3 py-1.5 text-[11.5px] font-medium hover:bg-ocean-light/25 transition-colors disabled:opacity-40"
        >
          Set start
        </button>
        <button
          onClick={() => setEndAt(currentTime)}
          disabled={duration <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ocean-light/15 text-ocean-light border border-ocean-light/25 px-3 py-1.5 text-[11.5px] font-medium hover:bg-ocean-light/25 transition-colors disabled:opacity-40"
        >
          Set end
        </button>
        <span className="text-[12px] text-white/55 tabular-nums">
          {fmt(s)} – {fmt(e)}
        </span>

        <div className="flex-1" />

        {clip && (
          <button
            onClick={() => onSave(null)}
            disabled={busy}
            className="text-[11.5px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => onSave([s, e])}
          disabled={busy || isFull || matchesActive}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 px-3.5 py-1.5 text-[11.5px] font-medium hover:bg-green-500/25 transition-colors disabled:opacity-40"
        >
          {busy ? "Saving…" : "Trim & re-analyse"}
        </button>
      </div>
    </Card>
  );
}

/* ── ±0.1s nudge control ── */
function NudgeButtons({ disabled, onNudge }: { disabled: boolean; onNudge: (d: number) => void }) {
  return (
    <div className="flex bg-white/[0.06] rounded-lg overflow-hidden">
      <button
        onClick={() => onNudge(-0.1)}
        disabled={disabled}
        className="px-2.5 py-1.5 text-[11.5px] text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40 tabular-nums"
        title="Nudge 0.1s earlier"
      >
        −0.1s
      </button>
      <button
        onClick={() => onNudge(0.1)}
        disabled={disabled}
        className="px-2.5 py-1.5 text-[11.5px] text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40 tabular-nums"
        title="Nudge 0.1s later"
      >
        +0.1s
      </button>
    </div>
  );
}
