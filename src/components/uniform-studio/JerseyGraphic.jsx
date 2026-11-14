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

function Sleeve({ side, length, sport, fill, trimFill, opacity = 1 }) {
  const flip = side === "right";
  const transform = flip ? "translate(400 0) scale(-1 1)" : undefined;

  if (length === "Sleeveless" || sport === "basketball") {
    return (
      <g transform={transform} opacity={opacity}>
        <path d="M149,62 Q116,72 105,111 Q101,139 118,162" fill="none" stroke={trimFill} strokeWidth="8" strokeLinecap="round" />
      </g>
    );
  }

  if (length === "Long") {
    return (
      <g transform={transform} opacity={opacity}>
        <path
          d={sport === "goalkeeper"
            ? "M147,58 Q96,66 82,91 Q60,194 62,306 Q88,308 116,292 Q119,166 147,58 Z"
            : "M147,58 Q97,66 86,88 Q66,190 64,298 Q90,293 112,286 Q116,290 118,282 Q122,160 147,58 Z"}
          fill={fill}
        />
        {sport === "goalkeeper" && (
          <>
            <path d="M83,100 Q66,147 66,188 Q88,200 111,187 Q116,137 126,91 Z" fill={trimFill} opacity="0.72" />
            <path d="M66,205 Q61,249 63,284 Q87,294 113,278 Q114,237 112,206 Z" fill={trimFill} opacity="0.6" />
          </>
        )}
        <path
          d="M64,294 Q90,289 112,282 Q114,296 113,308 Q88,315 63,320 Q62,306 64,294 Z"
          fill={trimFill}
        />
      </g>
    );
  }

  // Short (default)
  return (
    <g transform={transform} opacity={opacity}>
      <path
        d={sport === "baseball"
          ? "M147,58 Q99,63 88,82 Q75,119 78,160 Q99,157 122,148 Q124,102 147,58 Z"
          : "M147,58 Q100,64 91,78 Q78,116 80,154 Q100,150 119,146 Q121,100 147,58 Z"}
        fill={fill}
      />
      <path
        d={`M80,150 Q100,146 119,142 Q120,154 118,164 Q98,168 79,162 Q79,156 80,150 Z`}
        fill={trimFill}
      />
    </g>
  );
}

function bodyPathForSport(sport) {
  if (sport === "basketball") {
    return "M155,58 Q200,43 245,58 Q270,77 279,118 Q289,270 294,468 Q200,482 106,468 Q111,270 121,118 Q130,77 155,58 Z";
  }
  if (sport === "baseball") {
    return "M147,58 Q200,44 253,58 Q280,91 286,143 Q292,286 294,452 Q200,463 106,452 Q108,286 114,143 Q120,91 147,58 Z";
  }
  if (sport === "cricket" || sport === "other") {
    return "M146,58 Q200,45 254,58 Q280,91 286,145 Q291,300 292,466 Q200,476 108,466 Q109,300 114,145 Q120,91 146,58 Z";
  }
  if (sport === "goalkeeper") {
    return "M143,58 Q200,42 257,58 Q286,94 291,151 Q297,302 299,470 Q200,484 101,470 Q103,302 109,151 Q114,94 143,58 Z";
  }
  return "M147,58 Q200,44 253,58 Q282,92 288,146 Q297,300 301,468 Q200,480 99,468 Q103,300 112,146 Q118,92 147,58 Z";
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
export default function JerseyGraphic({ sport = "soccer", view = "front", collar, sleeve, colors, highlightZone = null }) {
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
          sport={sport}
          fill={`url(#${gradId("sleeve")})`}
          trimFill={`url(#${gradId("trim")})`}
          opacity={zoneOpacity("sleeve")}
        />
        <Sleeve
          side="right"
          length={sleeve}
          sport={sport}
          fill={`url(#${gradId("sleeve")})`}
          trimFill={`url(#${gradId("trim")})`}
          opacity={zoneOpacity("sleeve")}
        />

        {/* Torso — smooth curved silhouette */}
        <path
          d={bodyPathForSport(sport)}
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

        {sport === "basketball" && (
          <g fill={HOLE_COLOR} stroke={`url(#${gradId("trim")})`} strokeWidth="5" opacity={zoneOpacity("trim")}>
            <path d="M149,66 Q119,80 113,119 Q111,144 126,166 Q136,139 142,112 Q148,85 149,66 Z" />
            <path d="M251,66 Q281,80 287,119 Q289,144 274,166 Q264,139 258,112 Q252,85 251,66 Z" />
          </g>
        )}

        {sport === "baseball" && view === "front" && (
          <g opacity={zoneOpacity("trim")}>
            <path d="M200,78 L200,451" stroke={`url(#${gradId("trim")})`} strokeWidth="5" />
            {[112, 157, 202, 247, 292, 337].map((cy) => (
              <circle key={cy} cx="200" cy={cy} r="4" fill={`url(#${gradId("trim")})`} />
            ))}
            <path d="M148,62 Q168,98 200,116 Q232,98 252,62" fill="none" stroke={`url(#${gradId("panel")})`} strokeWidth="6" />
          </g>
        )}

        {sport === "cricket" && (
          <g opacity={zoneOpacity("panel")}>
            <path d="M143,63 Q200,90 257,63 L270,102 Q200,128 130,102 Z" fill={`url(#${gradId("panel")})`} opacity="0.78" />
            <path d="M136,150 Q121,290 126,459" fill="none" stroke={`url(#${gradId("panel")})`} strokeWidth="8" />
            <path d="M264,150 Q279,290 274,459" fill="none" stroke={`url(#${gradId("panel")})`} strokeWidth="8" />
          </g>
        )}

        {sport === "goalkeeper" && (
          <g opacity={zoneOpacity("panel")}>
            <path d="M143,63 Q200,84 257,63 L274,113 Q200,135 126,113 Z" fill={`url(#${gradId("panel")})`} opacity="0.52" />
            <path d="M117,168 Q139,158 155,171 L150,214 Q133,224 113,212 Z" fill={`url(#${gradId("panel")})`} opacity="0.62" />
            <path d="M283,168 Q261,158 245,171 L250,214 Q267,224 287,212 Z" fill={`url(#${gradId("panel")})`} opacity="0.62" />
          </g>
        )}

        {sport === "other" && (
          <g opacity={zoneOpacity("panel")}>
            <path d="M119,151 Q132,145 143,151 Q134,300 133,464 L108,466 Q109,300 114,145 Z" fill={`url(#${gradId("panel")})`} />
            <path d="M281,151 Q268,145 257,151 Q266,300 267,464 L292,466 Q291,300 286,145 Z" fill={`url(#${gradId("panel")})`} />
          </g>
        )}

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
