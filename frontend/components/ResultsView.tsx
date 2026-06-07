"use client";

import { Session, Flag, FlagSeverity } from "@/lib/types";
import { Card, CardTitle } from "@/components/UI";

type Props = {
  session: Session;
};

/* ── Flag colours ── */
const flagDotColor: Record<FlagSeverity, string> = {
  issue: "#f87171",
  warning: "#fbbf24",
  info: "#38bdf8",
};

const flagBgColor: Record<FlagSeverity, string> = {
  issue: "bg-red-500/10 border-red-500/15",
  warning: "bg-amber-500/10 border-amber-500/15",
  info: "bg-ocean-light/10 border-ocean-light/15",
};

/* ── Priority badge colours ── */
const priorityColor: Record<number, string> = {
  1: "bg-red-500/20 text-red-400",
  2: "bg-amber-500/20 text-amber-400",
  3: "bg-ocean-light/15 text-ocean-light",
};

/* ── Metric bar ── */
function MetricBar({
  label,
  value,
  max = 120,
  color = "#0e7490",
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-white/60 w-[108px] flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-[4px] bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[12px] text-white/45 w-9 text-right flex-shrink-0">
        {Math.round(value)}°
      </span>
    </div>
  );
}

/* ── Flag card — horizontal pill ── */
function FlagCard({ flag }: { flag: Flag }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${flagBgColor[flag.severity]}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: flagDotColor[flag.severity] }}
      />
      <p className="text-[12px] text-white/65 leading-snug flex-1">
        {flag.message}
      </p>
      {flag.pct_frames != null && (
        <span className="text-[11px] text-white/30 flex-shrink-0 tabular-nums">
          {Math.round(flag.pct_frames * 100)}% of frames
        </span>
      )}
    </div>
  );
}

export default function ResultsView({ session }: Props) {
  const { analysis, critique } = session;
  if (!analysis || !critique) return null;

  const m = analysis.metrics;
  const issues = analysis.flags.filter((f) => f.severity === "issue");
  const warnings = analysis.flags.filter((f) => f.severity === "warning");
  const infos = analysis.flags.filter((f) => f.severity === "info");
  const orderedFlags = [...issues, ...warnings, ...infos];

  return (
    <div className="space-y-5">
      {/* ── Focus banner ── */}
      {critique.one_thing && (
        <div className="rounded-2xl border border-coral/20 bg-gradient-to-br from-coral/10 to-amber-500/5 p-5">
          <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-coral mb-2">
            Focus for next session
          </p>
          <p
            className="font-serif text-[18px] text-white leading-snug italic"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {critique.one_thing}
          </p>
        </div>
      )}

      {/* ── Claude coaching notes ── */}
      <Card>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 bg-coral/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1L1.5 13h11L7 1z"
                stroke="#f97316"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-[11px] font-medium tracking-[0.07em] uppercase text-white/40">
            Coaching notes
          </span>
        </div>
        <p
          className="font-serif text-[17px] text-white/75 leading-relaxed italic"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          &ldquo;{critique.overall}&rdquo;
        </p>

        {/* Positives */}
        {critique.positives?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {critique.positives.map((pos, i) => (
              <span
                key={i}
                className="bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-3 py-1 text-[12px]"
              >
                ✓ {pos}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ── Biomechanics ── */}
      <Card>
        <CardTitle>Biomechanics</CardTitle>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {m.knee_bend_left?.mean != null && (
            <MetricBar label="Knee bend L" value={m.knee_bend_left.mean} color="#0e7490" />
          )}
          {m.knee_bend_right?.mean != null && (
            <MetricBar label="Knee bend R" value={m.knee_bend_right.mean} color="#0e7490" />
          )}
          {m.hip_hinge?.mean != null && (
            <MetricBar label="Hip hinge" value={m.hip_hinge.mean} color="#d97706" />
          )}
          {m.shoulder_rotation?.mean != null && (
            <MetricBar label="Shoulder rot." value={m.shoulder_rotation.mean} color="#22c55e" />
          )}
        </div>
        {m.frames_analysed != null && m.total_frames != null && (
          <p className="text-[11px] text-white/25 mt-4">
            {m.frames_analysed} / {m.total_frames} frames analysed
          </p>
        )}
      </Card>

      {/* ── Flags ── */}
      {orderedFlags.length > 0 && (
        <Card>
          <CardTitle>
            Flags
            <span className="ml-1 text-white/25">({orderedFlags.length})</span>
          </CardTitle>
          <div className="space-y-2">
            {orderedFlags.map((flag, i) => (
              <FlagCard key={i} flag={flag} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Prioritised tips ── */}
      {critique.tips?.length > 0 && (
        <Card>
          <CardTitle>Prioritised tips</CardTitle>
          <div className="space-y-4">
            {[...critique.tips]
              .sort((a, b) => a.priority - b.priority)
              .map((tip) => (
                <div key={tip.priority} className="flex gap-3 items-start">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-medium ${
                      priorityColor[tip.priority] ?? "bg-white/10 text-white/50"
                    }`}
                  >
                    {tip.priority}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white mb-1">
                      {tip.title}
                    </p>
                    <p className="text-[12px] text-white/45 leading-relaxed">
                      {tip.detail}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}