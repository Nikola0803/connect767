import { useEffect, useState } from "react";
import { embossConnect767ConceptBackground } from "./aiConceptEmboss";
import { uniformSampleFor } from "./uniformSamples";

// Prepare each static example once. Keep branding out of saved user designs;
// generated concepts already use the same background-only emboss renderer.
const preparedSamples = new Map();
export default function AIUniformSample({ sport, backgroundColor }) {
  const sample = uniformSampleFor(sport);
  const key = sample.src + "|" + (backgroundColor || "");
  const [prepared, setPrepared] = useState(null);
  useEffect(() => {
    let active = true;
    if (!preparedSamples.has(key)) {
      if (preparedSamples.size >= 10) preparedSamples.delete(preparedSamples.keys().next().value);
      preparedSamples.set(key, embossConnect767ConceptBackground(sample.src, { backgroundColor }).catch(() => sample.src));
    }
    preparedSamples.get(key).then((image) => {
      if (active) setPrepared({ source: key, image });
    });
    return () => { active = false; };
  }, [sample.src, key, backgroundColor]);
  const ready = prepared?.source === key;
  return <img
    src={ready ? prepared.image : sample.src}
    data-sample-src={sample.src}
    data-background-branding={ready && prepared.image !== sample.src ? "connect767-embossed-v1" : undefined}
    alt={sample.alt}
    draggable={false}
  />;
}
