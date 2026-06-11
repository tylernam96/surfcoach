"use client";

import { useRouter } from "next/navigation";
import { Nav } from "@/components/UI";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$10",
    period: "/month",
    tagline: "Perfect for casual surfers wanting regular feedback.",
    analyses: "5 analyses per month",
    features: [
      "5 video analyses per month",
      "Full biomechanical breakdown",
      "AI coaching report per session",
      "Pose overlay & skeleton tracking",
      "Session history & comparisons",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: "$25",
    period: "/month",
    tagline: "For surfers serious about progression.",
    analyses: "Unlimited analyses",
    features: [
      "Unlimited video analyses",
      "Full biomechanical breakdown",
      "AI coaching report per session",
      "Pose overlay & skeleton tracking",
      "Session history & comparisons",
      "Priority processing",
      "Early access to new metrics",
    ],
    cta: "Get Started",
    highlight: true,
  },
];

export default function Pricing() {
  const router = useRouter();

  const handleSelect = (planId: string) => {
    router.push(`/signup?plan=${planId}`);
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(160deg, #020c1b 0%, #0a1628 50%, #060d1a 100%)",
      }}
    >
      <Nav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        {/* Header */}
        <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-ocean-light mb-4">
          Pricing
        </p>
        <h1
          className="font-serif text-white text-center leading-[1.05] tracking-[-0.04em] mb-4"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(38px, 6vw, 64px)",
          }}
        >
          Simple, honest pricing.
        </h1>
        <p className="text-[16px] font-light text-white/45 text-center max-w-md leading-relaxed mb-16">
          Pick the plan that fits your sessions. Cancel any time.
        </p>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 flex flex-col transition-all duration-200 ${
                plan.highlight
                  ? "border-2 border-ocean-light/50 bg-ocean-teal/10"
                  : "border border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-ocean-light text-ocean-deep text-[11px] font-semibold px-3.5 py-1 rounded-full tracking-[0.04em] uppercase">
                    Most popular
                  </span>
                </div>
              )}

              {/* Plan name & price */}
              <div className="mb-6">
                <p className="text-[13px] font-medium text-white/50 uppercase tracking-[0.08em] mb-3">
                  {plan.name}
                </p>
                <div className="flex items-end gap-1 mb-2">
                  <span
                    className="font-serif text-white leading-none"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "clamp(48px, 6vw, 60px)",
                    }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-white/40 text-[15px] mb-2">{plan.period}</span>
                </div>
                <p className="text-[13px] text-white/40 leading-relaxed">
                  {plan.tagline}
                </p>
              </div>

              {/* Analyses callout */}
              <div
                className={`rounded-xl px-4 py-3 mb-6 text-[13px] font-medium ${
                  plan.highlight
                    ? "bg-ocean-light/15 text-ocean-light"
                    : "bg-white/5 text-white/60"
                }`}
              >
                {plan.analyses}
              </div>

              {/* Feature list */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="flex-shrink-0 mt-0.5"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        fill={plan.highlight ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.05)"}
                      />
                      <path
                        d="M5 8l2 2 4-4"
                        stroke={plan.highlight ? "#38bdf8" : "rgba(255,255,255,0.35)"}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[13px] text-white/55 leading-snug">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSelect(plan.id)}
                className={`w-full py-3.5 rounded-xl font-medium text-[15px] transition-all duration-200 hover:-translate-y-0.5 ${
                  plan.highlight
                    ? "bg-ocean-light text-ocean-deep hover:bg-ocean-hover shadow-lg shadow-ocean-light/20"
                    : "bg-white/8 text-white hover:bg-white/12 border border-white/10"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="text-[12px] text-white/25 text-center mt-10">
          No lock-in. Cancel or change plans any time from your account.
        </p>
      </div>
    </main>
  );
}