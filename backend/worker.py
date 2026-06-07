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
from claude import get_surf_critique


def download_video(url: str, dest_path: str):
    """Stream-download a video from a signed Supabase URL."""
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)


def compress_video(input_path: str, output_path: str, target_mb: int = 40):
    """Re-encode with ffmpeg targeting a file size under target_mb."""
    import subprocess, json
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", input_path],
        capture_output=True, text=True, check=True,
    )
    duration = float(json.loads(probe.stdout)["format"]["duration"])
    target_bits = target_mb * 8 * 1024 * 1024
    bitrate = int(target_bits / duration * 0.92)  # 8% headroom
    subprocess.run([
        "ffmpeg", "-y", "-i", input_path,
        "-c:v", "libx264", "-b:v", str(bitrate),
        "-preset", "fast", "-movflags", "+faststart",
        "-an",  # annotated video has no audio
        output_path,
    ], check=True, capture_output=True)


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
            print(f"[{session_id}] Extracted {len(frame_data)} frames")
            if frame_data:
                print(f"[{session_id}] First frame sample: {frame_data[0].get('knee_bend_left', 'N/A')}")

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
                print(f"[{session_id}] Compressing annotated video...")
                compressed_path = output_path.replace(".mp4", "_compressed.mp4")
                compress_video(output_path, compressed_path, target_mb=40)

                storage_path = f"annotated/{session_id}.mp4"
                with open(compressed_path, "rb") as f:
                    supabase.storage.from_("surf-videos").upload(
                        storage_path,
                        f,
                        {"content-type": "video/mp4", "upsert": "true"},
                    )
                os.remove(compressed_path)
                signed = supabase.storage.from_("surf-videos").create_signed_url(storage_path, 60 * 60 * 24)  # 24hr expiry
                annotated_url = signed["signedURL"]

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