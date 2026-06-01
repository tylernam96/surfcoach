import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Session = {
  id: string;
  user_id: string;
  video_url: string;
  annotated_video_url: string | null;
  status: "processing" | "complete" | "error";
  frame_data: FrameRecord[] | null;
  analysis: Analysis | null;
  critique: Critique | null;
  error_message: string | null;
  created_at: string;
};

export type FrameRecord = {
  frame: number;
  time_s: number;
  knee_bend_left: number;
  knee_bend_right: number;
  hip_hinge: number;
  gaze_lateral: number;
  gaze_down: number;
  stance_width: number;
  com_height: number;
  shoulder_rotation: number;
  confidence: number;
};

export type Flag = {
  code: string;
  severity: "info" | "warning" | "issue";
  message: string;
  pct_frames: number;
};

export type Analysis = {
  flags: Flag[];
  metrics: Record<string, { mean: number; min: number; max: number } | number>;
  summary: string;
};

export type Tip = {
  priority: number;
  title: string;
  detail: string;
};

export type Critique = {
  overall: string;
  positives: string[];
  tips: Tip[];
  one_thing: string;
};