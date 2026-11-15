import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";

const DEFAULT_COLORS = {
  body: "#ffffff",
  sleeve: "#ffffff",
  collar: "#ffffff",
  shorts: "#ffffff",
  socks: "#ffffff",
  shirtStrip: "#e8e4da",
  sleeveStrip: "#e8e4da",
  shortsStrip: "#e8e4da",
};

let fabricNormalTexture;

function fabricNormal() {
  if (fabricNormalTexture) return fabricNormalTexture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const weaveX = Math.sin((x / size) * Math.PI * 24) * 8;
      const weaveY = Math.cos((y / size) * Math.PI * 32) * 8;
      data[index] = 128 + weaveX;
      data[index + 1] = 128 + weaveY;
      data[index + 2] = 248;
      data[index + 3] = 255;
    }
  }
  fabricNormalTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  fabricNormalTexture.wrapS = THREE.RepeatWrapping;
  fabricNormalTexture.wrapT = THREE.RepeatWrapping;
  fabricNormalTexture.repeat.set(5, 7);
  fabricNormalTexture.needsUpdate = true;
  return fabricNormalTexture;
}

function FabricMaterial({ color, textureScale = 1, roughness = 0.82 }) {
  const normal = useMemo(() => fabricNormal(), []);
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={roughness}
      metalness={0}
      sheen={0.28}
      sheenRoughness={0.78}
      sheenColor={new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.22)}
      normalMap={normal}
      normalScale={new THREE.Vector2(0.16 * textureScale, 0.16 * textureScale)}
      envMapIntensity={0.55}
    />
  );
}

function Torso({ colors, dress = false }) {
  const height = dress ? 3.05 : 2.15;
  const topRadius = dress ? 0.68 : 0.76;
  const bottomRadius = dress ? 1.02 : 0.64;
  const centerY = dress ? 0.15 : 0.67;
  const bottomY = centerY - height / 2;
  return (
    <group>
      <mesh
        name="jersey_body"
        userData={{ garmentZone: "body" }}
        position={[0, centerY, 0]}
        scale={[1, 1, 0.47]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[topRadius, bottomRadius, height, 64, 12, false]} />
        <FabricMaterial color={colors.body} />
      </mesh>
      <mesh
        name="shirt_hem"
        userData={{ garmentZone: "shirtStrip" }}
        position={[0, bottomY + 0.045, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, dress ? 0.47 : 0.47, 1]}
        castShadow
      >
        <torusGeometry args={[bottomRadius * 0.98, 0.035, 10, 72]} />
        <FabricMaterial color={colors.shirtStrip} roughness={0.76} />
      </mesh>
    </group>
  );
}

function ShoulderBridge({ colors, sleeveless }) {
  if (sleeveless) return null;
  return (
    <RoundedBox
      name="shoulder_yoke"
      args={[1.62, 0.42, 0.55]}
      radius={0.18}
      smoothness={5}
      position={[0, 1.58, 0]}
      castShadow
      receiveShadow
      userData={{ garmentZone: "body" }}
    >
      <FabricMaterial color={colors.body} />
    </RoundedBox>
  );
}

function Sleeve({ side, length, colors, padded = false }) {
  if (length === "Sleeveless") return null;
  const sign = side === "left" ? -1 : 1;
  const long = length === "Long";
  const height = long ? 1.55 : 0.72;
  const centerY = long ? 0.87 : 1.28;
  const rotationZ = sign * -0.24;
  const cuffY = centerY - height / 2;
  return (
    <group position={[sign * (long ? 0.92 : 0.98), 0, 0]} rotation={[0, 0, rotationZ]}>
      <mesh
        name={`sleeve_${side}`}
        userData={{ garmentZone: "sleeve" }}
        position={[0, centerY, 0]}
        scale={[1, 1, 0.78]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[long ? 0.27 : 0.31, long ? 0.34 : 0.38, height, 40, 8, false]} />
        <FabricMaterial color={colors.sleeve} />
      </mesh>
      {padded && (
        <RoundedBox args={[0.58, 0.5, 0.3]} radius={0.16} position={[0, centerY - 0.12, 0.18]} castShadow>
          <FabricMaterial color={colors.sleeve} roughness={0.9} />
        </RoundedBox>
      )}
      <mesh
        name={`sleeve_cuff_${side}`}
        userData={{ garmentZone: "sleeveStrip" }}
        position={[0, cuffY + 0.04, 0]}
        scale={[1, 1, 0.78]}
        castShadow
      >
        <cylinderGeometry args={[long ? 0.275 : 0.315, long ? 0.29 : 0.33, 0.095, 40]} />
        <FabricMaterial color={colors.sleeveStrip} roughness={0.74} />
      </mesh>
    </group>
  );
}

function CrewCollar({ colors }) {
  return (
    <mesh
      name="collar_crew"
      userData={{ garmentZone: "collar" }}
      position={[0, 1.78, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={[1.18, 0.72, 1]}
      castShadow
    >
      <torusGeometry args={[0.3, 0.065, 12, 56]} />
      <FabricMaterial color={colors.collar} roughness={0.7} />
    </mesh>
  );
}

function VNeckCollar({ colors }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.36, 0, 0),
      new THREE.Vector3(0, -0.32, 0.08),
      new THREE.Vector3(0.36, 0, 0),
    ]);
    return new THREE.TubeGeometry(curve, 32, 0.055, 10, false);
  }, []);
  return (
    <group position={[0, 1.78, 0.22]}>
      <mesh name="collar_vneck" geometry={geometry} userData={{ garmentZone: "collar" }} castShadow>
        <FabricMaterial color={colors.collar} roughness={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, -0.22]} scale={[1.18, 0.7, 1]}>
        <torusGeometry args={[0.3, 0.055, 10, 48, Math.PI]} />
        <FabricMaterial color={colors.collar} roughness={0.7} />
      </mesh>
    </group>
  );
}

