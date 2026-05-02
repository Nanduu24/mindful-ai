// src/app/api/voice/transcribe/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const formData = await req.formData();
    const audio = formData.get("audio") as File;
    if (!audio) return new Response("No audio", { status: 400 });

    const fastapiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
    const upstream = new FormData();
    upstream.append("audio", audio);

    const res = await fetch(`${fastapiUrl}/api/voice/transcribe`, {
      method: "POST",
      body: upstream,
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(err, { status: 500 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error("[voice/transcribe]", error);
    return new Response("Internal server error", { status: 500 });
  }
}