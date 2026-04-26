// src/lib/supabase/sync-user.ts
import { supabaseAdmin } from "./admin";

export async function syncUser(clerkId: string, email: string, displayName?: string) {
  // Check if user already exists
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (existing) return existing;

  // Create new user record
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      clerk_id: clerkId,
      email,
      display_name: displayName ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to sync user: ${error.message}`);
  return data;
}