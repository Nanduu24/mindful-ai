// src/components/chat/chat-input.tsx
"use client";

import { useState, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "./voice-button";
import { useChatStore } from "@/store/chat-store";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const isStreaming = useChatStore((s) => s.isStreaming);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  };

  const handleVoiceTranscribed = async (text: string) => {
    onSend(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 items-end">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or tap the mic to speak..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 min-h-[44px] max-h-[160px]"
          />
          <VoiceButton
            onTranscribed={handleVoiceTranscribed}
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!value.trim() || isStreaming}
            className="flex-shrink-0 h-11 w-11 p-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Mindful AI is not a substitute for professional mental health care.
        </p>
      </div>
    </div>
  );
}