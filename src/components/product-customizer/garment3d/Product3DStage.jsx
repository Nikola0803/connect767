import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows, Html } from "@react-three/drei";
import GarmentModel from "./GarmentModel";
import DesignPlane from "./DesignPlane";
import { resolveAnchor } from "./zoneAnchors";

/**
 * The real-time 3D product preview — a genuine rotate/zoom/orbit view of
 * the garment (not a flat mockup), with the customer's design mapped onto
 * the correct zone live. Sits alongside the flat 2D editor (ProductStage)
 * rather than replacing it: precise drag/resize/rotate placement stays on
 * the proven flat canvas (see ProductCustomizerPage's Edit/3D Preview
 * toggle), and this view is what actually rotates in space so the whole
 * team can see the finished product from every angle before ordering.
 */
export default function Product3DStage({ productType, color, textures, spinning = true }) {
  const controlsRef = useRef(null);

  const placements = productType?.placements || [];

  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{background:"#14110d", height:"70vh"}}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.95, 4.5], fov: 36 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Suspense fallback={<Html center className="text-xs text-foreground-500 font-label">Loading 3D preview…</Html>}>
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[3, 4, 4]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-3, 2, -3]} intensity={0.35} />
          <Environment preset="city" environmentIntensity={0.35} />

          <group position={[0, -0.95, 0]}>
            <GarmentModel productType={productType} color={color} />
            {placements.map((p) => {
              const canvas = textures?.[p.key];
              if (!canvas) return null;
              return (
                <DesignPlane key={p.key} anchor={resolveAnchor(productType?.slug, p.key)} canvas={canvas} />
              );
            })}
          </group>

          <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={3} blur={2.4} far={2} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          minDistance={2.6}
          maxDistance={7}
          minPolarAngle={Math.PI * 0.18}
          maxPolarAngle={Math.PI * 0.82}
          autoRotate={spinning}
          autoRotateSpeed={1.6}
          onStart={() => {
            if (controlsRef.current) controlsRef.current.autoRotate = false;
          }}
        />
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-label text-foreground-400 bg-background-50/80 px-2.5 py-1 rounded-full border border-background-200/60">
        Drag to rotate · scroll to zoom
      </div>
    </div>
  );
}
