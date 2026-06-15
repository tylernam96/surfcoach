// app/login/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Nav } from "@/components/UI";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
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
          Welcome back.
        </h1>
        <p className="text-[15px] text-white/40 font-light mb-10">
          Sign in to continue to Surfy.
        </p>

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
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-ocean-light/50 transition-colors"
              />
            </div>

            {/* Forgot password */}
            <div className="flex justify-end -mt-1">
              <button
                onClick={() => router.push("/forgot-password")}
                className="text-[11px] text-white/25 hover:text-ocean-light transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
                <p className="text-[13px] text-red-400 text-center">{error}</p>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full py-3.5 rounded-xl font-medium text-[15px] bg-ocean-light text-ocean-deep hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-[12px] text-white/25 text-center mt-6">
            Don&rsquo;t have an account?{" "}
            <button
              onClick={() => router.push("/pricing")}
              className="text-ocean-light hover:underline underline-offset-2 transition-colors"
            >
              Get started
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}