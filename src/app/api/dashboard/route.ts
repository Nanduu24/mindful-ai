// src/app/api/dashboard/route.ts
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, subscription_tier, created_at")
      .eq("clerk_id", userId)
      .single();

    if (!dbUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: moodLogs } = await supabaseAdmin
      .from("mood_logs")
      .select("score, created_at")
      .eq("user_id", dbUser.id)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: sessionsThisMonth } = await supabaseAdmin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id)
      .gte("created_at", startOfMonth.toISOString());

    const { count: totalSessions } = await supabaseAdmin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id);

    const { count: totalMessages } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id);

    const { data: recentSessions } = await supabaseAdmin
      .from("sessions")
      .select("id, title, created_at, message_count")
      .eq("user_id", dbUser.id)
      .order("created_at", { ascending: false })
      .limit(5);

    return Response.json({
      user: {
        subscription_tier: dbUser.subscription_tier,
        member_since: dbUser.created_at,
      },
      stats: {
        sessions_this_month: sessionsThisMonth ?? 0,
        total_sessions: totalSessions ?? 0,
        total_messages: totalMessages ?? 0,
      },
      mood_logs: moodLogs ?? [],
      recent_sessions: recentSessions ?? [],
    });
  } catch (error) {
    console.error("[dashboard]", error);
    return new Response("Internal server error", { status: 500 });
  }
}