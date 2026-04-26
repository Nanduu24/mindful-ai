// src/components/chat/chat-window.tsx
"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { useChatStore } from "@/store/chat-store";
import { useChatStream } from "@/hooks/use-chat-stream";

export function ChatWindow() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { sendMessage, error } = useChatStream();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
            {messages.map((message, i) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={
                  isStreaming && i === messages.length - 1
                }
              />
            ))}
            {error && (
              <p className="text-center text-xs text-red-500">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} />
    </div>
  );
}

function WelcomeScreen() {
  const { sendMessage } = useChatStream();

  const starters = [
    "I've been feeling anxious lately and don't know why",
    "I want to work on my relationship with stress",
    "I've been having trouble sleeping and it's affecting my mood",
    "I need help managing overwhelming thoughts",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
      <div className="text-4xl mb-4">🧠</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        Hi, I'm Mindful
      </h2>
      <p className="text-gray-500 text-sm max-w-sm mb-8 leading-relaxed">
        A safe space to talk through whatever's on your mind. I'm here to
        listen, support, and help you find clarity.
      </p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-md">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            className="text-left px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-all"
          >
            "{s}"
          </button>
        ))}
      </div>
    </div>
  );
}