import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * A thin, transparent plane holding the live design for one zone, parented
 * to the rotating garment group so it moves/lights with the model exactly
 * like a real print or embroidery would. The texture is a canvas captured
 * from the same 2D layer editor customers already use (see
 * DesignCapture.jsx) — so everything the flat editor supports (curved
 * text, outlines, drop shadows, uploaded art) shows up on the 3D preview
 * with zero re-implementation, and always matches the flat editor exactly.
 */
export default function DesignPlane({ anchor, canvas }) {
  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  useEffect(() => {
    if (texture) texture.needsUpdate = true;
  });

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  const [w, h] = anchor.size;
  return (
    <mesh position={anchor.position} rotation={anchor.rotation} renderOrder={2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        toneMapped={false}
      />
    </mesh>
  );
}
