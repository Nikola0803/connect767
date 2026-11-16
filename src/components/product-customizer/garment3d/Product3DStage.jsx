import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows, Html } from "@react-three/drei";
import GarmentModel from "./GarmentModel";
import DesignPlane from "./DesignPlane";
import InteractiveGarment from "./InteractiveGarment";
import { resolveAnchor } from "./zoneAnchors";
import { studioBackgroundGradient } from "../../uniform-studio/studioBackgrounds";

/**
 * The real-time 3D product preview — a genuine rotate/zoom/orbit view of
 * the garment (not a flat mockup), with the customer's design mapped onto
 * the correct zone live. Sits alongside the flat 2D editor (ProductStage)
 * rather than replacing it: precise drag/resize/rotate placement stays on
 * the proven flat canvas (see ProductCustomizerPage's Edit/3D Preview
 * toggle), and this view is what actually rotates in space so the whole
 * team can see the finished product from every angle before ordering.
 */
/**
 * Hands the live WebGL renderer up to the page so the finished design can be
 * screenshotted for the quote.
 *
 * Without this the order confirmation had no image at all whenever the
 * customer designed in 3D: the preview was captured from the flat editor's
 * DOM node, which isn't even mounted while the 3D view is open. Capturing
 * needs `preserveDrawingBuffer: true` on the Canvas (set below) — otherwise
 * the drawing buffer is cleared after compositing and toDataURL() returns a
 * blank frame.
 */
function CaptureBridge({ onReady }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!onReady) return;
    onReady(() => {
      try {
        // Force a synchronous render immediately before reading the buffer.
        // React Three Fiber renders on demand, so without this the buffer can
        // hold a stale frame from before the last edit.
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    });
    return () => onReady(null);
  }, [gl, scene, camera, onReady]);

  return null;
}

export default function Product3DStage({
  productType,
  color,
  colorB,
  splitAt,
  softness,
  zoneColors,
  collar,
  sleeve,
  garmentPattern,
  textures,
  spinning = true,
  fullscreen = false,
  // ---- Direct 3D placement (optional) ----
  // When `layers` is supplied the stage becomes interactive: layers are
  // projected onto the mesh as decals and can be dragged/scaled on it. Left
  // out, the stage keeps its original read-only texture-plane behaviour, so
  // existing callers (ProductCustomizerPage) are unaffected.
  layers = null,
  selectedLayerId = null,
  onSelectLayer,
  onPlaceLayer,
  onRemoveLayer,
  onUpdateLayer,
  onRecolorLayer,
  placements3d,
  pendingLayer,
  onCommitPending,
  // Receives a capture function (or null on unmount) the page can call to get
  // a PNG data URL of the current 3D view.
  onCaptureReady,
  studioBackground,
}) {
  const controlsRef = useRef(null);

  const placements = productType?.placements || [];
  const interactive = Array.isArray(layers);
  // Auto-rotation fights direct manipulation — you can't drag a badge onto a
  // moving target.
  const autoRotate = spinning && !interactive;
  const isUniformKit = Boolean(productType?.uniformKit);
  const modelOffsetY = isUniformKit ? 0 : -0.95;

  const containerHeight = fullscreen ? "calc(100dvh - 180px)" : "70dvh";

  return (
    <div
      className={`relative w-full ${fullscreen ? "" : "rounded-2xl"} overflow-hidden`}
      style={{ background: isUniformKit ? studioBackgroundGradient(studioBackground) : "#14110d", height: containerHeight }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: isUniformKit ? [0, -0.45, 10.5] : [0, 0.95, 4.5], fov: isUniformKit ? 30 : 36 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <CaptureBridge onReady={onCaptureReady} />
        <Suspense fallback={<Html center className="text-xs text-foreground-500 font-label">Loading 3D preview…</Html>}>
          <ambientLight intensity={isUniformKit ? 0.9 : 0.65} />
          <directionalLight
            position={[3.5, 5, 5]}
            intensity={isUniformKit ? 2.15 : 1.1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-4, 2.5, 3]} intensity={isUniformKit ? 1.05 : 0.35} />
          <directionalLight position={[1.5, 3, -4]} intensity={isUniformKit ? 1.35 : 0.25} />
          <Environment preset={isUniformKit ? "studio" : "city"} environmentIntensity={isUniformKit ? 0.62 : 0.35} />

          {interactive ? (
            /* Deliberately NOT wrapped in the offset group. DecalGeometry
               bakes the target's matrixWorld into its vertices, so its output
               is already world-space; nesting it under a translated group
               would apply that -0.95 a second time and drop every decal a
               metre below the garment. InteractiveGarment therefore applies
               the offset to the garment only, and keeps decals at identity. */
            <InteractiveGarment
              productType={productType}
              color={color}
              colorB={colorB}
              splitAt={splitAt}
              softness={softness}
              zoneColors={zoneColors}
              collar={collar}
              sleeve={sleeve}
              garmentPattern={garmentPattern}
              offsetY={modelOffsetY}
              layers={layers}
              selectedLayerId={selectedLayerId}
              onSelectLayer={onSelectLayer}
              onPlaceLayer={onPlaceLayer}
              onRemoveLayer={onRemoveLayer}
              onUpdateLayer={onUpdateLayer}
              onRecolorLayer={onRecolorLayer}
              placements3d={placements3d}
              pendingLayer={pendingLayer}
              onCommitPending={onCommitPending}
            />
          ) : (
            <group position={[0, modelOffsetY, 0]}>
              <GarmentModel
                productType={productType}
                color={color}
                zoneColors={zoneColors}
                collar={collar}
                sleeve={sleeve}
                garmentPattern={garmentPattern}
              />
              {placements.map((p) => {
                const canvas = textures?.[p.key];
                if (!canvas) return null;
                return (
                  <DesignPlane key={p.key} anchor={resolveAnchor(productType?.slug, p.key)} canvas={canvas} />
                );
              })}
            </group>
          )}

          <ContactShadows
            position={[0, isUniformKit ? -2.78 : 0, 0]}
            opacity={isUniformKit ? 0.24 : 0.35}
            scale={isUniformKit ? 5 : 3}
            blur={isUniformKit ? 3.2 : 2.4}
            far={3}
          />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={isUniformKit ? [0, -0.45, 0] : [0, 0, 0]}
          enablePan={false}
          minDistance={isUniformKit ? 7.2 : 2.6}
          maxDistance={isUniformKit ? 14 : 7}
          minPolarAngle={Math.PI * 0.18}
          maxPolarAngle={Math.PI * 0.82}
          autoRotate={autoRotate}
          autoRotateSpeed={1.6}
          onStart={() => {
            if (controlsRef.current) controlsRef.current.autoRotate = false;
          }}
        />
      </Canvas>

      {/* In interactive mode the parent shows a context-aware instruction
          instead — "drag to rotate" would actively mislead once dragging the
          garment moves a decal. */}
      {!interactive && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-label text-foreground-500 bg-background-50/85 px-2.5 py-1 rounded-full border border-background-200/70 shadow-sm">
          Drag to rotate · scroll to zoom
        </div>
      )}
    </div>
  );
}
