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
      data[index] = 128 + Math.sin((x / size) * Math.PI * 28) * 7;
      data[index + 1] = 128 + Math.cos((y / size) * Math.PI * 34) * 7;
      data[index + 2] = 248;
      data[index + 3] = 255;
    }
  }
  fabricNormalTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  fabricNormalTexture.wrapS = THREE.RepeatWrapping;
  fabricNormalTexture.wrapT = THREE.RepeatWrapping;
  fabricNormalTexture.repeat.set(7, 9);
  fabricNormalTexture.needsUpdate = true;
  return fabricNormalTexture;
}

function FabricMaterial({ color, textureScale = 1, roughness = 0.8 }) {
  const normal = useMemo(() => fabricNormal(), []);
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={roughness}
      metalness={0}
      sheen={0.36}
      sheenRoughness={0.72}
      sheenColor={new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.24)}
      normalMap={normal}
      normalScale={new THREE.Vector2(0.13 * textureScale, 0.13 * textureScale)}
      envMapIntensity={0.72}
      side={THREE.DoubleSide}
    />
  );
}

function ExtrudedPiece({ name, zone, points, color, depth = 0.48, bevel = 0.055, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], roughness }) {
  const signature = points.flat().join("|");
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 18,
      steps: 2,
    });
    result.translate(0, 0, -depth / 2);
    result.computeVertexNormals();
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, depth, bevel]);

  return (
    <mesh name={name} geometry={geometry} position={position} rotation={rotation} scale={scale} userData={{ garmentZone: zone }} castShadow receiveShadow>
      <FabricMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

const JERSEY_POINTS = [
  [-0.33, 1.72], [-0.76, 1.6], [-0.86, 1.34], [-0.73, -0.42], [-0.62, -0.55],
  [0.62, -0.55], [0.73, -0.42], [0.86, 1.34], [0.76, 1.6], [0.33, 1.72],
  [0.26, 1.5], [0, 1.41], [-0.26, 1.5],
];

const BASKETBALL_POINTS = [
  [-0.29, 1.72], [-0.62, 1.57], [-0.68, 1.22], [-0.66, -0.5], [-0.56, -0.62],
  [0.56, -0.62], [0.66, -0.5], [0.68, 1.22], [0.62, 1.57], [0.29, 1.72],
  [0.22, 1.48], [0, 1.36], [-0.22, 1.48],
];

const NETBALL_DRESS_POINTS = [
  [-0.28, 1.73], [-0.62, 1.55], [-0.63, 1.2], [-0.82, -1.12], [-1.02, -1.72],
  [1.02, -1.72], [0.82, -1.12], [0.63, 1.2], [0.62, 1.55], [0.28, 1.73],
  [0.22, 1.5], [0, 1.39], [-0.22, 1.5],
];

function Torso({ colors, sport }) {
  const isNetball = sport === "netball";
  const isBasketball = sport === "basketball";
  const points = isNetball ? NETBALL_DRESS_POINTS : isBasketball ? BASKETBALL_POINTS : JERSEY_POINTS;
  const hemY = isNetball ? -1.7 : isBasketball ? -0.6 : -0.53;
  const hemWidth = isNetball ? 1.96 : isBasketball ? 1.1 : 1.23;
  return (
    <group>
      <ExtrudedPiece name="jersey_body" zone="body" points={points} color={colors.body} depth={isNetball ? 0.42 : 0.52} bevel={0.065} />
      <RoundedBox name="shirt_hem" args={[hemWidth, 0.075, isNetball ? 0.43 : 0.54]} radius={0.035} smoothness={4} position={[0, hemY, 0]} userData={{ garmentZone: "shirtStrip" }} castShadow>
        <FabricMaterial color={colors.shirtStrip} roughness={0.72} />
      </RoundedBox>
    </group>
  );
}

function sleevePoints(length) {
  if (length === "Long") {
    return [[-0.03, 0.23], [0.55, 0.09], [0.44, -1.48], [0.12, -1.55], [-0.08, -0.12]];
  }
  return [[-0.03, 0.23], [0.61, 0.07], [0.55, -0.58], [0.15, -0.66], [-0.08, -0.12]];
}

function Sleeve({ side, length, colors, padded = false }) {
  if (length === "Sleeveless") return null;
  const sign = side === "left" ? -1 : 1;
  const long = length === "Long";
  const cuffY = long ? -1.49 : -0.61;
  const cuffWidth = long ? 0.34 : 0.43;
  return (
    <group position={[sign * 0.7, 1.45, 0]} scale={[sign, 1, 1]} rotation={[0, 0, sign * -0.035]}>
      <ExtrudedPiece name={`sleeve_${side}`} zone="sleeve" points={sleevePoints(length)} color={colors.sleeve} depth={0.48} bevel={0.055} />
      {padded && (
        <RoundedBox args={[0.34, 0.52, 0.13]} radius={0.08} smoothness={5} position={[0.31, long ? -0.72 : -0.24, 0.29]} userData={{ garmentZone: "sleeve" }} castShadow>
          <FabricMaterial color={colors.sleeve} roughness={0.9} />
        </RoundedBox>
      )}
      <RoundedBox name={`sleeve_cuff_${side}`} args={[cuffWidth, 0.08, 0.49]} radius={0.035} smoothness={4} position={[long ? 0.28 : 0.35, cuffY, 0]} userData={{ garmentZone: "sleeveStrip" }} castShadow>
        <FabricMaterial color={colors.sleeveStrip} roughness={0.72} />
      </RoundedBox>
    </group>
  );
}

function curveTube(points, radius = 0.045, closed = false) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.3), 48, radius, 12, closed);
}

