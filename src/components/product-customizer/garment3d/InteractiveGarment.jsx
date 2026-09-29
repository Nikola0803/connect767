import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import GarmentModel from "./GarmentModel";
import DesignDecal from "./DesignDecal";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";

/**
 * Direct manipulation of design layers on the 3D garment.
 *
 * Grab the artwork itself and drag it across the fabric; scroll or use the
 * gizmo to resize. Every placement comes from a raycast against the real
 * mesh, so a layer can only ever land ON the garment.
 *
 * Pointer handling lives on ONE wrapper group that contains both the garment
 * and the decals. An earlier version put the handlers on the garment only and
 * had each decal stop propagation on pointerdown, which meant grabbing a logo
 * was swallowed before the drag logic ran — the only way to move something
 * was to click bare fabric, which teleported it. Centralising here means a
 * press on artwork and a press on fabric are distinguished by what was hit,
 * not by which component happened to receive the event first.
 */

// Skins land large — a pattern or flag is meant to cover a panel, and
// arriving badge-sized would read as a mistake to be fixed rather than a
// design to be positioned.
const DEFAULT_SIZE = { text: 0.3, logo: 0.18, clipart: 0.16, skin: 0.45 };
const MIN_DECAL_SIZE = 0.04;
const MAX_DECAL_SIZE = 0.8;
const SCALE_STEP = 1.12;
const ROTATE_STEP = Math.PI / 24; // 7.5° per nudge

/** Marker so a raycast hit can be traced back to the layer it belongs to. */
const LAYER_KEY = "c767LayerId";

function orientationFromHit(point, faceNormal, matrixWorld, roll = 0) {
  const normal = faceNormal.clone().transformDirection(matrixWorld).normalize();
  const helper = new THREE.Object3D();
  helper.position.copy(point);
  helper.lookAt(point.clone().add(normal));
  helper.rotateZ(roll);
  return helper.rotation.toArray().slice(0, 3);
}

