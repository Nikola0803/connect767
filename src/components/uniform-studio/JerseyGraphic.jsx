import { useId } from "react";
import { fabricShades } from "../../lib/color";

const HOLE_COLOR = "#f6f1e7";

function ZoneGradient({ id, hex, angle = 135 }) {
  const { highlight, base, shadow } = fabricShades(hex);
  const rad = (angle * Math.PI) / 180;
  const x2 = 50 + 50 * Math.cos(rad);
  const y2 = 50 + 50 * Math.sin(rad);
  const x1 = 50 - 50 * Math.cos(rad);
  const y1 = 50 - 50 * Math.sin(rad);
  return (
    <linearGradient id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
      <stop offset="0%" stopColor={highlight} />
      <stop offset="55%" stopColor={base} />
      <stop offset="100%" stopColor={shadow} />
    </linearGradient>
  );
}

function Sleeve({ side, length, fill, trimFill, opacity = 1 }) {
  const flip = side === "right";
  const sx = flip ? (x) => 400 - x : (x) => x;

  if (length === "Sleeveless") {
    return (
      <path
        d={`M${sx(118)},146 Q${sx(96)},148 ${sx(97)},172 Q${sx(98)},192 ${sx(120)},190`}
        fill="none"
        stroke={trimFill}
        strokeWidth="6"
        strokeLinecap="round"
        opacity={0.9 * opacity}
      />
    );
  }

  if (length === "Long") {
    return (
      <g opacity={opacity}>
        <path
          d={`M147,58 Q97,66 86,88 Q66,190 64,298 Q90,293 112,286 Q116,290 118,282
              Q122,160 147,58 Z`}
          fill={fill}
        />
        <path
          d={`M64,294 Q90,289 112,282 Q114,296 113,308 Q88,315 63,320 Q62,306 64,294 Z`}
          fill={trimFill}
        />
      </g>
    );
  }

  // Short (default)
  return (
    <g opacity={opacity}>
      <path
        d={`M147,58 Q100,64 91,78 Q78,116 80,154 Q100,150 119,146 Q121,100 147,58 Z`}
        fill={fill}
      />
      <path
        d={`M80,150 Q100,146 119,142 Q120,154 118,164 Q98,168 79,162 Q79,156 80,150 Z`}
        fill={trimFill}
      />
    </g>
  );
}

function Collar({ style, trimFill }) {
  if (style === "V-Neck") {
    return (
      <>
        <path d="M170,58 Q200,56 230,58 L200,122 Z" fill={HOLE_COLOR} />
        <path
          d="M170,58 Q185,90 200,122 Q215,90 230,58"
          fill="none"
          stroke={trimFill}
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </>
    );
  }

  if (style === "Polo") {
    return (
      <>
        <ellipse cx="200" cy="68" rx="29" ry="15" fill={HOLE_COLOR} />
        <ellipse cx="200" cy="68" rx="29" ry="15" fill="none" stroke={trimFill} strokeWidth="5" />
        <path d="M191,80 L209,80 L207,116 Q200,120 193,116 Z" fill={trimFill} opacity="0.9" />
        <circle cx="200" cy="90" r="1.6" fill="#00000055" />
        <circle cx="200" cy="103" r="1.6" fill="#00000055" />
      </>
    );
  }

  // Crew (default)
  return (
    <>
      <ellipse cx="200" cy="64" rx="33" ry="16" fill={HOLE_COLOR} />
      <ellipse cx="200" cy="64" rx="33" ry="16" fill="none" stroke={trimFill} strokeWidth="6" />
    </>
  );
}

/**
 * Vector jersey mockup, front or back, with fabric-style gradient shading
 * per zone (body / sleeve / trim / side panel) instead of flat fills, a
 * smooth curved silhouette instead of straight polygon edges, soft ambient
 * shadow under the collar and arms, and a drop shadow for depth — the same
 * dynamic-recolor technique real mockup tools use, built from curves and
 * gradients rather than a static photo.
 */
