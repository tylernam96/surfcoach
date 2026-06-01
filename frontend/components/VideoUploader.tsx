"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { triggerAnalysis } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

type Stage = "idle" | "uploading" | "queued" | "error";

export default function VideoUploader() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file.");
      return;
    }

    setError(null);
    setStage("uploading");
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to upload a video.");

      const sessionId = uuidv4();
      const storagePath = `uploads/${user.id}/${sessionId}.mp4`;

      // Upload to Supabase Storage
      // Note: Supabase JS v2 doesn't expose upload progress natively,
      // so we fake progress with a timer for UX
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 85));
      }, 300);

      const { error: uploadError } = await supabase.storage
        .from("surf-videos")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setProgress(90);

      // Get a long-lived signed URL for the backend to download
      const { data: signedData, error: signErr } = await supabase.storage
        .from("surf-videos")
        .createSignedUrl(storagePath, 60 * 60); // 1 hour

      if (signErr || !signedData) throw signErr ?? new Error("Could not sign URL");

      setProgress(95);

      // Kick off backend processing
      await triggerAnalysis({
        sessionId,
        videoUrl: signedData.signedUrl,
        userId: user.id,
      });

      setProgress(100);
      setStage("queued");

      // Redirect to session page after brief pause
      setTimeout(() => router.push(`/session/${sessionId}`), 800);
    } catch (err: any) {
      setStage("error");
      setError(err.message ?? "Something went wrong. Please try again.");
    }
  }, [router]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {stage === "idle" || stage === "error" ? (
        <label
          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.893L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <div className="text-center">
              <p className="font-semibold text-gray-700">Drop your surf clip here</p>
              <p className="text-sm mt-1">or click to browse — MP4, MOV up to 500MB</p>
            </div>
          </div>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onInputChange}
          />
        </label>
      ) : null}

      {(stage === "uploading" || stage === "queued") && (
        <div className="w-full space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{stage === "queued" ? "Queued for analysis ✓" : "Uploading..."}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {stage === "queued" && (
            <p className="text-sm text-gray-500 text-center">
              Redirecting to your session…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}