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
  created_at?: string;
  label?: string;
  duration_seconds?: number;
};

export type SubScore = { name: string; value: number; note: string };
export type PillarScore = { value: number; label: string; breakdown: SubScore[] };
export type Scores = {
  position: PillarScore;
  power: PillarScore;
  flow: PillarScore;
  surfy_score: number;
  surfy_label: string;
};