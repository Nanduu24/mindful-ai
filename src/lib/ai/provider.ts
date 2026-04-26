// src/lib/ai/provider.ts
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StreamChunk = {
  text: string;
};

// Single interface both providers implement
export interface AIProvider {
  streamChat(
    messages: AIMessage[],
    systemPrompt: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string>; // returns full response text
}

// ── Gemini Provider ──────────────────────────────────────────
class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async streamChat(
    messages: AIMessage[],
    systemPrompt: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    const model = this.client.getGenerativeModel({
        model: "gemini-2.5-flash", // free tier model
      systemInstruction: systemPrompt,
    });

    // Gemini uses "model" instead of "assistant"
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });

    const result = await chat.sendMessageStream(lastMessage.content);

    let fullText = "";
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        onChunk({ text });
      }
    }

    return fullText;
  }
}

// ── Claude Provider (ready for when you subscribe) ───────────
class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  async streamChat(
    messages: AIMessage[],
    systemPrompt: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    const stream = await this.client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        fullText += chunk.delta.text;
        onChunk({ text: chunk.delta.text });
      }
    }

    return fullText;
  }
}

// ── Factory — change AI_PROVIDER=claude to switch ───────────
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "gemini";

  switch (provider) {
    case "claude":
      return new ClaudeProvider();
    case "gemini":
    default:
      return new GeminiProvider();
  }
}