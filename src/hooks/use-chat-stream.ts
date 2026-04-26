// src/hooks/use-chat-stream.ts
import { useState, useCallback } from "react";
import { useChatStore } from "@/store/chat-store";
import { Message } from "@/types";

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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      setError(null);

      // Add user message immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      addMessage(userMessage);

      // Add empty assistant message (will be filled by stream)
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      addMessage(assistantMessage);
      setIsStreaming(true);

      try {
        const allMessages = [
          ...messages,
          userMessage,
        ].map((m) => ({ role: m.role, content: m.content }));

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

              // Capture sessionId from first chunk
              if (parsed.sessionId && !currentSessionId) {
                setCurrentSessionId(parsed.sessionId);
                // Add new session to sidebar
                const newSession = {
                  id: parsed.sessionId,
                  user_id: "",
                  title: content.slice(0, 60) + (content.length > 60 ? "..." : ""),
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
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        setError("Something went wrong. Please try again.");
        // Remove the empty assistant message on error
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
    ]
  );

  return { sendMessage, error };
}