export default function InteractiveGarment({
  productType,
  color,
  colorB,
  splitAt,
  softness,
  offsetY = 0,
  layers,
  selectedLayerId,
  onSelectLayer,
  onPlaceLayer,
  onRemoveLayer,
  onUpdateLayer,
  onRecolorLayer,
  placements3d,
  // Armed click-to-place: { type, src?, skinKey? } or null.
  pendingLayer,
  onCommitPending,
  enabled = true,
}) {
  const garmentRef = useRef(null);
  const [targetMesh, setTargetMesh] = useState(null);
  // State, not a ref: decals switch off their own raycasting mid-drag, which
  // needs a re-render to take effect.
  const [isDragging, setIsDragging] = useState(false);
  // Live transform while dragging. Kept here rather than pushed up into
  // placements3d on every move, because each write rebuilds DecalGeometry —
  // which clips every triangle of a ~100k-vertex garment and made dragging
  // crawl. The parent is told once, on release.
  const [dragTransform, setDragTransform] = useState(null);
  const dragTransformRef = useRef(null);
  // Mirrors of state/props read by the window-level pointerup listener, which
  // is bound once and would otherwise close over first-render values forever.
  const draggingRef = useRef(false);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const onPlaceLayerRef = useRef(onPlaceLayer);
  const validityRef = useRef(() => true);
  selectedLayerIdRef.current = selectedLayerId;
  onPlaceLayerRef.current = onPlaceLayer;
  // Width/height ratio per layer, reported by each decal once its texture
  // resolves. Needed so the selection frame matches wide logos and long
  // strings of text rather than boxing everything as a square.
  const [aspects, setAspects] = useState({});
  const reportAspect = useCallback((layerId, aspect) => {
    setAspects((prev) => (prev[layerId] === aspect ? prev : { ...prev, [layerId]: aspect }));
  }, []);
  const controls = useThree((s) => s.controls);
  const gl = useThree((s) => s.gl);

  /**
   * Keep a live handle on the garment mesh decals are projected onto.
   *
   * This has to be polled, not resolved once in an effect. GarmentModel wraps
   * the GLB in its OWN <Suspense> with a procedural placeholder, so the mesh
   * under this group is swapped out from underneath us the moment the model
   * finishes downloading — and no prop or state changes when that happens, so
   * an effect keyed on slug/modelUrl/color never re-runs. The old code
   * captured the placeholder, then held a reference to it after it had been
   * removed from the scene: decals were projected onto a mesh that no longer
   * existed, so nothing appeared in 3D until something forced a remount
   * (toggling Edit, or changing a colour). Sports with no GLB kept working,
   * because their placeholder is the final mesh.
   *
   * The check is a shallow traverse of a handful of objects per frame.
   */
  useFrame(() => {
    const group = garmentRef.current;
    if (!group) return;
    let found = null;
    group.traverse((child) => {
      if (!found && child.isMesh && child.geometry?.attributes?.position) found = child;
    });
    if (found !== targetMesh) setTargetMesh(found ?? null);
  });

  const setControlsEnabled = useCallback(
    (on) => {
      if (controls) controls.enabled = on;
    },
    [controls],
  );

  const defaultSizeFor = useCallback(
    (layerId) => {
      const layer = layers.find((l) => l.id === layerId);
      return DEFAULT_SIZE[layer?.type] ?? 0.18;
    },
    [layers],
  );

  const writePlacement = useCallback(
    (layerId, point, faceNormal, matrixWorld) => {
      const existing = placements3d?.[layerId];
      onPlaceLayer?.(layerId, {
        position: point.toArray(),
        orientation: orientationFromHit(point, faceNormal, matrixWorld, existing?.roll ?? 0),
        scale: existing?.scale ?? defaultSizeFor(layerId),
        roll: existing?.roll ?? 0,
      });
    },
    [placements3d, onPlaceLayer, defaultSizeFor],
  );

  /**
   * Drop a newly-added layer straight onto the chest.
   *
   * Adding text used to create a layer that existed only in the flat editor,
   * so in 3D nothing happened until you found the Edit toggle — the item
   * appeared to vanish. Auto-placing means "Add text" immediately puts
   * something visible and grabbable on the garment.
   */
  // Layers that have already been auto-dropped once. Without this, removing a
  // decal re-created it instantly: the trash button cleared the placement, the
  // layer stayed selected, and this effect saw "selected layer with no
  // placement" and put it straight back — so the button looked dead.
  const autoPlaced = useRef(new Set());

  useEffect(() => {
    if (!enabled || !targetMesh || !selectedLayerId) return;
    if (placements3d?.[selectedLayerId]) return;
    if (autoPlaced.current.has(selectedLayerId)) return;
    autoPlaced.current.add(selectedLayerId);
    // Reached only by layers added from the flat editor — anything created in
    // the 3D view already has a placement from the click that made it.

    const box = new THREE.Box3().setFromObject(targetMesh);
    const width = box.max.x - box.min.x;
    const centreX = (box.min.x + box.max.x) / 2;
    const originZ = box.max.z + 1;
    const forward = new THREE.Vector3(0, 0, -1);

    // Fan out across the chest instead of firing one ray down the centre
    // line. A single centre ray misses entirely on any model that isn't solid
    // at x=0 — the soccer export is two separate halves with a gap through
    // the middle, so nothing was ever placed and no text field appeared.
    // Widening rings out from centre also means the first hit is the most
    // central piece of fabric that actually exists.
    const offsets = [0, 0.06, -0.06, 0.12, -0.12, 0.2, -0.2, 0.3, -0.3];
    const heights = [0.72, 0.66, 0.6, 0.78];

    let hit = null;
    outer: for (const hFrac of heights) {
      const y = box.min.y + (box.max.y - box.min.y) * hFrac;
      for (const off of offsets) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(centreX + off * width, y, originZ),
          forward,
        );
        const found = ray.intersectObject(targetMesh, true)[0];
        if (found?.face) {
          hit = found;
          break outer;
        }
      }
    }

    if (!hit) return;
    writePlacement(selectedLayerId, hit.point, hit.face.normal, hit.object.matrixWorld);
  }, [enabled, targetMesh, selectedLayerId, placements3d, writePlacement]);

  const beginDrag = useCallback(() => {
    // Ref first: the window-level pointerup listener checks this
    // synchronously, and a state update wouldn't have landed yet on a fast
    // click-drag-release.
    draggingRef.current = true;
    setIsDragging(true);
    setControlsEnabled(false);
    gl.domElement.style.cursor = "grabbing";
  }, [gl, setControlsEnabled]);

  /**
   * Which layer, if any, is under the pointer.
   *
   * Can't just read `e.object`. A decal is generated FROM the garment's own
   * triangles, so decal and fabric sit at the same distance from the camera —
   * the raycast tie is broken arbitrarily and the garment frequently wins.
   * That's why artwork couldn't be dragged while the scroll wheel (which
   * never looks at what was hit) resized it fine. Scanning every intersection
   * and preferring a decal makes the grab deterministic.
   */
  const layerUnderPointer = (e) => {
    const hits = e.intersections?.length ? e.intersections : e.object ? [{ object: e.object }] : [];
    for (const hit of hits) {
      const id = hit.object?.userData?.[LAYER_KEY];
      if (id) return id;
    }
    return null;
  };

  /**
   * Would a decal at this transform actually produce geometry?
   *
   * DecalGeometry returns an EMPTY buffer (not an error) when its projection
   * box fails to enclose any triangles. A placement like that is invisible
   * AND unraycastable, so the artwork is gone for good. Rather than banning
   * whole regions of the garment — which stopped people putting a badge on a
   * sleeve or round the side — the placement is simply tried first and only
   * accepted if it yields real geometry.
   *
   * Runs once per drop, never per pointer-move.
   */
  const placementIsValid = useCallback(
    (transform) => {
      if (!targetMesh) return false;
      const layer = layers.find((l) => l.id === selectedLayerIdRef.current);
      const aspect = aspects[layer?.id] ?? 1;
      const s = transform.scale;
      const w = s * (aspect >= 1 ? 1 : aspect);
      const h = s * (aspect >= 1 ? 1 / aspect : 1);
      try {
        const g = new DecalGeometry(
          targetMesh,
          new THREE.Vector3().fromArray(transform.position),
          new THREE.Euler().fromArray(transform.orientation),
          // Depth scales with the artwork: a large skin spanning a curved
          // panel needs a deeper box to capture the triangles beneath it than
          // a small chest badge does.
          new THREE.Vector3(w, h, Math.max(0.12, s * 1.5)),
        );
        const ok = (g.attributes?.position?.count ?? 0) > 0;
        g.dispose();
        return ok;
      } catch {
        return false;
      }
    },
    [targetMesh, layers, aspects],
  );

  validityRef.current = placementIsValid;

  const handlePointerDown = (e) => {
    if (!enabled) return;

    const hitLayerId = layerUnderPointer(e);

    // Placing a brand-new item: it lands exactly where they clicked. This is
    // the ONLY case where a click on bare fabric creates or moves anything —
    // an unconditional click-to-place meant every attempt to orbit flung the
    // selected design across the chest.
    if (!hitLayerId && pendingLayer && e.face) {
      e.stopPropagation();
      onCommitPending?.({
        position: e.point.toArray(),
        orientation: orientationFromHit(e.point, e.face.normal, e.object.matrixWorld, 0),
        scale: DEFAULT_SIZE[pendingLayer.type] ?? 0.18,
        roll: 0,
      });
      return;
    }

    // Existing artwork is moved by grabbing it and dragging.
    if (!hitLayerId) return; // fall through to OrbitControls

    e.stopPropagation();
    onSelectLayer?.(hitLayerId);
    beginDrag();
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !selectedLayerId || !e.face) return;
    e.stopPropagation();


    const existing = placements3d?.[selectedLayerId];
    const next = {
      position: e.point.toArray(),
      orientation: orientationFromHit(
        e.point,
        e.face.normal,
        e.object.matrixWorld,
        existing?.roll ?? 0,
      ),
      scale: existing?.scale ?? defaultSizeFor(selectedLayerId),
      roll: existing?.roll ?? 0,
    };
    dragTransformRef.current = next;
    setDragTransform(next);
  };

  // Bound to the window: releasing after dragging off the silhouette would
  // otherwise never fire, leaving the camera locked and the decal stuck to
  // the cursor.
  useEffect(() => {
    const end = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      setControlsEnabled(true);
      gl.domElement.style.cursor = "";

      // Commit where they released — a single geometry rebuild. Read through
      // refs, never the closure: this listener is bound once, so a closure
      // would still hold the values from first render (when nothing was
      // selected) and the drop would be silently discarded, snapping the
      // artwork back to where the drag started.
      const finalT = dragTransformRef.current;
      const layerId = selectedLayerIdRef.current;
      // Accept the drop anywhere it produces real geometry — sleeves, sides,
      // round the back. Only a genuinely impossible spot is refused, and then
      // the artwork stays where it was rather than disappearing.
      if (finalT && layerId && validityRef.current(finalT)) {
        onPlaceLayerRef.current?.(layerId, finalT);
      }

      dragTransformRef.current = null;
      setDragTransform(null);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [gl, setControlsEnabled]);

  const adjustSelected = useCallback(
    (patch) => {
      const current = placements3d?.[selectedLayerId];
      if (!current) return;
      onPlaceLayer?.(selectedLayerId, { ...current, ...patch });
    },
    [placements3d, selectedLayerId, onPlaceLayer],
  );

  const scaleSelected = useCallback(
    (dir) => {
      const current = placements3d?.[selectedLayerId];
      if (!current) return;
      const factor = dir > 0 ? SCALE_STEP : 1 / SCALE_STEP;
      adjustSelected({
        scale: THREE.MathUtils.clamp(current.scale * factor, MIN_DECAL_SIZE, MAX_DECAL_SIZE),
      });
    },
    [placements3d, selectedLayerId, adjustSelected],
  );

  // Rotates about the decal's own forward axis (its local +Z, pointing along
  // the surface normal), so "rotate right" spins the artwork within the
  // fabric rather than tilting it off a curved panel.
  const rotateSelected = useCallback(
    (dir) => {
      const current = placements3d?.[selectedLayerId];
      if (!current) return;
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler().fromArray(current.orientation),
      );
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, dir * ROTATE_STEP));
      adjustSelected({
        roll: (current.roll ?? 0) + dir * ROTATE_STEP,
        orientation: new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3),
      });
    },
    [placements3d, selectedLayerId, adjustSelected],
  );

  const handleWheel = (e) => {
    if (!enabled || !selectedLayerId || !placements3d?.[selectedLayerId]) return;
    e.stopPropagation();
    scaleSelected(e.deltaY < 0 ? 1 : -1);
  };

  const handlePointerOver = (e) => {
    if (!enabled) return;
    const overArtwork = Boolean(layerUnderPointer(e));
    gl.domElement.style.cursor = isDragging
      ? "grabbing"
      : pendingLayer
      ? "copy"
      : overArtwork
      ? "grab"
      : "default";
  };

  const handlePointerOut = () => {
    if (!isDragging) gl.domElement.style.cursor = "";
  };

  const placedLayers = useMemo(
    () => layers.filter((l) => placements3d?.[l.id]),
    [layers, placements3d],
  );

  const selectedPlacement = selectedLayerId ? placements3d?.[selectedLayerId] : null;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;

  // Tracks the most recently added text layer so its editor opens focused
  // exactly once. Comparing against a ref (rather than reacting to selection)
  // keeps focus from being yanked back every time the component re-renders
  // mid-drag.
  const seenTextLayers = useRef(new Set());
  const freshTextLayerId = useMemo(() => {
    if (selectedLayer?.type !== "text") return null;
    if (seenTextLayers.current.has(selectedLayer.id)) return null;
    seenTextLayers.current.add(selectedLayer.id);
    return selectedLayer.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer?.id, selectedLayer?.type]);

  return (
    // No transform on this wrapper: DecalGeometry output is already in world
    // space, so the decals must sit at identity while the garment carries the
    // offset on its own nested group.
    <group
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onWheel={handleWheel}
    >
      <group ref={garmentRef} position={[0, offsetY, 0]}>
        <GarmentModel
          productType={productType}
          color={color}
          colorB={colorB}
          splitAt={splitAt}
          softness={softness}
        />
      </group>

      {targetMesh &&
        placedLayers.map((layer) => {
          const p = placements3d[layer.id];
          return (
            <DesignDecal
              key={layer.id}
              layer={layer}
              targetMesh={targetMesh}
              selected={selectedLayerId === layer.id}
              // While dragging, artwork must stop intercepting raycasts —
              // otherwise the decal chases the cursor by re-hitting itself
              // and the drag never reaches the fabric underneath.
              interactive={!isDragging}
              layerKey={LAYER_KEY}
              onAspect={reportAspect}
              position={p.position}
              orientation={p.orientation}
              scale={p.scale}
              dragTransform={
                isDragging && selectedLayerId === layer.id ? dragTransform : null
              }
            />
          );
        })}

    </group>
  );
}
