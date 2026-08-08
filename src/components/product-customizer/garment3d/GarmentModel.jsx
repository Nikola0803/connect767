import { Suspense, useMemo } from "react";
import { RoundedBox, useGLTF } from "@react-three/drei";

/**
 * Procedural stand-in geometry for each built-in product type — not final
 * production art, but a real, correctly-proportioned 3D shape (not a flat
 * image) that rotates, catches light, and recolors live. Swap in a real
 * scanned/modeled GLTF any time by setting a product's "3D model URL" field
 * in wp-admin (see connect767-cms's product_type CPT) — GltfGarment below
 * takes over automatically and these primitives are never rendered.
 */
function TshirtMesh({ color }) {
  return (
    <group>
      <RoundedBox args={[1.9, 2.6, 1.0]} radius={0.28} smoothness={4} position={[0, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.02} />
      </RoundedBox>
      {/* Collar notch */}
      <mesh position={[0, 1.28, 0.3]} castShadow>
        <torusGeometry args={[0.32, 0.09, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#00000022" roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[0.85, 0.55, 0.55]}
          radius={0.2}
          smoothness={3}
          position={[side * 1.28, 0.55, 0.05]}
          rotation={[0, 0, side * -0.35]}
          castShadow
        >
          <meshStandardMaterial color={color} roughness={0.78} metalness={0.02} />
        </RoundedBox>
      ))}
    </group>
  );
}

function HoodieMesh({ color }) {
  return (
    <group>
      <RoundedBox args={[2.0, 2.7, 1.1]} radius={0.3} smoothness={4} position={[0, -0.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} />
      </RoundedBox>
      {/* Hood */}
      <mesh position={[0, 1.35, -0.25]} rotation={[0.4, 0, 0]} castShadow>
        <sphereGeometry args={[0.55, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} side={2} />
      </mesh>
      {/* Kangaroo pocket */}
      <RoundedBox args={[1.1, 0.65, 0.18]} radius={0.1} position={[0, -0.75, 0.65]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[0.95, 0.6, 0.6]}
          radius={0.22}
          smoothness={3}
          position={[side * 1.35, 0.4, 0.05]}
          rotation={[0, 0, side * -0.35]}
          castShadow
        >
          <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} />
        </RoundedBox>
      ))}
    </group>
  );
}

function CapMesh({ color }) {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.02} side={2} />
      </mesh>
      {/* Brim */}
      <mesh position={[0, -0.02, 0.65]} rotation={[-0.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.06, 24, 1, false, -0.65, 1.3]} />
        <meshStandardMaterial color={color} roughness={0.75} metalness={0.02} />
      </mesh>
      {/* Button on top */}
      <mesh position={[0, 1.16, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

function SocksMesh({ color }) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.5, 1.8, 20]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.01} />
      </mesh>
      <mesh position={[0, -0.35, 0.28]} rotation={[0.35, 0, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.48, 0.9, 6, 16]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.01} />
      </mesh>
      {/* Cuff stripe */}
      <mesh position={[0, 1.42, 0]}>
        <torusGeometry args={[0.55, 0.08, 10, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
    </group>
  );
}

const PRIMITIVE_BY_SLUG = {
  tshirt: TshirtMesh,
  hoodie: HoodieMesh,
  cap: CapMesh,
  socks: SocksMesh,
  jersey: TshirtMesh,
};

// GLB paths for product types that have a real model in /public/models/.
// The uniform studio passes slug="jersey" — routes it to the Rodin GLB
// instead of the procedural TshirtMesh fallback.
const MODEL_BY_SLUG = {
  jersey: "/models/jersey.glb",
};

function GltfGarment({ url, color }) {
  // useGLTF caches and shares one scene object per URL across every
  // consumer — mutating it directly (as this used to) meant every render
  // walked the whole node graph and permanently overwrote the shared
  // scene's materials with a fresh clone-of-a-clone, both wasteful (a
  // side effect running during render, on every render) and unsafe the
  // moment more than one GltfGarment for the same URL is ever on screen
  // at once, since they'd stomp on each other's color. Cloning the scene
  // graph once per URL gives this instance its own copy to mutate safely.
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Best-effort uniform recolor — applies the selected garment color to
  // every material on the model. A model with multiple distinct fabric
  // zones (e.g. body vs. trim) can skip this by naming a mesh/material
  // "no-recolor" (checked here), left for a future admin-driven mapping.
  // Runs only when the clone or color actually changes, not on every
  // render, and always clones from the untouched original material
  // (stashed in userData) rather than the previous clone, so repeated
  // color swaps can't compound floating-point drift or leak memory.
  useMemo(() => {
    cloned.traverse((child) => {
      if (child.isMesh && child.material && !child.name.includes("no-recolor")) {
        if (!child.userData.c767BaseMaterial) {
          child.userData.c767BaseMaterial = child.material;
        }
        child.material = child.userData.c767BaseMaterial.clone();
        child.material.color.set(color);
      }
    });
  }, [cloned, color]);

  return <primitive object={cloned} />;
}

/** Renders the current product as a real 3D mesh.
 * Priority: admin-configured modelUrl > MODEL_BY_SLUG bundled GLB > procedural fallback. */
export default function GarmentModel({ productType, color }) {
  const slug = productType?.slug;
  const url = productType?.modelUrl || MODEL_BY_SLUG[slug];
  if (url) {
    return (
      <Suspense fallback={<FallbackPrimitive slug={slug} color={color} />}>
        <GltfGarment url={url} color={color} />
      </Suspense>
    );
  }
  return <FallbackPrimitive slug={slug} color={color} />;
}

function FallbackPrimitive({ slug, color }) {
  const Mesh = PRIMITIVE_BY_SLUG[slug] || TshirtMesh;
  return <Mesh color={color} />;
}
