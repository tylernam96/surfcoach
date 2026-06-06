from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
from supabase_client import get_supabase
from worker import process_video_job

app = FastAPI(title="SurfCoach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyseRequest(BaseModel):
    session_id: str
    video_url: str
    user_id: str

class AnalyseResponse(BaseModel):
    session_id: str
    status: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyse", response_model=AnalyseResponse)
async def analyse(req: AnalyseRequest, background_tasks: BackgroundTasks):
    """
    Accepts a video URL from Supabase Storage and kicks off processing.
    Processing runs in the background; results are written back to Supabase.
    """
    supabase = get_supabase()

    user_id = req.user_id
    if not user_id or user_id == "anonymous":
        user_id = str(uuid.uuid4())  # Generate a valid UUID

    # Create or update session row to 'processing'
    supabase.table("sessions").upsert({
        "id": req.session_id,
        "user_id": req.user_id,
        "video_url": req.video_url,
        "status": "processing",
    }).execute()

    background_tasks.add_task(process_video_job, req.session_id, req.video_url)

    return AnalyseResponse(session_id=req.session_id, status="processing")

@app.get("/session/{session_id}")
def get_session(session_id: str):
    supabase = get_supabase()
    result = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data

@app.post("/refresh-video-url/{session_id}")
def refresh_video_url(session_id: str):
    supabase = get_supabase()
    # Get the session to find the storage path
    result = supabase.table("sessions").select("storage_path").eq("id", session_id).single().execute()
    
    if not result.data or not result.data.get("storage_path"):
        raise HTTPException(404, "No video path found")
    
    # Generate new signed URL (longer expiry - 7 days)
    new_url = supabase.storage.from_("surf-videos").create_signed_url(
        result.data["storage_path"], 
        60 * 60 * 24 * 7  # 7 days
    )
    
    # Update the session with the new URL
    supabase.table("sessions").update({
        "video_url": new_url["signedURL"]
    }).eq("id", session_id).execute()
    
    return {"video_url": new_url["signedURL"]}