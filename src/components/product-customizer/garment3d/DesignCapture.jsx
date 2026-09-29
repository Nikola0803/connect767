import { useEffect, useRef } from "react";
import { toCanvas } from "html-to-image";
import ProductDraggableLayer from "../ProductDraggableLayer";

// Fixed capture resolution — independent of screen size so the 3D texture
// stays crisp regardless of the visitor's viewport, and matches the flat
// stage's 4:5 aspect ratio (see ProductStage.jsx) so layer x/y percentages
// line up exactly between the 2D editor and the 3D preview.
const CAPTURE_W = 900;
const CAPTURE_H = 1125;
const DEBOUNCE_MS = 220;

/**
 * Invisible, off-screen render of each placement's layers, captured to a
 * canvas and handed to the 3D preview as a texture (see Product3DStage /
 * DesignPlane). Reuses the exact same ProductDraggableLayer component the
 * visible 2D editor uses (in its static, unselected form) so the 3D
 * preview can never drift from what the customer actually designed —
 * curved text, outlines, drop shadows, uploaded art all come along for
 * free instead of needing a parallel 3D text/graphics implementation.
 */
export default function DesignCapture({ layers, placements, onTextureUpdate }) {
  const stageRefs = useRef({});
  const timerRef = useRef(null);

  const viewsWithLayers = placements.filter((p) => layers.some((l) => l.view === p.key));

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      viewsWithLayers.forEach((p) => {
        const node = stageRefs.current[p.key];
        if (!node) return;
        toCanvas(node, { pixelRatio: 1, skipFonts: true, width: CAPTURE_W, height: CAPTURE_H })
          .then((canvas) => onTextureUpdate(p.key, canvas))
          .catch(() => {
            /* best-effort — 3D preview just keeps the last good texture for this zone */
          });
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(layers), placements.map((p) => p.key).join(",")]);

  return (
    <div aria-hidden style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }}>
      {placements.map((p) => (
        <div
          key={p.key}
          ref={(el) => {
            stageRefs.current[p.key] = el;
          }}
          style={{ position: "relative", width: CAPTURE_W, height: CAPTURE_H }}
        >
          {layers
            .filter((l) => l.view === p.key)
            .map((layer) => (
              <ProductDraggableLayer
                key={layer.id}
                layer={layer}
                stageRef={{ current: stageRefs.current[p.key] }}
                selected={false}
                onSelect={() => {}}
                onChange={() => {}}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
