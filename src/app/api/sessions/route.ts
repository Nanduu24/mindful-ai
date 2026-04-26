// src/app/api/sessions/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !dbUser) {
      return Response.json({ sessions: [] });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from("sessions")
      .select("id, title, created_at, updated_at, message_count")
      .eq("user_id", dbUser.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return Response.json({ sessions: sessions ?? [] });
  } catch (error) {
    console.error("[sessions GET]", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("id");
    if (!sessionId) return new Response("Session ID required", { status: 400 });

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!dbUser) return new Response("User not found", { status: 404 });

    const { error } = await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", dbUser.id);

    if (error) throw new Error(error.message);

    return Response.json({ success: true });
  } catch (error) {
    console.error("[sessions DELETE]", error);
    return new Response("Internal server error", { status: 500 });
  }
}