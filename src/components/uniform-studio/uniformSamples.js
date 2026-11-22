const samples = {
  soccer: ["soccer", "Soccer"],
  basketball: ["basketball", "Basketball"],
  netball: ["netball", "Netball"],
  cricket: ["cricket", "Cricket"],
  goalkeeper: ["goalkeeper", "Goalkeeper"],
  other: ["other", "Other"],
};

export function uniformSampleFor(sport) {
  const [file, category] = samples[sport] || samples.soccer;
  const asset = file + "-views";
  return {
    src: `/uploads/ai-uniform-samples/${asset}.webp`,
    preview: `/uploads/ai-uniform-samples/${asset}-small.webp`,
    thumbnail: `/uploads/ai-uniform-samples/${asset}-thumb.webp`,
    alt: `AI-generated ${category.toLowerCase()} uniform example, front, side and back`,
  };
}
