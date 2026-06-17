"use client";

const STEPS = ["Your details", "Check inbox", "Upload", "Results"];

// Slim progress / step indicator shared across the trial funnel pages.
// `current` is 1-based.
export default function TrialSteps({ current }: { current: number }) {
  return (
    <div className="w-full max-w-md mx-auto mb-10">
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all ${
                    done
                      ? "bg-ocean-light text-ocean-deep"
                      : active
                      ? "bg-ocean-light/20 text-ocean-light border border-ocean-light/50"
                      : "bg-white/5 text-white/30 border border-white/10"
                  }`}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[10px] tracking-wide whitespace-nowrap ${
                    active ? "text-ocean-light" : "text-white/30"
                  }`}
                >
                  {label}
                </span>
              </div>
              {step < STEPS.length && (
                <div
                  className={`flex-1 h-px mx-2 mb-4 ${done ? "bg-ocean-light/50" : "bg-white/10"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
