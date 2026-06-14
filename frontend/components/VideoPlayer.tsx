"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── MediaPipe types (loaded via CDN script tags) ──────────────────────────────
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

type Props = {
  originalUrl: string | null;
  annotatedUrl?: string | null;
  onVideoError?: () => void;
};

// ── MediaPipe landmark indices ────────────────────────────────────────────────
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,     RIGHT_HEEL: 30,
  LEFT_FOOT: 31,     RIGHT_FOOT: 32,
};

// ── Geometry helpers ──────────────────────────────────────────────────────────
function angle3(a: any, b: any, c: any): number {
  // Angle at point b formed by a-b-c (degrees)
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (magAB * magCB)))) * 180) / Math.PI;
}

function midpoint(a: any, b: any) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── Metric extraction — mirrors pose.py logic ─────────────────────────────────
interface Metrics {
  kneeBendLeft: number | null;
  kneeBendRight: number | null;
  hipHinge: number | null;
  shoulderRotation: number | null;
  stanceWidth: number | null;
  comHeight: number | null;
  confidence: number;
}

function extractMetrics(landmarks: any[]): Metrics {
  const lm = landmarks;
  const get = (i: number) => lm[i];

  const avgVis = (indices: number[]) =>
    indices.reduce((s, i) => s + (lm[i]?.visibility ?? 0), 0) / indices.length;

  const confidence = avgVis([
    LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE,
    LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  ]);

  // Knee bend: angle at knee (hip-knee-ankle)
  const kneeBendLeft =
    avgVis([LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE]) > 0.5
      ? angle3(get(LM.LEFT_HIP), get(LM.LEFT_KNEE), get(LM.LEFT_ANKLE))
      : null;

  const kneeBendRight =
    avgVis([LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]) > 0.5
      ? angle3(get(LM.RIGHT_HIP), get(LM.RIGHT_KNEE), get(LM.RIGHT_ANKLE))
      : null;

  // Hip hinge: angle at hip (shoulder-hip-knee)
  const hipHinge =
    avgVis([LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE]) > 0.5
      ? angle3(get(LM.LEFT_SHOULDER), get(LM.LEFT_HIP), get(LM.LEFT_KNEE))
      : null;

  // Shoulder rotation: difference in shoulder y positions (normalised by shoulder width)
  // Higher value = more rotation. Mirrors pose.py's shoulder_rotation.
  let shoulderRotation: number | null = null;
  if (avgVis([LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]) > 0.5) {
    const ls = get(LM.LEFT_SHOULDER);
    const rs = get(LM.RIGHT_SHOULDER);
    const shoulderWidth = Math.sqrt((ls.x - rs.x) ** 2 + (ls.y - rs.y) ** 2);
    const yDiff = Math.abs(ls.y - rs.y);
    shoulderRotation = shoulderWidth > 0 ? yDiff / shoulderWidth : 0;
  }

  // Stance width: distance between ankles normalised by hip width
  let stanceWidth: number | null = null;
  if (avgVis([LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HIP, LM.RIGHT_HIP]) > 0.5) {
    const la = get(LM.LEFT_ANKLE);
    const ra = get(LM.RIGHT_ANKLE);
    const lh = get(LM.LEFT_HIP);
    const rh = get(LM.RIGHT_HIP);
    const ankleDist = Math.sqrt((la.x - ra.x) ** 2 + (la.y - ra.y) ** 2);
    const hipDist = Math.sqrt((lh.x - rh.x) ** 2 + (lh.y - rh.y) ** 2);
    stanceWidth = hipDist > 0 ? ankleDist / hipDist : null;
  }

  // CoM height: average y of hips (0 = top, 1 = bottom of frame)
  // Invert so higher number = higher body position
  let comHeight: number | null = null;
  if (avgVis([LM.LEFT_HIP, LM.RIGHT_HIP]) > 0.5) {
    const mid = midpoint(get(LM.LEFT_HIP), get(LM.RIGHT_HIP));
    comHeight = 1 - mid.y; // invert y so "higher" = bigger number
  }

  return { kneeBendLeft, kneeBendRight, hipHinge, shoulderRotation, stanceWidth, comHeight, confidence };
}

// ── HUD metric display config ─────────────────────────────────────────────────
interface MetricDisplay {
  label: string;
  value: number | null;
  format: (v: number) => string;
  color: string;
  /** optional: return a status string for color override */
  status?: (v: number) => "good" | "warn" | "bad";
}

