// src/components/layout/mobile-header.tsx
"use client";

import { useChatStore } from "@/store/chat-store";
import { Menu } from "lucide-react";

export function MobileHeader() {
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);

  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
      <button
        onClick={toggleSidebar}
        className="text-gray-500 hover:text-gray-700"
      >
        <Menu className="w-5 h-5" />
      </button>
      <span className="font-semibold text-teal-700 text-sm">🧠 Mindful AI</span>
    </header>
  );
}