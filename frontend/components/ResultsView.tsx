"use client";

import { useState } from "react";
import { Session, Flag, FlagSeverity, Scores, PillarScore } from "@/lib/types";
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

/* ── Score → colour (1–100) ── */
function scoreColor(v: number): string {
  if (v >= 80) return "#4ade80"; // green  — Excellent
  if (v >= 60) return "#38bdf8"; // ocean  — Good
  if (v >= 40) return "#fbbf24"; // amber  — Needs Work
  return "#f87171"; //               red    — Poor
}

function scoreTextColor(v: number): string {
  if (v >= 80) return "text-green-400";
  if (v >= 60) return "text-ocean-light";
  if (v >= 40) return "text-amber-400";
  return "text-red-400";
}

/* ── Key-insight bullet kinds ── */
type Insight = { kind: "good" | "focus"; text: string };

/* Capitalise the first letter (for context chips like "goofy" → "Goofy"). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Condense a full coaching note into a short lead phrase — fallback for
   sessions scored before the backend emitted a dedicated `summary`. */
function shortSummary(note: string): string {
  if (!note) return "";
  const lead = note.split(/\s*[—–-]\s|(?<=\.)\s/)[0].trim();
  return lead.replace(/[.,;]+$/, "");
}

/* Short headline for a sub-score: prefer the backend's plain-language summary,
   fall back to condensing the detailed note. */
function subLabel(sub: { summary?: string; note: string }): string {
  return sub.summary?.trim() || shortSummary(sub.note);
}

/* Derive 3 overall key insights from the actual sub-scores across every
   pillar — lead with the standout strength, then the biggest focus areas. */
function deriveSurfyInsights(scores: Scores): Insight[] {
  const subs = [
    ...scores.position.breakdown,
    ...scores.power.breakdown,
    ...scores.flow.breakdown,
  ].filter((s) => s.note?.trim());

  if (subs.length === 0) return [];

  const byValueDesc = [...subs].sort((a, b) => b.value - a.value);
  const best = byValueDesc[0];
  const focuses = [...subs].sort((a, b) => a.value - b.value).slice(0, 2);

  const insights: Insight[] = [
    { kind: "good", text: subLabel(best) },
    ...focuses.map((s) => ({ kind: "focus" as const, text: subLabel(s) })),
  ];

  // De-dup in case the standout strength is also one of the two extremes.
  const seen = new Set<string>();
  return insights.filter((i) => i.text && !seen.has(i.text) && seen.add(i.text)).slice(0, 3);
}

function InsightBullet({ insight }: { insight: Insight }) {
  const isGood = insight.kind === "good";
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-[6px] w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: isGood ? "#4ade80" : "#f97316" }}
      />
      <span className="text-[13px] text-white/70 leading-relaxed">{insight.text}</span>
    </li>
  );
}

/* ── Aggregate Surfy Score ring ── */
function SurfyScoreRing({ value, label }: { value: number; label: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = scoreColor(value);

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: 108, height: 108 }}>
        <svg width="108" height="108" viewBox="0 0 108 108" className="-rotate-90">
          <circle
            cx="54"
            cy="54"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
          />
          <circle
            cx="54"
            cy="54"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.9s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[32px] font-semibold tabular-nums leading-none"
            style={{ color }}
          >
            {value}
          </span>
          <span className="text-[10px] text-white/35 mt-1">out of 100</span>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-white/40 mb-1.5">
          Surfy Score
        </p>
        <p className={`text-[24px] font-semibold leading-tight ${scoreTextColor(value)}`}>
          {label}
        </p>
        <p className="text-[12px] text-white/40 mt-1 max-w-[200px] leading-relaxed">
          Overall rating across position, power and flow.
        </p>
      </div>
    </div>
  );
}

/* ── Sub-score row (detailed view) ── */
function SubScoreRow({
  name,
  value,
  note,
}: {
  name: string;
  value: number;
  note: string;
}) {
  const color = scoreColor(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-white/70 flex-1">{name}</span>
        <span
          className="text-[13px] font-medium tabular-nums w-8 text-right"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      <div className="h-[4px] bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <p className="text-[11.5px] text-white/40 leading-relaxed">{note}</p>
    </div>
  );
}

/* ── Pillar score card ── */
function PillarCard({
  title,
  pillar,
}: {
  title: string;
  pillar: PillarScore;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const color = scoreColor(pillar.value);

  // Curated bullets: a short one-liner per sub-score (up to 3).
  const bullets = pillar.breakdown
    .map((sub) => subLabel(sub))
    .filter((label): label is string => !!label)
    .slice(0, 3);

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-baseline gap-2">
          <span
            className="text-[28px] font-semibold tabular-nums leading-none"
            style={{ color }}
          >
            {pillar.value}
          </span>
          <span className={`text-[12px] font-medium ${scoreTextColor(pillar.value)}`}>
            {pillar.label}
          </span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {bullets.map((note, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className="mt-[6px] w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span className="text-[13px] text-white/70 leading-relaxed">{note}</span>
          </li>
        ))}
      </ul>

      {pillar.breakdown.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDetail((s) => !s)}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-ocean-light/80 hover:text-ocean-light transition-colors"
          >
            {showDetail ? "Hide details" : "View details"}
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform ${showDetail ? "rotate-180" : ""}`}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {showDetail && (
            <div className="mt-4 pt-4 border-t border-white/8 space-y-4">
              {pillar.breakdown.map((sub, i) => (
                <SubScoreRow key={i} name={sub.name} value={sub.value} note={sub.note} />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
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

  const scores = analysis.scores;
  const issues = analysis.flags.filter((f) => f.severity === "issue");
  const warnings = analysis.flags.filter((f) => f.severity === "warning");
  const infos = analysis.flags.filter((f) => f.severity === "info");
  const orderedFlags = [...issues, ...warnings, ...infos];

  const surfyInsights = scores ? deriveSurfyInsights(scores) : [];

  const ctx = analysis.context;
  const ctxChips = [
    ctx?.stance && cap(ctx.stance),
    ctx?.wave_direction && `${cap(ctx.wave_direction)} wave`,
    ctx?.facing && cap(ctx.facing),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      {/* ── Rider/wave context ── */}
      {ctxChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ctxChips.map((c) => (
            <span
              key={c}
              className="text-[11.5px] text-white/55 bg-white/[0.04] border border-subtle rounded-full px-3 py-1"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* ── Surfy Score + key insights ── */}
      {scores && (
        <Card>
          <SurfyScoreRing value={scores.surfy_score} label={scores.surfy_label} />
          {surfyInsights.length > 0 && (
            <ul className="mt-5 pt-5 border-t border-white/8 space-y-2.5">
              {surfyInsights.map((insight, i) => (
                <InsightBullet key={i} insight={insight} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── Pillar scores ── */}
      {scores && (
        <div className="space-y-5">
          <PillarCard title="Position" pillar={scores.position} />
          <PillarCard title="Power" pillar={scores.power} />
          <PillarCard title="Flow" pillar={scores.flow} />
        </div>
      )}

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
    </div>
  );
}
