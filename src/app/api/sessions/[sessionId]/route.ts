// src/app/api/sessions/[sessionId]/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { sessionId } = await params;

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!dbUser) return new Response("User not found", { status: 404 });

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", dbUser.id)
      .single();

    if (!session) return new Response("Session not found", { status: 404 });

    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return Response.json({ messages: messages ?? [] });
  } catch (error) {
    console.error("[sessions/[sessionId] GET]", error);
    return new Response("Internal server error", { status: 500 });
  }
}