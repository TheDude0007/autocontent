import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ImageRequest {
  facetId: string;
  heading: string;
  mediaBrief: string;
}

interface ImageResult {
  facetId: string;
  dataUri: string | null;
  error?: string;
}

function buildImagePrompt(heading: string, brief: string): string {
  return `Professional marketing visual for a service business website section titled "${heading}".

${brief}

Style: Clean, professional, high-contrast. Suitable for a business website. No text overlays. Photorealistic or polished digital art. Wide landscape composition.`;
}

async function generateOne(req: ImageRequest): Promise<ImageResult> {
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: buildImagePrompt(req.heading, req.mediaBrief),
      n: 1,
      size: "1536x1024",
      quality: "medium",
    });
    const b64 = response.data?.[0]?.b64_json ?? null;
    return {
      facetId: req.facetId,
      dataUri: b64 ? `data:image/png;base64,${b64}` : null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    return { facetId: req.facetId, dataUri: null, error: msg };
  }
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("sk-...")) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured in .env.local" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json() as { facets: ImageRequest[] };
  if (!body.facets?.length) {
    return new Response(
      JSON.stringify({ error: "facets array required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cap at 8 images per call to control cost
  const facets = body.facets.slice(0, 8);

  // Concurrency of 3 to stay within rate limits
  const results: ImageResult[] = [];
  for (let i = 0; i < facets.length; i += 3) {
    const batch = facets.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(generateOne));
    results.push(...batchResults);
  }

  return new Response(JSON.stringify({ images: results }), {
    headers: { "Content-Type": "application/json" },
  });
}
