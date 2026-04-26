// src/components/layout/sidebar.tsx
"use client";

import { useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { useChatStore } from "@/store/chat-store";
import { Button } from "@/components/ui/button";
import { Session } from "@/types";
import { PenSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    setMessages,
    isSidebarOpen,
    toggleSidebar,
  } = useChatStore();

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .catch(console.error);
  }, [setSessions]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const handleSelectSession = async (session: Session) => {
    setCurrentSessionId(session.id);
    setMessages([]);
    try {
      const res = await fetch(`/api/sessions/${session.id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      console.error("Failed to load session");
    }
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    await fetch(`/api/sessions?id=${sessionId}`, { method: "DELETE" });
    useChatStore.getState().removeSession(sessionId);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  };

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-10 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-20 transition-transform duration-200",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <span className="font-semibold text-teal-700 text-sm">
            🧠 Mindful AI
          </span>
          <button
            onClick={toggleSidebar}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 py-3">
          <Button onClick={handleNewChat} className="w-full gap-2 justify-center">
            <PenSquare className="w-4 h-4" />
            New session
          </Button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-6 px-4">
              No sessions yet. Start a conversation!
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-gray-400 px-2 py-2 uppercase tracking-wider">
                Recent sessions
              </p>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm group flex items-center justify-between gap-2 transition-colors cursor-pointer",
                    currentSessionId === session.id
                      ? "bg-teal-50 text-teal-700"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className="truncate flex-1">{session.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDeleteSession(e as never, session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
          <UserButton />
          <span className="text-xs text-gray-400">Free plan</span>
        </div>
      </aside>
    </>
  );
}