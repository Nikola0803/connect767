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
    return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
  }

  const colorDesc = [primaryColor, secondaryColor].filter(Boolean).join(" and ");
  const colorLine = colorDesc ? `Use ${colorDesc} as the main colors.` : "";
  const taglineLine = tagline ? `Include the tagline: "${tagline}".` : "";
  const notesLine = notes ? `Additional requirements: ${notes}.` : "";

  const prompt = [
    `Professional print-ready graphic design for a ${productType}.`,
    `Design style: ${style}.`,
    `Brand / team name prominently displayed: "${brandName}".`,
    taglineLine,
    colorLine,
    notesLine,
    "Clean, high-contrast artwork suitable for screen printing or embroidery.",
    "Show the design flat on a white background, full composition centered, no shadows, no watermarks.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || "OpenAI request failed" });
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    const revisedPrompt = data.data?.[0]?.revised_prompt;

    if (!b64) {
      return res.status(500).json({ error: "No image returned" });
    }

    return res.status(200).json({ b64, revisedPrompt });
  } catch (err) {
    console.error("generate-design error:", err);
    return res.status(500).json({ error: "Generation failed. Try again." });
  }
}
