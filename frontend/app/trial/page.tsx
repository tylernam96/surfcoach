"use client";

import { useState } from "react";
import { Nav } from "@/components/UI";
import TrialSteps from "@/components/TrialSteps";

export default function TrialLanding() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email.");

    setLoading(true);
    try {
      const res = await fetch("/api/trial/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 50%, #060d1a 100%)" }}
    >
      <Nav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <TrialSteps current={sent ? 2 : 1} />

        {/* Hero */}
        <h1
          className="font-serif text-white text-center leading-[1.05] tracking-[-0.04em] mb-4 max-w-2xl"
          style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(36px, 6vw, 60px)" }}
        >
          {sent ? "Check your inbox." : "Try Surfy free."}
        </h1>
        <p className="text-[16px] font-light text-white/55 max-w-md text-center leading-relaxed mb-10">
          {sent
            ? `We've emailed ${email} a private link to analyse one surf clip. It works for one upload and expires in 48 hours.`
            : "Drop your email and we'll send you a private link to analyse one surf clip — full AI breakdown, no account, no card."}
        </p>

        {sent ? (
          /* ── Success state ── */
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-ocean-light/20 bg-ocean-light/[0.06] p-8 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-ocean-light/15 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7l8 6 8-6" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="#38bdf8" strokeWidth="1.6" />
                </svg>
              </div>
              <p className="text-[14px] text-white/70 leading-relaxed">
                Didn&rsquo;t get it? Check spam, then{" "}
                <button
                  onClick={() => { setSent(false); }}
                  className="text-ocean-light hover:underline underline-offset-2"
                >
                  try again
                </button>
                .
              </p>
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/35">Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/35">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
                  <p className="text-[13px] text-red-400 text-center">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !name || !email}
                className="w-full py-3.5 rounded-xl font-medium text-[15px] bg-ocean-light text-ocean-deep hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
              >
                {loading ? "Sending your link…" : "Email me my trial link"}
              </button>
            </div>
            <p className="text-[11px] text-white/20 text-center mt-4 leading-relaxed max-w-xs mx-auto">
              One free analysis per email. Your link expires 48 hours after we send it.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