function getMetricDisplays(m: Metrics): MetricDisplay[] {
  return [
    {
      label: "Knee L",
      value: m.kneeBendLeft,
      format: (v) => `${Math.round(v)}°`,
      color: "#38bdf8",
      status: (v) => v < 110 ? "warn" : v > 160 ? "bad" : "good",
    },
    {
      label: "Knee R",
      value: m.kneeBendRight,
      format: (v) => `${Math.round(v)}°`,
      color: "#38bdf8",
      status: (v) => v < 110 ? "warn" : v > 160 ? "bad" : "good",
    },
    {
      label: "Hip hinge",
      value: m.hipHinge,
      format: (v) => `${Math.round(v)}°`,
      color: "#fbbf24",
    },
    {
      label: "Shoulder rot.",
      value: m.shoulderRotation,
      format: (v) => `${Math.round(v * 100)}%`,
      color: "#4ade80",
      status: (v) => v < 0.05 ? "warn" : "good",
    },
    {
      label: "Stance",
      value: m.stanceWidth,
      format: (v) => `${v.toFixed(2)}x`,
      color: "#f97316",
      status: (v) => v < 0.8 ? "warn" : v > 2.0 ? "warn" : "good",
    },
    {
      label: "CoM height",
      value: m.comHeight,
      format: (v) => `${Math.round(v * 100)}%`,
      color: "#a78bfa",
    },
  ];
}

const statusColor: Record<string, string> = {
  good: "#4ade80",
  warn: "#fbbf24",
  bad: "#f87171",
};

