"use client";

import { useEffect, useState, useRef, DragEvent, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Nav } from "@/components/UI";
import TrialSteps from "@/components/TrialSteps";
import RideContextPicker, { WaveDirection, Stance } from "@/components/RideContextPicker";

const BUCKET = "surf-videos";

type ValidState =
  | { phase: "loading" }
  | { phase: "valid"; name: string }
  | { phase: "invalid"; reason: "invalid" | "used" | "expired" };

export default function TrialUpload() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [state, setState] = useState<ValidState>({ phase: "loading" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [waveDirection, setWaveDirection] = useState<WaveDirection | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/trial/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) =>
        d.valid
          ? setState({ phase: "valid", name: d.name })
          : setState({ phase: "invalid", reason: d.reason })
      )
      .catch(() => setState({ phase: "invalid", reason: "invalid" }));
  }, [token]);

  const validateAndSet = (f: File) => {
    setError(null);
    if (!f.type.startsWith("video/")) return setError("Please upload a video file (MP4, MOV, AVI).");
    if (f.size > 500 * 1024 * 1024) return setError("File must be under 500 MB.");
    setFile(f);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndSet(picked);
  };

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const ext = file.name.split(".").pop() ?? "mp4";

      // 1. Ask the server for a signed upload URL (re-validates the token).
      const urlRes = await fetch("/api/trial/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ext }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error ?? "Could not start upload.");

      // Fake progress — Supabase JS doesn't surface upload progress.
      const tick = setInterval(() => setProgress((p) => Math.min(p + 8, 85)), 200);

      // 2. Upload straight to storage using the signed token (no auth needed).
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(urlData.path, urlData.token, file);
      clearInterval(tick);
      if (uploadError) throw uploadError;
      setProgress(92);

      // 3. Claim the trial (atomic), create the session, kick off analysis.
      const completeRes = await fetch("/api/trial/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, path: urlData.path, wave_direction: waveDirection, stance }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error ?? "Could not start analysis.");

      setProgress(100);
      router.push(`/trial/result/${completeData.sessionId}?token=${encodeURIComponent(token)}`);
    } catch (err: unknown) {
      console.error("Trial upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #020c1b 0%, #0a1628 50%, #060d1a 100%)" }}
    >
      <Nav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <TrialSteps current={3} />

        {state.phase === "loading" && (
          <div className="text-center">
            <div className="w-9 h-9 border-2 border-ocean-light/30 border-t-ocean-light rounded-full spin mx-auto mb-4" />
            <p className="text-white/50 text-sm">Checking your trial link…</p>
          </div>
        )}

        {state.phase === "invalid" && (
          <div className="w-full max-w-md text-center">
            <h1 className="font-serif text-white text-[34px] tracking-tight mb-3" style={{ fontFamily: "var(--font-serif)" }}>
              {state.reason === "used" ? "This link's been used." : state.reason === "expired" ? "This link has expired." : "Invalid link."}
            </h1>
            <p className="text-white/50 text-[15px] mb-7 leading-relaxed">
              {state.reason === "used"
                ? "Your free trial allows one upload, and it's already been claimed."
                : state.reason === "expired"
                ? "Trial links are valid for 48 hours. Request a fresh one to keep going."
                : "We couldn't find that trial link. Try requesting a new one."}
            </p>
            <div className="flex items-center gap-3 justify-center">
              <Link href="/trial" className="bg-ocean-light text-ocean-deep font-medium text-[15px] px-7 py-3.5 rounded-xl hover:bg-ocean-hover transition-all no-underline">
                Request a new link
              </Link>
              <Link href="/pricing" className="text-white/60 border border-white/20 text-[15px] px-6 py-3.5 rounded-xl hover:text-white hover:border-white/40 transition-all no-underline">
                See plans
              </Link>
            </div>
          </div>
        )}

        {state.phase === "valid" && (
          <div className="w-full max-w-2xl">
            <h1
              className="font-serif text-white text-center leading-[1.05] tracking-[-0.04em] mb-3"
              style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(32px, 5vw, 50px)" }}
            >
              Welcome{state.name ? `, ${state.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="text-white/55 text-center text-[16px] mb-9">
              Upload one surf clip and we&rsquo;ll break it down. This is your single free analysis.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => !uploading && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-[20px] border-[1.5px] border-dashed p-14 text-center cursor-pointer transition-all duration-300 select-none ${
                isDragging
                  ? "border-ocean-light/70 bg-ocean-teal/15 -translate-y-0.5"
                  : file
                  ? "border-ocean-light/40 bg-ocean-teal/8"
                  : "border-ocean-light/25 bg-ocean-teal/5 hover:border-ocean-light/50 hover:bg-ocean-teal/10 hover:-translate-y-0.5"
              }`}
            >
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleChange} disabled={uploading} />
              <div className="w-16 h-16 rounded-2xl bg-ocean-teal/20 flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  {file ? (
                    <path d="M6 14l5 5 11-11" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M14 5v12M9 10l5-5 5 5" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </div>
              {file ? (
                <>
                  <h3 className="font-serif text-xl text-white mb-1" style={{ fontFamily: "var(--font-serif)" }}>{file.name}</h3>
                  <p className="text-sm text-white/40 mb-1">{formatSize(file.size)}</p>
                  {!uploading && (
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-white/30 hover:text-white/60 transition-colors mt-1 underline">
                      Remove
                    </button>
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-serif text-xl text-white mb-2" style={{ fontFamily: "var(--font-serif)" }}>Drag &amp; drop your surf video</h3>
                  <p className="text-sm text-white/40">MP4, MOV, AVI — up to 500 MB · Minimum 15 seconds</p>
                </>
              )}
            </div>

            {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}

            {file && !uploading && (
              <div className="mt-5 bg-white/[0.02] border border-subtle rounded-2xl p-4">
                <p className="text-[12px] text-white/45 mb-3">
                  Optional — helps us read the wave (frontside vs backside).
                </p>
                <RideContextPicker
                  waveDirection={waveDirection}
                  stance={stance}
                  onWaveDirection={setWaveDirection}
                  onStance={setStance}
                />
              </div>
            )}

            {uploading && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>{progress < 90 ? "Uploading…" : "Starting analysis…"}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full bg-ocean-light rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {file && !uploading && (
              <button
                onClick={handleUpload}
                className="w-full mt-5 bg-ocean-light text-ocean-deep font-medium text-base py-3.5 rounded-xl hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5"
              >
                Analyse my session
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
