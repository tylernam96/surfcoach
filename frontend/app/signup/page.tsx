// app/signup/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Nav } from "@/components/UI";

const PLAN_LABELS: Record<string, { name: string; price: string; tagline: string }> = {
  starter: {
    name: "Starter",
    price: "$10/mo",
    tagline: "Perfect for casual surfers wanting regular feedback.",
  },
  unlimited: {
    name: "Unlimited",
    price: "$25/mo",
    tagline: "For surfers serious about progression.",
  },
};

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "starter";
  const planMeta = PLAN_LABELS[plan] ?? PLAN_LABELS.starter;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, userId: data.user?.id, email }),
    });

    const { url, error: stripeError } = await res.json();

    if (stripeError || !url) {
      setError("Payment setup failed. Please try again.");
      setLoading(false);
      return;
    }

    window.location.href = url;
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
          Create Account
        </p>
        <h1
          className="font-serif text-white text-center leading-[1.05] tracking-[-0.04em] mb-4"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(38px, 6vw, 64px)",
          }}
        >
          Start surfing smarter.
        </h1>
        <p className="text-[16px] font-light text-white/45 text-center max-w-md leading-relaxed mb-10">
          Create your account to continue.
        </p>

        {/* Selected plan pill */}
        <div className="flex items-center gap-3 bg-ocean-light/10 border border-ocean-light/20 rounded-full px-5 py-2.5 mb-10">
          <span className="text-[12px] font-medium text-white/40 uppercase tracking-[0.08em]">
            Plan
          </span>
          <span className="w-px h-3 bg-white/15" />
          <span className="text-[13px] font-semibold text-ocean-light">
            {planMeta.name}
          </span>
          <span className="text-[13px] text-white/30">{planMeta.price}</span>
          <button
            onClick={() => router.push("/pricing")}
            className="text-[11px] text-white/25 hover:text-white/50 underline underline-offset-2 transition-colors ml-1"
          >
            Change
          </button>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/35">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/35">
                Password
              </label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
              />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/35">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
                <p className="text-[13px] text-red-400 text-center">{error}</p>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleSignup}
              disabled={loading || !email || !password || !confirmPassword}
              className="w-full py-3.5 rounded-xl font-medium text-[15px] bg-ocean-light text-ocean-deep hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
            >
              {loading ? "Creating account…" : "Create Account & Continue to Payment"}
            </button>
          </div>

          {/* Sign in link */}
          <p className="text-[12px] text-white/25 text-center mt-6">
            Already have an account?{" "}
            <button
              onClick={() => router.push(`/login?plan=${plan}`)}
              className="text-ocean-light hover:underline underline-offset-2 transition-colors"
            >
              Sign in instead
            </button>
          </p>

          {/* Fine print */}
          <p className="text-[11px] text-white/20 text-center mt-4 leading-relaxed max-w-xs mx-auto">
            By creating an account you agree to our Terms of Service and Privacy Policy.
            You won't be charged until the next step.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}