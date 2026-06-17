"use client";

import { useState } from "react";
import { Segments, Turn } from "@/lib/types";
import { Card, CardTitle } from "@/components/UI";

/* ── Score → colour (1–100) ── */
function scoreColor(v: number): string {
  if (v >= 80) return "#4ade80";
  if (v >= 60) return "#38bdf8";
  if (v >= 40) return "#fbbf24";
  return "#f87171";
}

const turnTypeColor: Record<string, string> = {
  "Bottom turn": "#38bdf8",
  "Top turn": "#f97316",
  Cutback: "#a78bfa",
};
function turnColor(type: string): string {
  return turnTypeColor[type] ?? "#4ade80";
}

type Props = {
  segments: Segments;
  /** Play just this turn's window in the video player. */
  onPlayTurn: (start: number, end: number) => void;
  /** Jump the playhead to a timestamp (used for dead-time stalls). */
  onSeek: (time: number) => void;
};

/* ── A single expandable turn row ── */
function TurnRow({
  turn,
  onPlay,
}: {
  turn: Turn;
  onPlay: () => void;
}) {
  const [open, setOpen] = useState(false);
  const color = scoreColor(turn.value);
  const accent = turnColor(turn.type);

  return (
    <div className="rounded-xl border border-subtle bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
          style={{ background: `${accent}22`, color: accent }}
        >
          {turn.index}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-white leading-tight">
            {turn.type}
            <span className="text-white/30 font-normal ml-1.5 text-[11px] tabular-nums">
              {turn.start_s.toFixed(1)}–{turn.end_s.toFixed(1)}s
            </span>
          </p>
          <p className="text-[11.5px] text-white/45 leading-tight mt-0.5 truncate">
            {turn.summary}
          </p>
        </div>

        <span
          className="text-[15px] font-semibold tabular-nums flex-shrink-0"
          style={{ color }}
        >
          {turn.value}
        </span>

        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`flex-shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-0.5 space-y-3">
          <p className="text-[12px] text-white/55 leading-relaxed">{turn.note}</p>
          <button
            onClick={onPlay}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ocean-light/15 text-ocean-light border border-ocean-light/25 px-3 py-1.5 text-[11.5px] font-medium hover:bg-ocean-light/25 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 1l7 4-7 4V1z" fill="currentColor" />
            </svg>
            Watch this turn
          </button>
        </div>
      )}
    </div>
  );
}

export default function TurnBreakdown({ segments, onPlayTurn, onSeek }: Props) {
  if (!segments?.available) return null;

  const { popup, turns, timing } = segments;
  const hasTurns = turns.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Pop-up / takeoff ── */}
      {popup?.detected && (
        <Card>
          <div className="flex items-baseline justify-between mb-2">
            <CardTitle>Pop-up</CardTitle>
            <span
              className="text-[15px] font-semibold tabular-nums"
              style={{ color: scoreColor(popup.value) }}
            >
              {popup.value}
            </span>
          </div>
          <p className="text-[13px] font-medium text-white mb-1">{popup.summary}</p>
          <p className="text-[12px] text-white/50 leading-relaxed">{popup.note}</p>
          <div className="flex gap-5 mt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/35">Time to feet</p>
              <p className="text-[15px] text-white tabular-nums">{popup.time_to_feet_s}s</p>
            </div>
            {popup.first_compression_knee != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/35">First compression</p>
                <p className="text-[15px] text-white tabular-nums">{popup.first_compression_knee}°</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Per-turn breakdown ── */}
      {hasTurns && (
        <Card>
          <div className="flex items-baseline justify-between mb-1">
            <CardTitle>
              Turn-by-turn
              <span className="ml-1 text-white/25">({turns.length})</span>
            </CardTitle>
          </div>
          <p className="text-[11px] text-white/35 mb-3 leading-relaxed">
            Each turn scored individually. Types are estimated from your position on the wave. Tap a turn to expand, then watch it back.
          </p>
          <div className="space-y-2">
            {turns.map((t) => (
              <TurnRow key={t.index} turn={t} onPlay={() => onPlayTurn(t.start_s, t.end_s)} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Timing / linking ── */}
      <Card>
        <CardTitle>Timing &amp; linking</CardTitle>
        <p className="text-[13px] text-white/65 leading-relaxed mt-1">{timing.summary}</p>

        <div className="flex gap-5 mt-3">
          {timing.avg_gap_s != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/35">Avg gap</p>
              <p className="text-[15px] text-white tabular-nums">{timing.avg_gap_s}s</p>
            </div>
          )}
          {timing.rhythm_consistency != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/35">Rhythm</p>
              <p
                className="text-[15px] tabular-nums font-semibold"
                style={{ color: scoreColor(timing.rhythm_consistency) }}
              >
                {timing.rhythm_consistency}
              </p>
            </div>
          )}
        </div>

        {/* Dead / static stretches — click to jump there */}
        {timing.dead_segments.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-white/35 mb-2">
              Stalls ({timing.dead_segments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {timing.dead_segments.map((d, i) => (
                <button
                  key={i}
                  onClick={() => onSeek(d.start_s)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 text-[11px] tabular-nums hover:bg-amber-500/20 transition-colors"
                  title="Jump to this stall"
                >
                  {d.start_s.toFixed(1)}s · {d.duration_s.toFixed(1)}s still
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
