import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { buildLayerTexture } from "./layerTexture";

/**
 * A design layer projected onto the garment's actual surface.
 *
 * Replaces DesignPlane.jsx, which built a flat `planeGeometry` at a fixed
 * coordinate with `depthWrite={false}` — a billboard hovering in front of the
 * mesh. It could not wrap around the chest, could not be hidden by the
 * shoulder when you orbited behind it, and had no geometry worth grabbing, so
 * nothing could be moved or scaled.
 *
 * DecalGeometry instead clips the target mesh's triangles against a
 * projection box and emits new geometry that lies ON those triangles, with
 * freshly generated planar UVs. Two consequences that matter here:
 *
 *  - It follows the surface, so a badge curves over the chest.
 *  - It generates its own UVs, so it ignores the model's own UV layout.
 *    That's essential for these scans: their atlas stretches a square patch
 *    of chest into a 7.7% x 20% UV region, so anything painted into the
 *    model's texture would come out ~2.6x vertically squashed. The decal has
 *    no such distortion.
 */

// Projection depth along the surface normal. Too shallow and the decal
// tears where the garment curves away; too deep and it punches through to
// catch geometry on the far side of the body (a chest logo faintly
// reappearing on the back).
const PROJECTION_DEPTH = 0.12;

export default function DesignDecal({
  layer,
  targetMesh,
  selected,
  // Set false mid-drag so the decal stops intercepting raycasts and the
  // pointer reaches the fabric underneath.
  interactive = true,
  // userData key the parent uses to map a raycast hit back to this layer.
  layerKey,
  // Reports the artwork's width/height ratio once its texture resolves, so
  // the parent can draw a selection frame that matches the decal instead of
  // assuming everything is square.
  onAspect,
  // World-space placement, resolved by the parent from a raycast hit.
  position,
  orientation,
  scale,
  // While the user is dragging this item, the parent feeds live transforms
  // here instead of rewriting `position`. Projecting a decal clips every
  // triangle of a ~100k-vertex garment, which is far too slow to redo per
  // pointer-move — so the drag shows a flat textured preview that costs
  // nothing to move, and the real decal is rebuilt once on release.
  dragTransform = null,
}) {
  const [tex, setTex] = useState(null);
  const disposed = useRef(false);

  // Textures are built per layer and rebuilt whenever the content changes.
  // Only the fields that actually alter pixels are in the dep list — using
  // the whole layer object would rebuild (and re-upload to the GPU) on every
  // drag frame, since position lives on the same object.
  useEffect(() => {
    disposed.current = false;
    let stale = false;

    buildLayerTexture(layer)
      .then((result) => {
        if (stale || disposed.current || !result) return;
        setTex(result);
        onAspect?.(layer.id, result.aspect || 1);
      })
      .catch(() => {
        /* A layer whose art can't decode simply doesn't render — the rest of
           the design is unaffected, and the 2D editor still shows it. */
      });

    return () => {
      stale = true;
    };
  }, [
    layer.type,
    layer.text,
    layer.color,
    layer.fontFamily,
    layer.fontWeight,
    layer.gradient,
    layer.color2,
    layer.outlineColor,
    layer.outlineWidth,
    layer.icon,
    layer.src,
  ]);

  useEffect(
    () => () => {
      disposed.current = true;
      tex?.texture?.dispose();
    },
    [tex],
  );

  const geometry = useMemo(() => {
    if (!targetMesh || !position || !orientation || !tex) return null;

    // Keep the artwork's proportions: DecalGeometry takes a box, and a square
    // box would stretch a wide logo or a long team name to fit.
    const aspect = tex.aspect || 1;
    const w = scale * (aspect >= 1 ? 1 : aspect);
    const h = scale * (aspect >= 1 ? 1 / aspect : 1);

    // Depth scales with the artwork. A fixed shallow box failed to enclose
    // triangles under a large skin on a curved panel, which is what produced
    // empty (invisible, ungrabbable) decals away from the flat chest.
    const size = new THREE.Vector3(w, h, Math.max(PROJECTION_DEPTH, scale * 1.5));

    try {
      return new DecalGeometry(
        targetMesh,
        new THREE.Vector3().fromArray(position),
        new THREE.Euler().fromArray(orientation),
        size,
      );
    } catch {
      // DecalGeometry throws if the projection box misses the mesh entirely
      // (e.g. mid-drag off the silhouette). Drop the frame rather than
      // tearing down the whole canvas.
      return null;
    }
  }, [targetMesh, position, orientation, scale, tex]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  // DecalGeometry returns an EMPTY buffer (not an error) when the projection
  // box doesn't properly enclose any triangles — e.g. right on the silhouette
  // edge, or where the garment curves sharply away. An empty decal renders
  // nothing and, worse, offers nothing to raycast against, so the artwork
  // becomes invisible AND ungrabbable: it looks like it vanished into the
  // shirt. Detected here so the caller can be told the drop was no good.
  const geometryIsEmpty = Boolean(geometry) && (geometry.attributes?.position?.count ?? 0) === 0;

  // Artwork dimensions in world units, shared by the preview and the outline.
  const aspect = tex?.aspect || 1;
  const w = scale * (aspect >= 1 ? 1 : aspect);
  const h = scale * (aspect >= 1 ? 1 / aspect : 1);

  /** Offset vector along the decal's own normal, in world units. */
  const normalOffset = (eulerArray, distance) =>
    new THREE.Vector3(0, 0, 1)
      .applyEuler(new THREE.Euler().fromArray(eulerArray))
      .multiplyScalar(distance);

  /**
   * Absolute world point, lifted just proud of the cloth. For overlays drawn
   * as plain planes, which are positioned absolutely.
   *
   * NOT for the decal mesh itself: DecalGeometry bakes world coordinates into
   * its vertices, so that mesh must stay at (or near) the origin — giving it
   * an absolute position would translate the geometry a second time and fling
   * it off the model.
   */
  const liftedAlongNormal = (transform, distance) =>
    new THREE.Vector3()
      .fromArray(transform.position)
      .add(normalOffset(transform.orientation, distance));

  // ---- Dragging: flat preview that tracks the cursor at full frame rate ----
  if (dragTransform && tex) {
    return (
      <mesh
        position={liftedAlongNormal(dragTransform, 0.006)}
        rotation={dragTransform.orientation}
        renderOrder={10}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          map={tex.texture}
          transparent
          opacity={0.92}
          // Stays visible over the shoulder or a fold while being moved —
          // artwork that vanishes behind the model mid-drag reads as a bug.
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    );
  }

  if (!geometry || !tex || geometryIsEmpty) return null;

  return (
    <>
      {/* Selection outline. A tinted emissive alone was far too subtle to
          answer "what have I actually got hold of?" — this is a hard edge
          that rotates and scales with the artwork, sits a hair above the
          fabric, and stays visible at glancing angles. */}
      {selected && (
        <lineSegments
          position={liftedAlongNormal({ position, orientation }, 0.004)}
          rotation={orientation}
          renderOrder={11}
        >
          <edgesGeometry args={[new THREE.PlaneGeometry(w * 1.06, h * 1.06)]} />
          <lineBasicMaterial
            color="#4da3ff"
            transparent
            opacity={0.95}
            depthTest={false}
            toneMapped={false}
          />
        </lineSegments>
      )}

    <mesh
      geometry={geometry}
      // Lift a fraction of a millimetre along the surface normal. polygonOffset
      // alone biases the depth value but not the geometry, and on a curved
      // panel — a shoulder, the swell of the chest — that isn't enough: the
      // decal partially sinks into the cloth and reads as "hidden behind the
      // shirt". A real positional nudge is reliable where a depth bias isn't,
      // and at this distance it's invisible.
      position={normalOffset(orientation, 0.0015)}
      // Selection and dragging are handled by the parent group, which can see
      // both this hit and the fabric behind it. Tagging the mesh is all that's
      // needed for the parent to know which layer was grabbed — handling
      // pointerdown here (and stopping propagation) is what previously made
      // artwork impossible to drag.
      userData={layerKey ? { [layerKey]: layer.id } : undefined}
      raycast={interactive ? undefined : () => null}
    >
      <meshStandardMaterial
        map={tex.texture}
        transparent
        // Skins are dye, not stickers: multiply lets the garment's own
        // shading and fabric texture read through, so a pattern looks
        // sublimated into the cloth. Logos and text stay on normal blending —
        // a sponsor mark or a player name is opaque ink and shouldn't pick up
        // the shirt colour underneath.
        blending={layer.type === "skin" ? THREE.MultiplyBlending : THREE.NormalBlending}
        // The decal sits exactly on the garment's triangles, so identical
        // depth values would z-fight and shimmer. polygonOffset biases it
        // fractionally toward the camera without moving it in world space —
        // which is what keeps it looking printed rather than floating.
        polygonOffset
        polygonOffsetFactor={-4}
        depthTest
        depthWrite={false}
        // Match the fabric: a fully-rough decal reads as sublimation, which
        // is how most of these are actually produced.
        roughness={0.75}
        metalness={0.02}
        // Selection feedback that survives being viewed at a glancing angle,
        // where a thin outline would disappear.
        emissive={selected ? new THREE.Color("#4da3ff") : new THREE.Color("#000000")}
        emissiveIntensity={selected ? 0.22 : 0}
      />
    </mesh>
    </>
  );
}
