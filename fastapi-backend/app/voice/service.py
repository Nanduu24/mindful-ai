# app/voice/service.py
import os
from elevenlabs.client import ElevenLabs
import google.generativeai as genai
from app.core.config import get_settings

settings = get_settings()

# Gemini for transcription (free)
genai.configure(api_key=settings.gemini_api_key)

# ElevenLabs for TTS
eleven = ElevenLabs(api_key=settings.elevenlabs_api_key)


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio using Gemini (free)."""
    try:
        # Gemini accepts audio directly via multimodal input
        model = genai.GenerativeModel("gemini-2.5-flash")

        response = model.generate_content([
            {
                "mime_type": mime_type,
                "data": audio_bytes,
            },
            "Transcribe this audio recording word-for-word. Return ONLY the transcribed text, no preamble, no explanation.",
        ])

        return response.text.strip()
    except Exception as e:
        print(f"[voice] Transcription failed: {e}")
        raise


def synthesize_speech(text: str) -> bytes:
    """Convert text to natural speech using ElevenLabs."""
    try:
        # Voice settings tuned for therapeutic warmth
        audio_generator = eleven.text_to_speech.convert(
            voice_id=settings.elevenlabs_voice_id,
            text=text,
            model_id="eleven_turbo_v2_5",  # fastest, cheapest
            voice_settings={
                "stability": 0.6,        # warm but consistent
                "similarity_boost": 0.75,
                "style": 0.3,            # subtle emotional inflection
                "use_speaker_boost": True,
            },
            output_format="mp3_44100_128",
        )

        # Collect bytes from generator
        audio_bytes = b"".join(audio_generator)
        return audio_bytes
    except Exception as e:
        print(f"[voice] Synthesis failed: {e}")
        raise