function CrewCollar({ colors }) {
  const geometry = useMemo(() => curveTube([
    new THREE.Vector3(-0.31, 1.7, 0.31), new THREE.Vector3(-0.25, 1.52, 0.34),
    new THREE.Vector3(0, 1.43, 0.35), new THREE.Vector3(0.25, 1.52, 0.34),
    new THREE.Vector3(0.31, 1.7, 0.31), new THREE.Vector3(0, 1.78, 0.02),
  ], 0.052, true), []);
  return <mesh name="collar_crew" geometry={geometry} userData={{ garmentZone: "collar" }} castShadow><FabricMaterial color={colors.collar} roughness={0.68} /></mesh>;
}

function VNeckCollar({ colors }) {
  const geometry = useMemo(() => curveTube([
    new THREE.Vector3(-0.32, 1.7, 0.31), new THREE.Vector3(0, 1.38, 0.35),
    new THREE.Vector3(0.32, 1.7, 0.31), new THREE.Vector3(0, 1.79, 0.02),
  ], 0.05, true), []);
  return <mesh name="collar_vneck" geometry={geometry} userData={{ garmentZone: "collar" }} castShadow><FabricMaterial color={colors.collar} roughness={0.68} /></mesh>;
}

function PoloCollar({ colors }) {
  return (
    <group name="collar_polo" userData={{ garmentZone: "collar" }}>
      <ExtrudedPiece points={[[-0.32, 1.73], [-0.04, 1.53], [-0.08, 1.32], [-0.4, 1.57]]} color={colors.collar} depth={0.08} bevel={0.018} position={[0, 0, 0.31]} />
      <ExtrudedPiece points={[[0.32, 1.73], [0.04, 1.53], [0.08, 1.32], [0.4, 1.57]]} color={colors.collar} depth={0.08} bevel={0.018} position={[0, 0, 0.31]} />
      <RoundedBox args={[0.12, 0.42, 0.08]} radius={0.025} position={[0, 1.25, 0.35]} castShadow><FabricMaterial color={colors.collar} roughness={0.7} /></RoundedBox>
    </group>
  );
}

function Collar({ type, colors }) {
  if (type === "V-Neck") return <VNeckCollar colors={colors} />;
  if (type === "Polo") return <PoloCollar colors={colors} />;
  return <CrewCollar colors={colors} />;
}

