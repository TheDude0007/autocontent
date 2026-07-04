import { anthropic, makeSSEStream } from "@/lib/ai/stream";
import { DEEP_QUERY_SYSTEM_PROMPT, buildDeepQueryPrompt, DeepQueryInput } from "@/lib/ai/prompts/deep-query";

export async function POST(req: Request) {
  const body = await req.json() as DeepQueryInput;

  if (!body.rootQuery?.trim() || !body.businessName?.trim() || !body.location?.trim() || !body.serviceType?.trim()) {
    return new Response(
      JSON.stringify({ error: "rootQuery, businessName, location, and serviceType are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return makeSSEStream(
    () =>
      anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: DEEP_QUERY_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildDeepQueryPrompt(body) },
        ],
      }),
    async () => {
      // POC: no DB persistence — caller handles the parsed result
    }
  );
}
