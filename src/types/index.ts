// src/types/index.ts
export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface UserProfile {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  subscription_tier: "free" | "pro" | "premium";
  created_at: string;
}