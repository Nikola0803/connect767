import { useId } from "react";

const SPRITE_WIDTH = 1159;
const SPRITE_HEIGHT = 1358;
const HALF_WIDTH = SPRITE_WIDTH / 2;
const ASSET_BASE = import.meta.env.BASE_URL;

const APPROVED_ASSETS = {
  soccer: `${ASSET_BASE}uploads/uniform-editor/approved-soccer-kit.png`,
  basketball: `${ASSET_BASE}uploads/uniform-editor/approved-basketball-kit.png`,
  netball: `${ASSET_BASE}uploads/uniform-editor/approved-basketball-kit.png`,
  cricket: `${ASSET_BASE}uploads/uniform-editor/approved-cricket-kit.png`,
  goalkeeper: `${ASSET_BASE}uploads/uniform-editor/approved-goalkeeper-kit.png`,
  other: `${ASSET_BASE}uploads/uniform-editor/approved-other-kit.png`,
};

const KIT_REGIONS = {
  soccer: {
    shirtTop: 20, bottomStart: 555, socksStart: 865, kitBottom: 1358,
    sleeveBottom: 300, shortSleeveBottom: 300, bodyLeft: 190, bodyRight: 390, collarY: 66,
    nativeSleeve: "short",
    views: {
      front: {
        centerX: 333,
        collarY: 78,
        bodyLeft: 202,
        bodyRight: 466,
        sleevePolygons: {
          left: [[159, 103], [126, 135], [107, 257], [196, 257], [211, 151], [185, 112]],
          right: [[477, 103], [514, 135], [558, 257], [472, 257], [456, 151], [450, 112]],
        },
      },
      back: {
        centerX: 257,
        collarY: 62,
        bodyLeft: 127,
        bodyRight: 390,
        sleevePolygons: {
          left: [[84, 103], [50, 135], [32, 257], [119, 257], [135, 151], [109, 112]],
          right: [[402, 103], [439, 135], [481, 257], [394, 257], [379, 151], [375, 112]],
        },
      },
    },
  },
  basketball: {
    shirtTop: 155, bottomStart: 735, kitBottom: 1225,
    sleeveBottom: 390, shortSleeveBottom: 390, bodyLeft: 170, bodyRight: 410, collarY: 215,
    nativeSleeve: "sleeveless",
  },
  netball: {
    shirtTop: 155, bottomStart: 735, kitBottom: 1225,
    sleeveBottom: 390, shortSleeveBottom: 390, bodyLeft: 170, bodyRight: 410, collarY: 215,
    nativeSleeve: "sleeveless",
  },
  cricket: {
    shirtTop: 10, bottomStart: 565, kitBottom: 1320,
    sleeveBottom: 545, shortSleeveBottom: 285, bodyLeft: 190, bodyRight: 390, collarY: 72,
    nativeSleeve: "long",
  },
  goalkeeper: {
    shirtTop: 0, bottomStart: 465, socksStart: 710, kitBottom: 1085,
    sleeveBottom: 460, shortSleeveBottom: 250, bodyLeft: 190, bodyRight: 390, collarY: 48,
    nativeSleeve: "long",
  },
  other: {
    shirtTop: 225, bottomStart: 735, kitBottom: 1135,
    sleeveBottom: 535, shortSleeveBottom: 535, bodyLeft: 190, bodyRight: 390, collarY: 292,
    nativeSleeve: "short",
  },
};

function TintLayer({ mask, fill, opacity, children }) {
  return (
    <g mask={`url(#${mask})`} opacity={opacity} style={{ mixBlendMode: "color" }}>
      {children(fill)}
    </g>
  );
}

/**
 * The approved photorealistic category layouts are two-column sprites:
 * front on the left, back on the right. The transparent garment pixels are
 * reused as a live SVG mask, so customers see the approved silhouette while
 * color, artwork, front/back switching, downloads, and roster flow remain
 * interactive inside the studio.
 */
