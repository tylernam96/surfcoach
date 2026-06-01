"use client";

import { Session, Flag } from "@/lib/supabase";

const severityConfig = {
  issue:   { bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500",    label: "Issue"   },
  warning: { bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-500",  label: "Watch"   },
  info:    { bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-400",   label: "Note"    },
};

function FlagCard({ flag }: { flag: Flag }) {
  const cfg = severityConfig[flag.severity];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <div className="mt-1.5 flex-shrink-0">
        <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
      </div>
      <div>
        <span className={`text-xs font-semibold uppercase tracking-wider`}>
          {cfg.label} · {Math.round(flag.pct_frames * 100)}% of frames
        </span>
        <p className="mt-0.5 text-sm text-gray-700">{flag.message}</p>
      </div>
    </div>
  );
}

function MetricBar({ label, value, min = 0, max = 180, unit = "°" }: {
  label: string; value: number; min?: number; max?: number; unit?: string;
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value}{unit}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ResultsView({ session }: { session: Session }) {
  const { critique, analysis } = session;
  if (!critique || !analysis) return null;

  const metrics = analysis.metrics as any;

  return (
    <div className="space-y-8">

      {/* One thing box */}
      {critique.one_thing && (
        <div className="bg-blue-600 text-white rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-2">
            Focus for next session
          </p>
          <p className="text-lg font-medium leading-snug">{critique.one_thing}</p>
        </div>
      )}

      {/* Overall */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Session overview</h2>
        <p className="text-gray-600 leading-relaxed">{critique.overall}</p>
      </div>

      {/* Positives */}
      {critique.positives.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">What you did well</h2>
          <ul className="space-y-2">
            {critique.positives.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Coaching tips */}
      {critique.tips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Coaching tips</h2>
          <div className="space-y-4">
            {critique.tips
              .sort((a, b) => a.priority - b.priority)
              .map((tip, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-bold">
                      {tip.priority}
                    </span>
                    <h3 className="font-semibold">{tip.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{tip.detail}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {analysis.flags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Detected issues</h2>
          <div className="space-y-2">
            {analysis.flags.map((flag, i) => (
              <FlagCard key={i} flag={flag} />
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Body metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Knee bend</h3>
              {metrics.knee_bend_left?.mean !== undefined && (
                <MetricBar label="Left knee" value={metrics.knee_bend_left.mean} />
              )}
              {metrics.knee_bend_right?.mean !== undefined && (
                <MetricBar label="Right knee" value={metrics.knee_bend_right.mean} />
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Posture</h3>
              {metrics.hip_hinge?.mean !== undefined && (
                <MetricBar label="Hip hinge" value={metrics.hip_hinge.mean} />
              )}
              {metrics.shoulder_rotation?.mean !== undefined && (
                <MetricBar label="Shoulder rotation" value={metrics.shoulder_rotation.mean} min={0} max={1} unit="" />
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-right">
            Analysed {metrics.frames_analysed} of {metrics.total_frames} frames
          </p>
        </div>
      )}
    </div>
  );
}