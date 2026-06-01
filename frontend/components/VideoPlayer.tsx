"use client";

import { useState } from "react";

type Props = {
  originalUrl: string;
  annotatedUrl: string | null;
};

export default function VideoPlayer({ originalUrl, annotatedUrl }: Props) {
  const [showAnnotated, setShowAnnotated] = useState(false);
  const activeUrl = showAnnotated && annotatedUrl ? annotatedUrl : originalUrl;

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <video
          key={activeUrl}
          src={activeUrl}
          controls
          className="w-full h-full object-contain"
          playsInline
        />
      </div>

      {annotatedUrl && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowAnnotated(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              !showAnnotated
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setShowAnnotated(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAnnotated
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Pose overlay
          </button>
        </div>
      )}
    </div>
  );
}