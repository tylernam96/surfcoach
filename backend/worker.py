"""
worker.py — orchestrates the full video processing pipeline:
  1. Download video from Supabase Storage
  2. Run MediaPipe pose extraction (pose.py)
  3. Run surf-specific analysis (analyse.py)
  4. Get Claude critique (claude_client.py)
  5. Write results back to Supabase
  6. Clean up temp files
"""
import os
import uuid
import tempfile
import requests
import traceback
from supabase_client import get_supabase
from pose import process_video
from analyse import analyse_pose_data
from claude_client import get_surf_critique


def download_video(url: str, dest_path: str):
    """Stream-download a video from a signed Supabase URL."""
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)


def process_video_job(session_id: str, video_url: str):
    supabase = get_supabase()

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # ── 1. Download ──────────────────────────────────────────────────
            video_path = os.path.join(tmpdir, "input.mp4")
            output_path = os.path.join(tmpdir, "output.mp4")
            print(f"[{session_id}] Downloading video...")
            download_video(video_url, video_path)

            # ── 2. Pose extraction ───────────────────────────────────────────
            print(f"[{session_id}] Running MediaPipe...")
            frame_data = process_video(video_path, output_path=output_path, sample_every=3)
            # frame_data is a list of dicts with joint angles per frame

            if not frame_data:
                raise ValueError("No pose landmarks detected — is a surfer visible in the video?")

            # ── 3. Surf analysis (rule-based) ────────────────────────────────
            print(f"[{session_id}] Analysing surf form...")
            analysis = analyse_pose_data(frame_data)
            # analysis = { "flags": [...], "metrics": {...}, "summary": "..." }

            # ── 4. Claude natural-language critique ──────────────────────────
            print(f"[{session_id}] Getting Claude critique...")
            critique = get_surf_critique(analysis)
            # critique = { "overall": "...", "tips": [...], "positives": [...] }

            # ── 5. Upload annotated video to Supabase Storage ────────────────
            annotated_url = None
            if os.path.exists(output_path):
                storage_path = f"annotated/{session_id}.mp4"
                with open(output_path, "rb") as f:
                    supabase.storage.from_("surf-videos").upload(
                        storage_path,
                        f,
                        {"content-type": "video/mp4", "upsert": "true"},
                    )
                annotated_url = supabase.storage.from_("surf-videos").get_public_url(storage_path)

            # ── 6. Write results ─────────────────────────────────────────────
            supabase.table("sessions").update({
                "status": "complete",
                "frame_data": frame_data,
                "analysis": analysis,
                "critique": critique,
                "annotated_video_url": annotated_url,
            }).eq("id", session_id).execute()

            print(f"[{session_id}] Done ✓")

    except Exception as e:
        print(f"[{session_id}] ERROR: {e}")
        traceback.print_exc()
        supabase.table("sessions").update({
            "status": "error",
            "error_message": str(e),
        }).eq("id", session_id).execute()
        