// src/hooks/use-chat-stream.ts
import { useState, useCallback, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { Message } from "@/types";

// Single, persistent audio element that gets unlocked once
let unlockedAudio: HTMLAudioElement | null = null;

export function getUnlockedAudio(): HTMLAudioElement {
  if (!unlockedAudio) {
    unlockedAudio = new Audio();
    unlockedAudio.preload = "auto";
  }
  return unlockedAudio;
}

export function unlockAudioPlayback() {
  // Called from a user gesture — plays a tiny silent clip to unlock
  const audio = getUnlockedAudio();
  // 1-second silent WAV as data URI
  audio.src =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";
  audio.play().catch(() => {});
}

export function useChatStream() {
  const {
    messages,
    addMessage,
    updateLastMessage,
    setIsStreaming,
    currentSessionId,
    setCurrentSessionId,
    setSessions,
    sessions,
  } = useChatStore();

  const [error, setError] = useState<string | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.error("[speak] failed:", await res.text());
        return;
      }
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Reuse the unlocked audio element
      const audio = getUnlockedAudio();
      audio.src = audioUrl;
      audio.onended = () => URL.revokeObjectURL(audioUrl);

      try {
        await audio.play();
        console.log("[speak] playing!");
      } catch (err) {
        console.error("[speak] play blocked, will retry on next click:", err);
      }
    } catch (err) {
      console.error("[speak]", err);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      setError(null);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      addMessage(userMessage);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      addMessage(assistantMessage);
      setIsStreaming(true);

      try {
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            sessionId: currentSessionId ?? undefined,
          }),
        });

        if (!response.ok) throw new Error("Failed to send message");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);

              if (parsed.sessionId && !currentSessionId) {
                setCurrentSessionId(parsed.sessionId);
                const newSession = {
                  id: parsed.sessionId,
                  user_id: "",
                  title:
                    content.slice(0, 60) +
                    (content.length > 60 ? "..." : ""),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  message_count: 1,
                };
                setSessions([newSession, ...sessions]);
              }

              if (parsed.text) {
                accumulated += parsed.text;
                updateLastMessage(accumulated);
              }
            } catch {
              // ignore
            }
          }
        }

        const shouldSpeak = useChatStore.getState().voiceMode;
        if (shouldSpeak && accumulated) {
          speakText(accumulated);
        }
      } catch {
        setError("Something went wrong. Please try again.");
        updateLastMessage("I'm sorry, something went wrong. Please try again.");
      } finally {
        setIsStreaming(false);
      }
    },
    [
      messages,
      currentSessionId,
      sessions,
      addMessage,
      updateLastMessage,
      setIsStreaming,
      setCurrentSessionId,
      setSessions,
      speakText,
    ]
  );

  return { sendMessage, error, speakText };
}