const SHORTS_POINTS = [[-0.7, -0.56], [-0.78, -1.48], [-0.12, -1.56], [0, -1.05], [0.12, -1.56], [0.78, -1.48], [0.7, -0.56]];
const BASKETBALL_SHORTS_POINTS = [[-0.72, -0.56], [-0.82, -1.66], [-0.13, -1.72], [0, -1.08], [0.13, -1.72], [0.82, -1.66], [0.72, -0.56]];
const TROUSER_POINTS = [[-0.67, -0.56], [-0.54, -2.65], [-0.12, -2.67], [0, -1.04], [0.12, -2.67], [0.54, -2.65], [0.67, -0.56]];

function Bottoms({ colors, sport }) {
  const trousers = sport === "cricket";
  const basketball = sport === "basketball";
  const points = trousers ? TROUSER_POINTS : basketball ? BASKETBALL_SHORTS_POINTS : SHORTS_POINTS;
  const hemY = trousers ? -2.64 : basketball ? -1.68 : -1.51;
  const outerX = trousers ? 0.51 : basketball ? 0.78 : 0.73;
  return (
    <group>
      <ExtrudedPiece name={trousers ? "trousers" : "shorts"} zone="shorts" points={points} color={colors.shorts} depth={0.5} bevel={0.06} />
      <RoundedBox name="shorts_waistband" args={[1.36, 0.13, 0.52]} radius={0.05} position={[0, -0.59, 0]} userData={{ garmentZone: "shorts" }} castShadow><FabricMaterial color={colors.shorts} /></RoundedBox>
      {[-1, 1].map((side) => (
        <RoundedBox key={side} name={side < 0 ? "shorts_hem_left" : "shorts_hem_right"} args={[trousers ? 0.38 : basketball ? 0.66 : 0.6, 0.075, 0.5]} radius={0.03} position={[side * outerX * 0.52, hemY, 0]} userData={{ garmentZone: "shortsStrip" }} castShadow>
          <FabricMaterial color={colors.shortsStrip} roughness={0.72} />
        </RoundedBox>
      ))}
    </group>
  );
}

const SOCK_POINTS = [[-0.17, 0.66], [-0.23, 0.28], [-0.19, -0.62], [-0.12, -0.93], [-0.34, -1.13], [-0.4, -1.34], [-0.3, -1.46], [0.2, -1.46], [0.26, -1.31], [0.16, -0.91], [0.2, -0.2], [0.15, 0.66]];

function Socks({ colors }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.39, -2.1, 0]} scale={[side, 1, 1]}>
          <ExtrudedPiece name={side < 0 ? "sock_left" : "sock_right"} zone="socks" points={SOCK_POINTS} color={colors.socks} depth={0.42} bevel={0.05} roughness={0.88} />
        </group>
      ))}
    </group>
  );
}

export const UNIFORM_KIT_PARTS = ["jersey_body", "sleeve_left", "sleeve_right", "collar_crew", "collar_vneck", "collar_polo", "shirt_hem", "shorts", "shorts_waistband", "shorts_hem_left", "shorts_hem_right", "sock_left", "sock_right"];

/** Connected, sport-specific ghost-garment geometry for the live configurator. */
export default function UniformKitModel({ sport = "soccer", colors = {}, collar = "Crew", sleeve = "Short" }) {
  const c = { ...DEFAULT_COLORS, ...colors };
  const isNetball = sport === "netball";
  const isBasketball = sport === "basketball";
  const isGoalkeeper = sport === "goalkeeper";
  const effectiveSleeve = isNetball || isBasketball ? "Sleeveless" : isGoalkeeper && sleeve === "Short" ? "Long" : sleeve;
  const showSocks = sport === "soccer" || isGoalkeeper;
  return (
    <group name={`connect767_${sport}_kit`} rotation={[0, -0.12, 0]}>
      <Torso colors={c} sport={sport} />
      {!isNetball && !isBasketball && (
        <>
          <Sleeve side="left" length={effectiveSleeve} colors={c} padded={isGoalkeeper} />
          <Sleeve side="right" length={effectiveSleeve === "Mixed" ? "Short" : effectiveSleeve} colors={c} padded={isGoalkeeper} />
        </>
      )}
      <Collar type={collar} colors={c} />
      {!isNetball && <Bottoms colors={c} sport={sport} />}
      {showSocks && <Socks colors={c} />}
    </group>
  );
}