// ── Canvas drawing ─────────────────────────────────────────────────────────────
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  metrics: Metrics,
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h);

  // Draw skeleton connections manually (MediaPipe drawConnectors needs the full lib)
  const connections = [
    // Torso
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    [LM.LEFT_SHOULDER, LM.LEFT_HIP],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
    [LM.LEFT_HIP, LM.RIGHT_HIP],
    // Left arm
    [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
    [LM.LEFT_ELBOW, LM.LEFT_WRIST],
    // Right arm
    [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
    [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
    // Left leg
    [LM.LEFT_HIP, LM.LEFT_KNEE],
    [LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.LEFT_ANKLE, LM.LEFT_HEEL],
    [LM.LEFT_HEEL, LM.LEFT_FOOT],
    // Right leg
    [LM.RIGHT_HIP, LM.RIGHT_KNEE],
    [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
    [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
    [LM.RIGHT_HEEL, LM.RIGHT_FOOT],
    // Head
    [LM.NOSE, LM.LEFT_SHOULDER],
    [LM.NOSE, LM.RIGHT_SHOULDER],
  ];

  // Skeleton lines
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 6;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  connections.forEach(([a, b]) => {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) return;
    if ((pa.visibility ?? 1) < 0.25 || (pb.visibility ?? 1) < 0.25) return;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    // Colour by body section
    const isLeg = [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE,
      LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HEEL, LM.RIGHT_HEEL,
      LM.LEFT_FOOT, LM.RIGHT_FOOT].includes(a);
    ctx.strokeStyle = isLeg ? "#38bdf8" : "#f97316";
    ctx.stroke();
  });

  // Joint dots
  ctx.shadowBlur = 0;
  landmarks.forEach((lm, i) => {
    if (!lm || (lm.visibility ?? 1) < 0.4) return;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
  });

  // Angle arcs at knee joints
  drawAngleArc(ctx, landmarks, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, w, h, "#38bdf8");
  drawAngleArc(ctx, landmarks, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, w, h, "#38bdf8");

  // CoM dot
  if (metrics.comHeight !== null) {
    const lh = landmarks[LM.LEFT_HIP];
    const rh = landmarks[LM.RIGHT_HIP];
    if (lh && rh) {
      const cx = ((lh.x + rh.x) / 2) * w;
      const cy = ((lh.y + rh.y) / 2) * h;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,139,250,0.35)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#a78bfa";
      ctx.stroke();
    }
  }

  // HUD panel (top-left)
  drawHUD(ctx, metrics, w, h);
}

function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  iA: number, iB: number, iC: number,
  w: number, h: number,
  color: string
) {
  const a = landmarks[iA], b = landmarks[iB], c = landmarks[iC];
  if (!a || !b || !c) return;
  if ((a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4 || (c.visibility ?? 1) < 0.4) return;

  const bx = b.x * w, by = b.y * h;
  const ang = angle3(a, b, c);

  const ax1 = Math.atan2(a.y * h - by, a.x * w - bx);
  const ax2 = Math.atan2(c.y * h - by, c.x * w - bx);

  ctx.beginPath();
  ctx.arc(bx, by, 18, ax1, ax2, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Angle label near joint
  const midAng = (ax1 + ax2) / 2;
  const lx = bx + Math.cos(midAng) * 28;
  const ly = by + Math.sin(midAng) * 28;
  ctx.font = "bold 11px 'SF Mono', monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(ang)}°`, lx, ly);
}

function drawHUD(ctx: CanvasRenderingContext2D, metrics: Metrics, w: number, h: number) {
  const displays = getMetricDisplays(metrics).filter((d) => d.value !== null);
  if (displays.length === 0) return;

  const pad = 10;
  const rowH = 22;
  const panelW = 138;
  const panelH = pad * 2 + displays.length * rowH;
  const x = 10, y = 10;

  // Panel background
  ctx.fillStyle = "rgba(10, 22, 40, 0.72)";
  ctx.beginPath();
  roundRect(ctx, x, y, panelW, panelH, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rows
  displays.forEach((d, i) => {
    const ry = y + pad + i * rowH + rowH / 2;
    const val = d.value!;
    const formatted = d.format(val);
    const color = d.status ? statusColor[d.status(val)] ?? d.color : d.color;

    // Label
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(d.label, x + pad, ry);

    // Value
    ctx.font = "bold 12px 'SF Mono', ui-monospace, monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.fillText(formatted, x + panelW - pad, ry);

    // Dot indicator
    ctx.beginPath();
    ctx.arc(x + panelW - pad - ctx.measureText(formatted).width - 8, ry, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Confidence bar at bottom
  const confY = y + panelH - 6;
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, x + pad, confY, panelW - pad * 2, 3, 1.5);
  ctx.fill();
  const confColor = metrics.confidence > 0.7 ? "#4ade80" : metrics.confidence > 0.4 ? "#fbbf24" : "#f87171";
  ctx.fillStyle = confColor;
  roundRect(ctx, x + pad, confY, (panelW - pad * 2) * metrics.confidence, 3, 1.5);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VideoPlayer({ originalUrl, annotatedUrl, onVideoError }: Props) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [poseReady, setPoseReady] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [currentMetrics, setCurrentMetrics] = useState<Metrics | null>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const processingRef = useRef(false);

  // ── Load MediaPipe scripts ──────────────────────────────────────────────────
  useEffect(() => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
    ];

      if (window.Pose) {
    setScriptsLoaded(true);
    return;
  }

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === scripts.length) setScriptsLoaded(true);
    };

    scripts.forEach((src) => {
      if (window.Pose) {
  setScriptsLoaded(true);
  return;
}
      const s = document.createElement("script");
      s.src = src;
      s.crossOrigin = "anonymous";
      s.onload = () => {
        loaded++;
        if (loaded === scripts.length) setScriptsLoaded(true);
      };
      document.head.appendChild(s);
    });
  }, []);

  // ── Initialise MediaPipe Pose ───────────────────────────────────────────────
  useEffect(() => {
  console.log("=== Pose Effect ===");
  console.log("scriptsLoaded:", scriptsLoaded);
  console.log("window.Pose exists:", !!window.Pose);

  if (!scriptsLoaded || !window.Pose) {
    console.log("Pose effect early return");
    return;
  }

  console.log("Creating Pose instance");

    const pose = new window.Pose({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: false,
      enableSegmentation: false,
      minDetectionConfidence: 0.25,
      minTrackingConfidence: 0.25,
    });

    pose.onResults((results: any) => {
      processingRef.current = false;

        if (results.poseLandmarks) {
    const avgVis = results.poseLandmarks.reduce((s: number, lm: any) => 
      s + (lm.visibility ?? 0), 0) / results.poseLandmarks.length;
    if (avgVis < 0.15) {
      // Let it re-detect next frame naturally
      return;
    }
  }

      if (!canvasRef.current || !videoRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

//      canvas.width = videoRef.current.videoWidth || canvas.offsetWidth;
//      canvas.height = videoRef.current.videoHeight || canvas.offsetHeight;

      if (!overlayEnabled || !results.poseLandmarks) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setCurrentMetrics(null);
        return;
      }

      const metrics = extractMetrics(results.poseLandmarks);
      setCurrentMetrics(metrics);
      drawOverlay(ctx, results.poseLandmarks, metrics, canvas.width, canvas.height);
    });

console.log("scriptsLoaded", scriptsLoaded);
console.log("window.Pose", window.Pose);
console.log("pose", pose);
console.log("initialize", pose.initialize);

    pose.initialize().then(() => {
      console.log("Pose initialized");
      poseRef.current = pose;
      setPoseReady(true);
    })
    ;

    return () => {
      pose.close?.();
    };
  }, [scriptsLoaded]);

  // ── Per-frame processing loop ───────────────────────────────────────────────
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const pose = poseRef.current;
    const canvas = canvasRef.current;

    // CRITICAL: Check if video and canvas have valid dimensions
    if (video && pose && !video.paused && !video.ended && !processingRef.current) {
      // Ensure video has actual dimensions (not loading state)
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        processingRef.current = false;
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Ensure canvas dimensions match video
      if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      processingRef.current = true;
      pose.send({ image: video }).catch((error: Error) => {
        console.warn("Pose processing error:", error);
        processingRef.current = false;
      });
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [processFrame]);

  // ── Playback controls ───────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(pct);
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    const { videoWidth, videoHeight } = videoRef.current;
    setIsPortrait(videoHeight > videoWidth);
    if (canvasRef.current) {
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * videoRef.current.duration;
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-black relative group">
      {/* Video + Canvas stack — adapts to portrait or landscape */}
      <div
        className={`relative w-full ${
          isPortrait
            ? expanded
              ? "aspect-[9/16]"   // full portrait
              : "aspect-[9/14]"   // slightly cropped portrait (shows most of rider)
            : "aspect-video"      // landscape 16:9
        }`}
      >
        <video
          ref={videoRef}
          src={originalUrl ?? undefined}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setPlaying(false)}
          onError={() => {
            if (onVideoError) onVideoError();
          }}
          playsInline
          crossOrigin="anonymous"
        />
        {/* Canvas overlay — sits exactly on top */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: overlayEnabled ? 1 : 0, transition: "opacity 0.2s" }}
        />

        {/* Loading badge */}
        {!poseReady && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] text-white/70">Loading pose model…</span>
          </div>
        )}

        {/* Confidence badge when pose is live */}
        {poseReady && currentMetrics && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  currentMetrics.confidence > 0.7 ? "#4ade80" :
                  currentMetrics.confidence > 0.4 ? "#fbbf24" : "#f87171",
              }}
            />
            <span className="text-[11px] text-white/70">
              {Math.round(currentMetrics.confidence * 100)}% confidence
            </span>
          </div>
        )}

        {/* Expand / collapse button for portrait videos */}
        {isPortrait && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1.5 text-white/60 hover:text-white transition-colors"
          >
            {expanded ? (
              // Compress icon
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 1v3.5H1M7.5 1v3.5H11M4.5 11V7.5H1M7.5 11V7.5H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              // Expand icon
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 4.5V1h3.5M11 4.5V1H7.5M1 7.5V11h3.5M11 7.5V11H7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            )}
            <span className="text-[10px]">{expanded ? "Fit" : "Full"}</span>
          </button>
        )}
      </div>

      {/* Gradient overlay for controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none h-24" />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex flex-col gap-2">
        {/* Progress bar */}
        <div
          className="h-[3px] bg-white/20 rounded-full cursor-pointer relative"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-ocean-light rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-3">
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          >
            {playing ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1.5" y="1" width="2.5" height="8" rx="1" fill="#0a1628" />
                <rect x="6" y="1" width="2.5" height="8" rx="1" fill="#0a1628" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 1l7 4-7 4V1z" fill="#0a1628" />
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="text-[11px] text-white/60 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Pose overlay toggle */}
          <div className="flex bg-white/10 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setOverlayEnabled(false)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                !overlayEnabled
                  ? "bg-white text-ocean-deep font-medium"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setOverlayEnabled(true)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                overlayEnabled
                  ? "bg-white text-ocean-deep font-medium"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              Pose overlay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}