export default function ApprovedUniformGraphic({
  sport = "soccer",
  view = "front",
  collar = "Crew",
  sleeve: sleeveStyle = "Short",
  colors = {},
  highlightZone = null,
}) {
  const uid = useId().replaceAll(":", "");
  const maskId = `approved-kit-${uid}`;
  const shapeMaskId = `approved-kit-shape-${uid}`;
  const sleeveGradientId = `approved-kit-sleeve-${uid}`;
  const asset = APPROVED_ASSETS[sport] || APPROVED_ASSETS.other;
  const offset = view === "back" ? HALF_WIDTH : 0;
  const baseRegion = KIT_REGIONS[sport] || KIT_REGIONS.other;
  const region = { ...baseRegion, ...(baseRegion.views?.[view] || {}) };
  const collarCenterX = offset + (region.centerX ?? HALF_WIDTH / 2);
  const opacityFor = (zone, base = 1) => (highlightZone && highlightZone !== zone ? base * 0.22 : base);
  const body = colors.body || "#f6f1e7";
  const sleeve = colors.sleeve || body;
  const bottom = colors.shorts || body;
  const socks = colors.socks || body;
  const collarColor = colors.collar || body;
  const shirtEnd = colors.shirtStrip || colors.trim || collarColor;
  const sleeveEnd = colors.sleeveStrip || colors.trim || collarColor;
  const shortsEnd = colors.shortsStrip || colors.trim || collarColor;
  const bottomEnd = region.socksStart || region.kitBottom;
  const isSleeveless = sleeveStyle === "Sleeveless";
  const hasLeftLongSleeve = sleeveStyle === "Long" || sleeveStyle === "Mixed";
  const hasRightLongSleeve = sleeveStyle === "Long";
  const nativeLongSleeve = region.nativeSleeve === "long";
  const shortSleeveBottom = region.shortSleeveBottom || region.sleeveBottom;
  const longSleeveBottom = nativeLongSleeve
    ? region.sleeveBottom
    : Math.max(shortSleeveBottom + 90, region.bottomStart - 26);
  const baseSleeveBottom = nativeLongSleeve ? region.sleeveBottom : shortSleeveBottom;

  const longSleevePath = (side) => {
    const left = side === "left";
    const outerTop = left ? region.bodyLeft - 95 : region.bodyRight + 95;
    const innerTop = left ? region.bodyLeft + 20 : region.bodyRight - 20;
    const outerBottom = left ? region.bodyLeft - 65 : region.bodyRight + 65;
    const innerBottom = left ? region.bodyLeft - 5 : region.bodyRight + 5;
    return `M${offset + outerTop},${shortSleeveBottom - 26} L${offset + innerTop},${shortSleeveBottom - 26} L${offset + innerBottom},${longSleeveBottom} L${offset + outerBottom},${longSleeveBottom} Z`;
  };
  const baseSleevePath = (side, endOnly = false, end = baseSleeveBottom) => {
    const left = side === "left";
    const polygon = region.sleevePolygons?.[side];
    if (polygon && !endOnly) {
      return polygon
        .map(([x, y], index) => `${index === 0 ? "M" : "L"}${offset + x},${y}`)
        .join(" ") + " Z";
    }
    if (endOnly) {
      if (left) {
        return `M${offset + region.bodyLeft - 98},${end - 28} L${offset + region.bodyLeft + 9},${end - 28} L${offset + region.bodyLeft + 5},${end} L${offset + region.bodyLeft - 104},${end - 16} Z`;
      }
      return `M${offset + region.bodyRight + 98},${end - 28} L${offset + region.bodyRight - 9},${end - 28} L${offset + region.bodyRight - 5},${end} L${offset + region.bodyRight + 104},${end - 16} Z`;
    }
    if (left) {
      return `M${offset + region.bodyLeft - 110},${region.shirtTop + 102} Q${offset + region.bodyLeft - 48},${region.shirtTop + 78} ${offset + region.bodyLeft + 7},${region.shirtTop + 122} L${offset + region.bodyLeft + 5},${end} L${offset + region.bodyLeft - 110},${end - 25} Z`;
    }
    return `M${offset + region.bodyRight + 110},${region.shirtTop + 102} Q${offset + region.bodyRight + 48},${region.shirtTop + 78} ${offset + region.bodyRight - 7},${region.shirtTop + 122} L${offset + region.bodyRight - 5},${end} L${offset + region.bodyRight + 110},${end - 25} Z`;
  };
  const cutLowerSleevePath = (side) => {
    const left = side === "left";
    if (left) {
      return `M${offset},${shortSleeveBottom} H${offset + region.bodyLeft + 8} L${offset + region.bodyLeft + 5},${region.sleeveBottom} H${offset} Z`;
    }
    return `M${offset + HALF_WIDTH},${shortSleeveBottom} H${offset + region.bodyRight - 8} L${offset + region.bodyRight - 5},${region.sleeveBottom} H${offset + HALF_WIDTH} Z`;
  };
  const longCuffPath = (side) => {
    const left = side === "left";
    const outer = left ? region.bodyLeft - 65 : region.bodyRight + 65;
    const inner = left ? region.bodyLeft - 5 : region.bodyRight + 5;
    return `M${offset + outer},${longSleeveBottom} L${offset + inner},${longSleeveBottom}`;
  };

  return (
    <svg
      viewBox={`${offset} 0 ${HALF_WIDTH} ${SPRITE_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full overflow-hidden"
      role="img"
      aria-label={`${sport} complete uniform ${view}`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={SPRITE_WIDTH} height={SPRITE_HEIGHT}>
          <image href={asset} x="0" y="0" width={SPRITE_WIDTH} height={SPRITE_HEIGHT} />
        </mask>
        <mask id={shapeMaskId} maskUnits="userSpaceOnUse" x={offset} y="0" width={HALF_WIDTH} height={SPRITE_HEIGHT}>
          <rect x={offset} y="0" width={HALF_WIDTH} height={SPRITE_HEIGHT} fill="white" />
          {isSleeveless && (
            <>
              <path d={baseSleevePath("left", false, region.sleeveBottom)} fill="black" />
              <path d={baseSleevePath("right", false, region.sleeveBottom)} fill="black" />
            </>
          )}
          {!isSleeveless && nativeLongSleeve && sleeveStyle !== "Long" && (
            <>
              {sleeveStyle === "Short" && <path d={cutLowerSleevePath("left")} fill="black" />}
              <path d={cutLowerSleevePath("right")} fill="black" />
            </>
          )}
        </mask>
        <linearGradient id={sleeveGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={sleeve} stopOpacity="0.82" />
          <stop offset="0.5" stopColor={sleeve} />
          <stop offset="1" stopColor={sleeve} stopOpacity="0.72" />
        </linearGradient>
      </defs>

      {!isSleeveless && !nativeLongSleeve && (
        <g opacity={opacityFor("sleeve")} data-sleeve-extension={sleeveStyle}>
          {hasLeftLongSleeve && <path d={longSleevePath("left")} fill={`url(#${sleeveGradientId})`} />}
          {hasRightLongSleeve && <path d={longSleevePath("right")} fill={`url(#${sleeveGradientId})`} />}
        </g>
      )}

      <g mask={`url(#${shapeMaskId})`}>
        <image href={asset} x="0" y="0" width={SPRITE_WIDTH} height={SPRITE_HEIGHT} />

        {/* Start with one shirt/body color across the complete torso, then let
            the sleeve layer replace only the sleeves. There is deliberately no
            side-panel zone: every shirt pixel belongs to body or sleeve. */}
        <TintLayer mask={maskId} fill={body} opacity={opacityFor("body")}>
          {(fill) => <rect x={offset} y={region.shirtTop} width={HALF_WIDTH} height={region.bottomStart - region.shirtTop} fill={fill} />}
        </TintLayer>

        {!isSleeveless && (
          <TintLayer mask={maskId} fill={sleeve} opacity={opacityFor("sleeve")}>
            {(fill) => (
              <>
                <path d={baseSleevePath("left")} fill={fill} />
                <path d={baseSleevePath("right")} fill={fill} />
              </>
            )}
          </TintLayer>
        )}

        <TintLayer mask={maskId} fill={bottom} opacity={opacityFor("shorts")}>
        {(fill) => (
          <rect
            x={offset}
            y={region.bottomStart}
            width={HALF_WIDTH}
            height={bottomEnd - region.bottomStart}
            fill={fill}
          />
        )}
        </TintLayer>

      {region.socksStart && (
          <TintLayer mask={maskId} fill={socks} opacity={opacityFor("socks")}>
          {(fill) => (
            <rect
              x={offset}
              y={region.socksStart}
              width={HALF_WIDTH}
              height={region.kitBottom - region.socksStart}
              fill={fill}
            />
          )}
          </TintLayer>
      )}

        <TintLayer mask={maskId} fill={shirtEnd} opacity={opacityFor("shirtStrip")}>
          {(fill) => <rect x={offset} y={region.bottomStart - 18} width={HALF_WIDTH} height="18" fill={fill} />}
        </TintLayer>

        {!isSleeveless && <TintLayer mask={maskId} fill={sleeveEnd} opacity={opacityFor("sleeveStrip")}>
        {(fill) => (
          <>
              {(!hasLeftLongSleeve || nativeLongSleeve) && (
                <path d={baseSleevePath("left", true, hasLeftLongSleeve ? longSleeveBottom : shortSleeveBottom)} fill={fill} />
              )}
              {(!hasRightLongSleeve || nativeLongSleeve) && (
                <path d={baseSleevePath("right", true, hasRightLongSleeve ? longSleeveBottom : shortSleeveBottom)} fill={fill} />
              )}
          </>
        )}
        </TintLayer>}

        <TintLayer mask={maskId} fill={shortsEnd} opacity={opacityFor("shortsStrip")}>
        {(fill) => (
            <rect x={offset} y={bottomEnd - 22} width={HALF_WIDTH} height="22" fill={fill} />
        )}
        </TintLayer>
      </g>

      {/* Collar controls need to change the visible cut, not only a stored
          option. These clean vector overlays sit over the photographed collar
          and deliberately differ enough to be obvious at editor scale. */}
      <g
        opacity={opacityFor("collar")}
        data-collar-shape={collar}
        data-collar-color={collarColor}
        style={{ mixBlendMode: "normal" }}
      >
        {/* Hide the photographed source collar first. Without this patch its
            grey highlights showed through the selected swatch and made the
            live garment appear to use a different color than the control. */}
        <g mask={`url(#${maskId})`}>
          <ellipse cx={collarCenterX} cy={region.collarY + 13} rx="65" ry="49" fill={body} />
          {collar === "V-Neck" && (
            <path
              d={`M${collarCenterX - 55},${region.collarY - 16} L${collarCenterX},${region.collarY + 50} L${collarCenterX + 55},${region.collarY - 16} L${collarCenterX + 40},${region.collarY - 22} L${collarCenterX},${region.collarY + 29} L${collarCenterX - 40},${region.collarY - 22} Z`}
              fill={collarColor}
            />
          )}
          {collar === "Crew" && <ellipse cx={collarCenterX} cy={region.collarY} rx="54" ry="31" fill={collarColor} />}
          {collar === "Polo" && (
            <>
              <path d={`M${collarCenterX - 58},${region.collarY - 17} L${collarCenterX - 7},${region.collarY + 25} L${collarCenterX - 41},${region.collarY + 38} Z`} fill={collarColor} />
              <path d={`M${collarCenterX + 58},${region.collarY - 17} L${collarCenterX + 7},${region.collarY + 25} L${collarCenterX + 41},${region.collarY + 38} Z`} fill={collarColor} />
              {view === "front" && (
                <rect x={collarCenterX - 8} y={region.collarY + 15} width="16" height="63" rx="4" fill={collarColor} />
              )}
            </>
          )}
        </g>
        {collar === "V-Neck" && (
          <path d={`M${collarCenterX - 35},${region.collarY - 12} L${collarCenterX},${region.collarY + 29} L${collarCenterX + 35},${region.collarY - 12}`} fill="none" stroke="#171512" strokeOpacity="0.72" strokeWidth="5" strokeLinejoin="round" />
        )}
        {collar === "Crew" && (
          <ellipse cx={collarCenterX} cy={region.collarY - 1} rx="39" ry="18" fill="#171512" fillOpacity="0.72" />
        )}
        {collar === "Polo" && view === "front" && (
          <>
            <circle cx={collarCenterX} cy={region.collarY + 37} r="3" fill={body} />
            <circle cx={collarCenterX} cy={region.collarY + 57} r="3" fill={body} />
          </>
        )}
      </g>

      {!isSleeveless && !nativeLongSleeve && (
        <g opacity={opacityFor("sleeveStrip")}>
          {hasLeftLongSleeve && <path d={longCuffPath("left")} fill="none" stroke={sleeveEnd} strokeWidth="18" strokeLinecap="round" />}
          {hasRightLongSleeve && <path d={longCuffPath("right")} fill="none" stroke={sleeveEnd} strokeWidth="18" strokeLinecap="round" />}
        </g>
      )}
    </svg>
  );
}
