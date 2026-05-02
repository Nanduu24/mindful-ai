# app/api/voice.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from app.voice.service import transcribe_audio, synthesize_speech

router = APIRouter()


@router.post("/voice/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Convert audio bytes → text."""
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            raise HTTPException(status_code=400, detail="Audio file too small")

        mime_type = audio.content_type or "audio/webm"
        text = await transcribe_audio(audio_bytes, mime_type)

        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[voice/transcribe] {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SynthesizeRequest(BaseModel):
    text: str


@router.post("/voice/synthesize")
async def synthesize(request: SynthesizeRequest):
    """Convert text → audio bytes."""
    try:
        if len(request.text) > 5000:
            raise HTTPException(status_code=400, detail="Text too long")

        audio_bytes = synthesize_speech(request.text)

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[voice/synthesize] {e}")
        raise HTTPException(status_code=500, detail=str(e))