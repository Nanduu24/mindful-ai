// src/app/api/chat/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
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
    // 1. Auth
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // 2. Validate
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, sessionId } = parsed.data;

    // 3. Get Clerk user
    const clerkUser = await currentUser();
    if (!clerkUser) return new Response("User not found", { status: 404 });

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const displayName = clerkUser.firstName ?? undefined;

    // 4. Sync to Supabase
    const dbUser = await syncUser(userId, email, displayName);

    // 5. Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error } = await supabaseAdmin
        .from("sessions")
        .insert({ user_id: dbUser.id, title: "New session" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
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

      // Auto-title from first message
      if (messages.length === 1) {
        await supabaseAdmin
          .from("sessions")
          .update({
            title: lastMessage.content.slice(0, 60) +
              (lastMessage.content.length > 60 ? "..." : ""),
          })
          .eq("id", currentSessionId);
      }
    }

    // 7. Call FastAPI LangGraph backend
    const fastapiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";

    const fastapiResponse = await fetch(`${fastapiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        session_id: currentSessionId,
        user_id: dbUser.id,
        user_name: displayName,
      }),
    });

    if (!fastapiResponse.ok) {
      const err = await fastapiResponse.text();
      throw new Error(`FastAPI error: ${err}`);
    }

    const fastapiData = await fastapiResponse.json();
    const aiResponse: string = fastapiData.response;
    const crisisDetected: boolean = fastapiData.crisis_detected ?? false;
    const moodScore: number | null = fastapiData.mood_score ?? null;

    // 8. Save assistant response
    await supabaseAdmin.from("messages").insert({
      session_id: currentSessionId,
      user_id: dbUser.id,
      role: "assistant",
      content: aiResponse,
    });

    // 9. Stream response back to browser via SSE
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send sessionId first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`
          )
        );

        // Simulate streaming — send response word by word
        const words = aiResponse.split(" ");
        let accumulated = "";

        for (const word of words) {
          accumulated += (accumulated ? " " : "") + word;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ text: word + " " })}\n\n`
            )
          );
          // Small delay for streaming effect
          await new Promise((r) => setTimeout(r, 20));
        }

        // Send metadata at end
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              moodScore,
              crisisDetected,
            })}\n\n`
          )
        );

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