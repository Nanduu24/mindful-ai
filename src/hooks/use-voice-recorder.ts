// src/hooks/use-voice-recorder.ts
import { useState, useRef, useCallback } from "react";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      throw new Error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return reject("Not recording");

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const transcribeAndSend = useCallback(
    async (
      audioBlob: Blob,
      onTranscribed: (text: string) => Promise<void>
    ) => {
      setIsProcessing(true);
      try {
        // Skip if recording too short (< 1 second of audio)
        if (audioBlob.size < 5000) {
          console.warn("[voice] Recording too short — skipping");
          return;
        }

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          console.warn("[voice] Transcription failed — try speaking longer");
          return;
        }

        const { text } = await res.json();
        if (text?.trim()) {
          await onTranscribed(text.trim());
        } else {
          console.warn("[voice] Empty transcription");
        }
      } catch (err) {
        console.warn("[voice] Transcription error:", err);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    transcribeAndSend,
  };
}