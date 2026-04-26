// src/app/api/chat/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { syncUser } from "@/lib/supabase/sync-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(10000),
    })
  ).min(1).max(100),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // 2. Validate body
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, sessionId } = parsed.data;

    // 3. Get Clerk user
    const clerkUser = await currentUser();
    if (!clerkUser) return new Response("User not found", { status: 404 });

    // 4. Sync to Supabase
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const displayName = clerkUser.firstName ?? undefined;
    const dbUser = await syncUser(userId, email, displayName);

    // 5. Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabaseAdmin
        .from("sessions")
        .insert({ user_id: dbUser.id, title: "New session" })
        .select("id")
        .single();

      if (sessionError) throw new Error(sessionError.message);
      currentSessionId = newSession.id;
    }

    // 6. Save user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      await supabaseAdmin.from("messages").insert({
        session_id: currentSessionId,
        user_id: dbUser.id,
        role: "user",
        content: lastMessage.content,
      });

      // Auto-title session from first message
      if (messages.length === 1) {
        const title =
          lastMessage.content.slice(0, 60) +
          (lastMessage.content.length > 60 ? "..." : "");
        await supabaseAdmin
          .from("sessions")
          .update({ title })
          .eq("id", currentSessionId);
      }
    }

    // 7. Stream AI response (Gemini now, Claude later — one env var change)
    const ai = getAIProvider();
    const systemPrompt = getSystemPrompt(displayName);

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send sessionId first so client can track it
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`
          )
        );

        try {
          const fullResponse = await ai.streamChat(
            messages,
            systemPrompt,
            ({ text }) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          );

          // Save assistant response to DB
          if (fullResponse) {
            await supabaseAdmin.from("messages").insert({
              session_id: currentSessionId,
              user_id: dbUser.id,
              role: "assistant",
              content: fullResponse,
            });
          }
        } catch (err) {
          console.error("[stream error]", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream failed" })}\n\n`
            )
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Session-Id": currentSessionId ?? "",
      },
    });
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}