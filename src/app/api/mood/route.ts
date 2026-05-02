// src/app/api/mood/route.ts
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  score: z.number().int().min(1).max(10),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { score, note } = schema.parse(body);

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!dbUser) return new Response("User not found", { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("mood_logs")
      .insert({
        user_id: dbUser.id,
        score,
        note: note ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return Response.json({ mood_log: data });
  } catch (error) {
    console.error("[mood]", error);
    return new Response("Internal server error", { status: 500 });
  }
}