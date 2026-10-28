export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productType, style, brandName, tagline, primaryColor, secondaryColor, notes } = req.body || {};

  if (!brandName || !productType) {
    return res.status(400).json({ error: "productType and brandName are required" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  const colorDesc = [primaryColor, secondaryColor].filter(Boolean).join(" and ");
  const prompt = [
    `Professional graphic design for a ${productType}.`,
    `Design style: ${style}.`,
    `Brand name prominently displayed: "${brandName}".`,
    tagline   ? `Include tagline: "${tagline}".`                    : "",
    colorDesc ? `Use ${colorDesc} as the colour palette.`           : "",
    notes     ? `Additional requirements: ${notes}.`                : "",
    "Flat design shown on a white background, centred, full composition.",
    "Clean artwork suitable for screen printing or embroidery. No watermarks.",
  ].filter(Boolean).join(" ");

  try {
    // 1. Ask DALL-E 3 for an image URL
    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           "dall-e-3",
        prompt,
        n:               1,
        size:            "1024x1024",
        quality:         "standard",
        response_format: "url",
      }),
    });

    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({}));
      return res.status(genRes.status).json({ error: err?.error?.message || "OpenAI request failed" });
    }

    const genData    = await genRes.json();
    const imageUrl   = genData.data?.[0]?.url;
    const revised    = genData.data?.[0]?.revised_prompt || null;

    if (!imageUrl) return res.status(500).json({ error: "No image returned from OpenAI" });

    // 2. Fetch the image and relay it as base64 so the client can download it
    //    directly without needing cross-origin access to OpenAI's CDN.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return res.status(500).json({ error: "Could not fetch generated image" });

    const buffer = await imgRes.arrayBuffer();
    const b64    = Buffer.from(buffer).toString("base64");

    return res.status(200).json({ b64, revisedPrompt: revised });
  } catch (err) {
    console.error("generate-design error:", err);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}
