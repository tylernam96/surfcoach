// app/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Nav } from "@/components/UI";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends the user back with an access token in the URL hash.
  // We wait for it to be consumed and a session established before allowing
  // the form to submit — otherwise updateUser() would have no auth context.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setSessionReady(true);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError("");

    if (!password || !confirm) {
      setError("Please fill in both fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);

    // Auto-redirect to dashboard after a short delay
    setTimeout(() => router.push("/dashboard"), 2500);
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
          {done ? "Password updated." : "Set new password."}
        </h1>

        <p className="text-[15px] text-white/40 font-light mb-10 text-center max-w-xs">
          {done
            ? "You're good to go. Redirecting you to the dashboard…"
            : "Choose a strong password for your account."}
        </p>

        {!done && (
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 flex flex-col gap-4">
              {/* New password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/35">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
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
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReset()}
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
                  <p className="text-[13px] text-red-400 text-center">{error}</p>
                </div>
              )}

              {/* Not ready yet — session still loading from email link */}
              {!sessionReady && (
                <div className="rounded-xl px-4 py-3 bg-white/5 border border-white/10">
                  <p className="text-[13px] text-white/35 text-center">
                    Verifying your reset link…
                  </p>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleReset}
                disabled={loading || !password || !confirm || !sessionReady}
                className="w-full py-3.5 rounded-xl font-medium text-[15px] bg-ocean-light text-ocean-deep hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}