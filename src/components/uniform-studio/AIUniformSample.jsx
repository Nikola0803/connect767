import { useEffect, useState } from "react";
import { embossConnect767ConceptBackground } from "./aiConceptEmboss";
import { uniformSampleFor } from "./uniformSamples";

// Prepare each static example once. Keep branding out of saved user designs;
// generated concepts already use the same background-only emboss renderer.
const preparedSamples = new Map();
export default function AIUniformSample({ sport, backgroundColor, highResolution = true }) {
  const sample = uniformSampleFor(sport);
  const source = highResolution ? sample.src : sample.preview;
  const key = source + "|" + (backgroundColor || "");
  const [prepared, setPrepared] = useState(null);
  useEffect(() => {
    let active = true;
    if (!preparedSamples.has(key)) {
      if (preparedSamples.size >= 10) preparedSamples.delete(preparedSamples.keys().next().value);
      preparedSamples.set(key, embossConnect767ConceptBackground(source, { backgroundColor }).catch(() => source));
    }
    preparedSamples.get(key).then((image) => {
      if (active) setPrepared({ source: key, image });
    });
    return () => { active = false; };
  }, [source, key, backgroundColor]);
  const ready = prepared?.source === key;
  return <img
    src={ready ? prepared.image : source}
    data-sample-src={sample.src}
    data-loaded-source={source}
    data-background-branding={ready && prepared.image !== source ? "connect767-embossed-v1" : undefined}
    alt={sample.alt}
    decoding="async"
    width="1536"
    height="1536"
    draggable={false}
  />;
}
