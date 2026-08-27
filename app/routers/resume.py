import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from datetime import datetime

from app.config import settings

router = APIRouter(prefix="/api/resume", tags=["Resume"])

def get_resume_path() -> str:
    path = settings.RESUME_PATH
    if not os.path.isabs(path):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        path = os.path.join(base_dir, path)
    return path

@router.get("/status")
def resume_status():
    path = get_resume_path()
    exists = os.path.exists(path)
    if not exists:
        # Check fallback
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        alt = os.path.join(base_dir, "Praroop_Anand.pdf")
        if os.path.exists(alt):
            path = alt
            exists = True

    if exists:
        stat = os.stat(path)
        return {
            "exists": True,
            "filename": os.path.basename(path),
            "size_kb": round(stat.st_size / 1024, 1),
            "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "path": path
        }
    return {
        "exists": False,
        "filename": "Praroop_Anand.pdf",
        "size_kb": 0,
        "updated_at": None,
        "path": path
    }

@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    path = get_resume_path()
    resume_dir = os.path.dirname(path)
    os.makedirs(resume_dir, exist_ok=True)
    
    # Remove previous files in resume folder
    for existing_file in os.listdir(resume_dir):
        file_to_del = os.path.join(resume_dir, existing_file)
        if os.path.isfile(file_to_del):
            try:
                os.remove(file_to_del)
            except Exception:
                pass

    # Save to target path
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Also sync to workspace root Praroop_Anand.pdf
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    root_copy = os.path.join(base_dir, "Praroop_Anand.pdf")
    try:
        shutil.copy(path, root_copy)
    except Exception:
        pass

    stat = os.stat(path)
    return {
        "ok": True,
        "message": f"Resume updated successfully ({file.filename})",
        "filename": os.path.basename(path),
        "size_kb": round(stat.st_size / 1024, 1)
    }

@router.get("/download")
def download_resume():
    path = get_resume_path()
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Resume PDF not found.")
    return FileResponse(path, media_type="application/pdf", filename="Praroop_Anand.pdf")