export default function JerseyGraphic({ view = "front", collar, sleeve, colors, highlightZone = null }) {
  const uid = useId();
  const gradId = (zone) => `jg-${uid}-${zone}`;
  // The collar neckline gets its own color if the customer picked one
  // distinct from the general hem/cuff trim — falls back to `trim` so
  // anything still using the old 4-zone color set (no `collar` key) renders
  // exactly as before.
  const collarColor = colors.collar || colors.trim;

  // When a color row in the Design panel is hovered, everything except that
  // zone dims — a direct visual answer to "what does this actually change?"
  // instead of making the customer guess which swatch maps to which part.
  const zoneOpacity = (zone) => (highlightZone && highlightZone !== zone ? 0.28 : 1);

  return (
    <svg viewBox="0 0 400 520" className="w-full h-full" role="img" aria-label={`Jersey ${view}`}>
      <defs>
        <ZoneGradient id={gradId("body")} hex={colors.body} angle={125} />
        <ZoneGradient id={gradId("sleeve")} hex={colors.sleeve} angle={110} />
        <ZoneGradient id={gradId("trim")} hex={colors.trim} angle={90} />
        <ZoneGradient id={gradId("panel")} hex={colors.panel} angle={100} />
        <ZoneGradient id={gradId("collar")} hex={collarColor} angle={90} />

        <radialGradient id={gradId("collarShadow")} cx="50%" cy="20%" r="60%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <filter id={gradId("dropShadow")} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter={`url(#${gradId("dropShadow")})`}>
        {/* Sleeves render first so the torso overlaps them at the shoulder seam */}
        <Sleeve
          side="left"
          length={sleeve}
          fill={`url(#${gradId("sleeve")})`}
          trimFill={`url(#${gradId("trim")})`}
          opacity={zoneOpacity("sleeve")}
        />
        <Sleeve
          side="right"
          length={sleeve}
          fill={`url(#${gradId("sleeve")})`}
          trimFill={`url(#${gradId("trim")})`}
          opacity={zoneOpacity("sleeve")}
        />

        {/* Torso — smooth curved silhouette */}
        <path
          d="M147,58
             Q200,44 253,58
             Q282,92 288,146
             Q297,300 301,468
             Q200,480 99,468
             Q103,300 112,146
             Q118,92 147,58 Z"
          fill={`url(#${gradId("body")})`}
          opacity={zoneOpacity("body")}
        />

        {/* Side panels, following the same curve */}
        <g opacity={zoneOpacity("panel")}>
          <path
            d="M112,146 Q126,146 132,150 Q123,300 121,468 Q110,467 99,468 Q103,300 112,146 Z"
            fill={`url(#${gradId("panel")})`}
          />
          <path
            d="M288,146 Q274,146 268,150 Q277,300 279,468 Q290,467 301,468 Q297,300 288,146 Z"
            fill={`url(#${gradId("panel")})`}
          />
        </g>

        {/* Hem band */}
        <path
          d="M99,468 Q200,480 301,468 L300,484 Q200,496 100,484 Z"
          fill={`url(#${gradId("trim")})`}
          opacity={zoneOpacity("trim")}
        />

        {/* Fabric fold highlights */}
        <g stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M160,180 Q155,320 165,450" />
          <path d="M245,175 Q252,320 240,450" />
        </g>
        <g stroke="#00000012" strokeWidth="1.5" fill="none">
          <path d="M147,58 Q122,95 112,146" />
          <path d="M253,58 Q278,95 288,146" />
        </g>

        <g opacity={zoneOpacity("collar")}>
          {view === "front" ? (
            <Collar style={collar} trimFill={`url(#${gradId("collar")})`} />
          ) : (
            <ellipse
              cx="200"
              cy="66"
              rx="29"
              ry="13"
              fill={HOLE_COLOR}
              stroke={`url(#${gradId("collar")})`}
              strokeWidth="6"
            />
          )}
        </g>

        {/* Ambient occlusion under the collar */}
        <ellipse cx="200" cy="95" rx="70" ry="40" fill={`url(#${gradId("collarShadow")})`} />
      </g>
    </svg>
  );
}
