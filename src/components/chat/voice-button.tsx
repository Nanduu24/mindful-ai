// src/components/chat/voice-button.tsx
"use client";

import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useChatStore } from "@/store/chat-store";
import { unlockAudioPlayback } from "@/hooks/use-chat-stream";
import { Mic, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  onTranscribed: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function VoiceButton({ onTranscribed, disabled }: VoiceButtonProps) {
  const setVoiceMode = useChatStore((s) => s.setVoiceMode);
  const {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    transcribeAndSend,
  } = useVoiceRecorder();

  const handleClick = async () => {
    if (isProcessing || disabled) return;

    // 🔓 Unlock audio on EVERY click — Safari needs gesture token refresh
    unlockAudioPlayback();

    if (isRecording) {
      try {
        const blob = await stopRecording();
        setVoiceMode(true);
        await transcribeAndSend(blob, onTranscribed);
        setTimeout(() => setVoiceMode(false), 30000);
      } catch (err) {
        console.error("[voice-button]", err);
        setVoiceMode(false);
      }
    } else {
      try {
        await startRecording();
      } catch {
        alert("Please allow microphone access to use voice mode");
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isProcessing || disabled}
      className={cn(
        "flex-shrink-0 h-11 w-11 rounded-lg flex items-center justify-center transition-all",
        isRecording
          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
          : isProcessing
            ? "bg-gray-100 text-gray-400 cursor-wait"
            : "bg-gray-100 text-gray-600 hover:bg-teal-100 hover:text-teal-600 active:scale-95",
        disabled && "opacity-40 cursor-not-allowed"
      )}
      title={
        isRecording
          ? "Stop recording"
          : isProcessing
            ? "Transcribing..."
            : "Tap to speak"
      }
    >
      {isProcessing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isRecording ? (
        <Square className="w-4 h-4 fill-current" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
}