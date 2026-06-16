// app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Nav } from "@/components/UI";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: "http://localhost:3000/reset-password",
      }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
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
        <h1
          className="font-serif text-white text-center leading-[1.05] tracking-[-0.04em] mb-3"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(38px, 6vw, 64px)",
          }}
        >
          {sent ? "Check your inbox." : "Forgot password?"}
        </h1>

        <p className="text-[15px] text-white/40 font-light mb-10 text-center max-w-xs">
          {sent
            ? "We sent a reset link to " + email + ". Click it to set a new password."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {!sent && (
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
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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
                onClick={handleSubmit}
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl font-medium text-[15px] bg-ocean-light text-ocean-deep hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </div>

            {/* Back to login */}
            <p className="text-[12px] text-white/25 text-center mt-6">
              Remember it?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-ocean-light hover:underline underline-offset-2 transition-colors"
              >
                Back to sign in
              </button>
            </p>
          </div>
        )}

        {/* Sent state — back to login */}
        {sent && (
          <button
            onClick={() => router.push("/login")}
            className="px-8 py-3.5 rounded-xl font-medium text-[15px] bg-ocean-light text-ocean-deep hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20"
          >
            Back to Sign In
          </button>
        )}
      </div>
    </main>
  );
}