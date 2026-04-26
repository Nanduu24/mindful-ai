// src/components/chat/message-bubble.tsx
import { cn } from "@/lib/utils";
import { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="mr-3 mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-sm">
          🧠
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-teal-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
        )}
      >
        {/* Empty streaming state */}
        {!message.content && isStreaming ? (
          <div className="flex gap-1 items-center py-1">
            <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        {/* Streaming cursor */}
        {isStreaming && !isUser && message.content && (
          <span className="inline-block w-0.5 h-4 bg-teal-500 ml-0.5 animate-pulse align-middle" />
        )}
      </div>

      {/* Avatar — user only */}
      {isUser && (
        <div className="ml-3 mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-medium">
          You
        </div>
      )}
    </div>
  );
}