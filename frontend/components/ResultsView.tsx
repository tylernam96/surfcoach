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

/* ── Aggregate Surfy Score ring ── */
function SurfyScoreRing({ value, label }: { value: number; label: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = scoreColor(value);

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="9"
          />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.9s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[38px] font-semibold tabular-nums leading-none"
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
        <p className={`text-[26px] font-semibold leading-tight ${scoreTextColor(value)}`}>
          {label}
        </p>
        <p className="text-[12px] text-white/40 mt-1 max-w-[200px] leading-relaxed">
          Overall rating across position, power and flow.
        </p>
      </div>
    </div>
  );
}

/* ── Sub-score row inside a pillar card ── */
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
  const color = scoreColor(pillar.value);
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
      <div className="space-y-4">
        {pillar.breakdown.map((sub, i) => (
          <SubScoreRow key={i} name={sub.name} value={sub.value} note={sub.note} />
        ))}
      </div>
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

      {/* ── Surfy Score ── */}
      {scores && (
        <Card>
          <SurfyScoreRing value={scores.surfy_score} label={scores.surfy_label} />
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

/* ── Local type mirror (add canonical version to lib/types.ts) ── */
type PillarScore = {
  value: number;
  label: string;
  breakdown: { name: string; value: number; note: string }[];
};