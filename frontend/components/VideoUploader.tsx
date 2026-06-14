"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

//console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
//console.log("SUPABASE KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function VideoUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
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

  const validateAndSet = (f: File) => {
    setError(null);
    if (!f.type.startsWith("video/")) {
      setError("Please upload a video file (MP4, MOV, AVI).");
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setError("File must be under 500 MB.");
      return;
    }
    setFile(f);
  };

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(0)} KB`;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `videos/${fileName}`;

      // Simulate progress (Supabase JS client doesn't expose upload progress natively)
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 8, 85));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from("surf-videos")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setProgress(95);

      // Generate a short-lived signed URL just for the backend download
      const { data: signedData, error: signError } = await supabase.storage
        .from("surf-videos")
        .createSignedUrl(filePath, 3600);

      if (signError || !signedData) throw signError;

      // Create session row — store the storage path, not a signed URL.
      // Signed URLs expire; the frontend regenerates them on demand.
      const { data: session, error: dbError } = await supabase
        .from("sessions")
        .insert({
          video_path: filePath,  // e.g. "videos/1234567890-abc123.mp4"
          status: "processing",
        })
        .select()
        .single();

      if (dbError || !session) throw dbError;

      let userId = localStorage.getItem('user_id');
      if (!userId) {
        userId = crypto.randomUUID(); // Generate a valid UUID
        localStorage.setItem('user_id', userId);
}


      // Trigger backend — signed URL is only used for the one-time download
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          video_url: signedData.signedUrl,  // backend uses this to download once
          user_id: userId,
        }),
      });

      setProgress(100);
      router.push(`/session/${session.id}`);
    } catch (err: unknown) {
  console.error("Upload error:", err);
  setError(
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : JSON.stringify(err)
  );
  setUploading(false);
  setProgress(0);
}
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-[20px] border-[1.5px] border-dashed p-16 text-center cursor-pointer
          transition-all duration-300 select-none
          ${isDragging
            ? "border-ocean-light/70 bg-ocean-teal/15 -translate-y-0.5"
            : file
            ? "border-ocean-light/40 bg-ocean-teal/8"
            : "border-ocean-light/25 bg-ocean-teal/5 hover:border-ocean-light/50 hover:bg-ocean-teal/10 hover:-translate-y-0.5"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-ocean-teal/20 flex items-center justify-center mx-auto mb-5">
          {file ? (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M6 14l5 5 11-11"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 5v12M9 10l5-5 5 5"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="4"
                y="20"
                width="20"
                height="3"
                rx="1.5"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                opacity="0.5"
              />
            </svg>
          )}
        </div>

        {file ? (
          <>
            <h3
              className="font-serif text-xl text-white mb-1"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {file.name}
            </h3>
            <p className="text-sm text-white/40 mb-1">{formatSize(file.size)}</p>
            {!uploading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors mt-1 underline"
              >
                Remove
              </button>
            )}
          </>
        ) : (
          <>
            <h3
              className="font-serif text-xl text-white mb-2"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Drag &amp; drop your surf video
            </h3>
            <p className="text-sm text-white/40">
              MP4, MOV, AVI — up to 500 MB · Minimum 15 seconds
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm text-center mt-3">{error}</p>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-white/40 mb-1.5">
            <span>{progress < 90 ? "Uploading…" : "Almost there…"}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-ocean-light rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && !uploading && (
        <button
          onClick={handleUpload}
          className="w-full mt-5 bg-ocean-light text-ocean-deep font-medium text-base py-3.5 rounded-xl hover:bg-ocean-hover transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v8M5 7l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Analyse this session
        </button>
      )}

      {/* Tips */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="flex items-start gap-3 bg-white/[0.02] border border-subtle rounded-2xl p-4">
          <div className="w-9 h-9 flex-shrink-0 bg-coral/10 rounded-xl flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2a6 6 0 100 12A6 6 0 008 2z"
                stroke="#f97316"
                strokeWidth="1.3"
              />
              <path
                d="M8 7.5v3.5M8 6h.01"
                stroke="#f97316"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-white mb-0.5">
              Best angles
            </p>
            <p className="text-[12px] text-white/40 leading-relaxed">
              Side-on or behind gives the clearest skeleton overlay.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-white/[0.02] border border-subtle rounded-2xl p-4">
          <div className="w-9 h-9 flex-shrink-0 bg-ocean-light/10 rounded-xl flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="5.5" stroke="#38bdf8" strokeWidth="1.3" />
              <path
                d="M5.5 8l2 2 3.5-3.5"
                stroke="#38bdf8"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-white mb-0.5">
              One wave at a time
            </p>
            <p className="text-[12px] text-white/40 leading-relaxed">
              Shorter clips give sharper, more targeted feedback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}