function PoloCollar({ colors }) {
  return (
    <group name="collar_polo" position={[0, 1.76, 0.23]} userData={{ garmentZone: "collar" }}>
      <RoundedBox args={[0.42, 0.38, 0.08]} radius={0.04} position={[-0.2, -0.05, 0]} rotation={[0, 0, -0.25]} castShadow>
        <FabricMaterial color={colors.collar} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.42, 0.38, 0.08]} radius={0.04} position={[0.2, -0.05, 0]} rotation={[0, 0, 0.25]} castShadow>
        <FabricMaterial color={colors.collar} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.13, 0.5, 0.07]} radius={0.035} position={[0, -0.34, 0]} castShadow>
        <FabricMaterial color={colors.collar} roughness={0.72} />
      </RoundedBox>
    </group>
  );
}

function Collar({ type, colors }) {
  if (type === "V-Neck") return <VNeckCollar colors={colors} />;
  if (type === "Polo") return <PoloCollar colors={colors} />;
  return <CrewCollar colors={colors} />;
}

function Shorts({ colors, trousers = false }) {
  const legHeight = trousers ? 2.0 : 0.82;
  const centerY = trousers ? -1.17 : -0.83;
  const hemY = centerY - legHeight / 2 + 0.04;
  return (
    <group>
      <RoundedBox
        name="shorts_waistband"
        args={[1.38, 0.2, 0.54]}
        radius={0.08}
        smoothness={4}
        position={[0, -0.42, 0]}
        castShadow
        userData={{ garmentZone: "shorts" }}
      >
        <FabricMaterial color={colors.shorts} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.37, 0, 0]}>
          <RoundedBox
            name={side < 0 ? "shorts_left" : "shorts_right"}
            args={[0.69, legHeight, 0.5]}
            radius={trousers ? 0.16 : 0.14}
            smoothness={5}
            position={[0, centerY, 0]}
            castShadow
            receiveShadow
            userData={{ garmentZone: "shorts" }}
          >
            <FabricMaterial color={colors.shorts} />
          </RoundedBox>
          <RoundedBox
            name={side < 0 ? "shorts_hem_left" : "shorts_hem_right"}
            args={[0.67, 0.085, 0.505]}
            radius={0.035}
            position={[0, hemY, 0]}
            castShadow
            userData={{ garmentZone: "shortsStrip" }}
          >
            <FabricMaterial color={colors.shortsStrip} roughness={0.74} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

function Socks({ colors }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.38, -2.04, 0]}>
          <mesh
            name={side < 0 ? "sock_left" : "sock_right"}
            userData={{ garmentZone: "socks" }}
            scale={[1, 1, 0.78]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.22, 0.18, 1.28, 36, 8]} />
            <FabricMaterial color={colors.socks} textureScale={1.2} roughness={0.88} />
          </mesh>
          <RoundedBox args={[0.42, 0.24, 0.72]} radius={0.11} position={[0, -0.64, 0.16]} castShadow>
            <FabricMaterial color={colors.socks} textureScale={1.2} roughness={0.88} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

export const UNIFORM_KIT_PARTS = [
  "jersey_body",
  "sleeve_left",
  "sleeve_right",
  "collar_crew",
  "collar_vneck",
  "collar_polo",
  "shirt_hem",
  "shorts_left",
  "shorts_right",
  "shorts_waistband",
  "shorts_hem_left",
  "shorts_hem_right",
  "sock_left",
  "sock_right",
];

/**
 * Lightweight, sport-aware ghost-mannequin kit used by Uniform Studio.
 * Every customer-facing color control owns a real mesh, so the 3D preview
 * does not have to fake collars, cuffs or hems with a flat overlay. The
 * geometry is deliberately UV-ready and can be replaced by production GLBs
 * carrying the same mesh names without changing the editor state contract.
 */
export default function UniformKitModel({ sport = "soccer", colors = {}, collar = "Crew", sleeve = "Short" }) {
  const c = { ...DEFAULT_COLORS, ...colors };
  const isNetball = sport === "netball";
  const isBasketball = sport === "basketball";
  const isCricket = sport === "cricket";
  const isGoalkeeper = sport === "goalkeeper";
  const effectiveSleeve = isNetball || isBasketball ? "Sleeveless" : isGoalkeeper ? (sleeve === "Short" ? "Short" : "Long") : sleeve;
  const showSocks = sport === "soccer" || isGoalkeeper;

  return (
    <group name={`connect767_${sport}_kit`} rotation={[0, -0.08, 0]}>
      <Torso colors={c} dress={isNetball} />
      {!isNetball && <ShoulderBridge colors={c} sleeveless={effectiveSleeve === "Sleeveless"} />}
      {!isNetball && <Sleeve side="left" length={effectiveSleeve} colors={c} padded={isGoalkeeper} />}
      {!isNetball && <Sleeve side="right" length={effectiveSleeve === "Mixed" ? "Short" : effectiveSleeve} colors={c} padded={isGoalkeeper} />}
      <Collar type={collar} colors={c} />
      {!isNetball && <Shorts colors={c} trousers={isCricket} />}
      {showSocks && <Socks colors={c} />}
    </group>
  );
}
