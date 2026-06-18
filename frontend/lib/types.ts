export type FlagSeverity = "issue" | "warning" | "info";

export type Flag = {
  severity: FlagSeverity;
  message: string;
  pct_frames: number;
};

export type Analysis = {
  flags: Flag[];
  metrics: {
    knee_bend_left?: { mean: number };
    knee_bend_right?: { mean: number };
    hip_hinge?: { mean: number };
    shoulder_rotation?: { mean: number };
    frames_analysed?: number;
    total_frames?: number;
  };
  scores?: Scores;
  segments?: Segments;
  context?: RideContext;
};

/* ── Rider corrections fed back into segmentation (Tier 2 tagging) ── */
export type TurnLabel = {
  type?: string;             // "Bottom turn" | "Top turn" | "Cutback"
  mark?: "best" | "worst";
};

export type ManualTags = {
  takeoff_s?: number;                       // tapped to-feet time (item 4)
  clip?: [number, number];                  // [start_s, end_s] wave trim (item 6)
  turn_labels?: Record<string, TurnLabel>;  // turn corrections (item 5)
};

/* ── Rider/wave tags captured at upload ── */
export type RideContext = {
  stance?: "regular" | "goofy" | null;
  wave_direction?: "left" | "right" | null;
  facing?: "frontside" | "backside" | null;
};

/* ── Ride segmentation (pop-up, per-turn, timing) ── */
export type Popup = {
  detected: boolean;
  /** "manual" when the rider tapped the takeoff, "auto" when pose-detected. */
  source?: "manual" | "auto";
  time_to_feet_s: number;
  first_compression_s: number | null;
  first_compression_knee: number | null;
  value: number;
  label: string;
  summary: string;
  note: string;
};

export type Turn = {
  index: number;
  type: string;        // "Bottom turn" | "Top turn" | "Cutback" (estimated)
  start_s: number;
  peak_s: number;
  end_s: number;
  value: number;
  label: string;
  summary: string;
  note: string;
  mark?: "best" | "worst";   // rider-marked best/worst turn (item 5)
};

export type DeadSegment = { start_s: number; end_s: number; duration_s: number };

export type Timing = {
  turn_count: number;
  avg_gap_s: number | null;
  rhythm_consistency: number | null;
  summary: string;
  dead_segments: DeadSegment[];
};

export type Segments = {
  popup: Popup | null;
  turns: Turn[];
  timing: Timing;
  available: boolean;
};

export type Tip = {
  priority: number;
  title: string;
  detail: string;
};

export type Critique = {
  overall: string;
  one_thing?: string;
  positives: string[];
  tips: Tip[];
};

export type SessionStatus = "processing" | "complete" | "error";

export type Session = {
  id: string;
  user_id: string;
  video_url: string | null;
  video_path: string | null;
  annotated_video_path: string | null;
  annotated_video_url: string | null;
  status: SessionStatus;
  error_message?: string;
  analysis?: Analysis;
  critique?: Critique;
  manual_tags?: ManualTags;
  created_at?: string;
  label?: string;
  duration_seconds?: number;
};

export type SubScore = { name: string; value: number; summary?: string; note: string };
export type PillarScore = { value: number; label: string; breakdown: SubScore[] };
export type Scores = {
  position: PillarScore;
  power: PillarScore;
  flow: PillarScore;
  surfy_score: number;
  surfy_label: string;
};