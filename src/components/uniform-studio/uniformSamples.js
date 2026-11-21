const samples = {
  soccer: ["soccer", "Soccer"],
  basketball: ["basketball", "Basketball"],
  netball: ["netball", "Netball"],
  cricket: ["cricket", "Cricket"],
  goalkeeper: ["goalkeeper", "Goalkeeper"],
};

export function uniformSampleFor(sport) {
  const [file, category] = samples[sport] || samples.soccer;
  return {
    src: `/uploads/ai-uniform-samples/${file}.webp`,
    alt: `AI-generated ${category.toLowerCase()} uniform example, front and back`,
  };
}
