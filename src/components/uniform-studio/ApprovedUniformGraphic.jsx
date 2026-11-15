import { useId } from "react";
import ZoneCorrectionOverlay from "./ZoneCorrectionOverlay";
import { SOCCER_ZONE_MODEL } from "./uniformZoneModel";

const SPRITE_WIDTH = 1159;
const SPRITE_HEIGHT = 1358;
const HALF_WIDTH = SPRITE_WIDTH / 2;
const ASSET_BASE = import.meta.env.BASE_URL;

const APPROVED_ASSETS = {
  soccer: `${ASSET_BASE}uploads/uniform-editor/approved-soccer-kit.png`,
  basketball: `${ASSET_BASE}uploads/uniform-editor/approved-basketball-kit.png`,
  netball: `${ASSET_BASE}uploads/uniform-editor/approved-netball-kit.png`,
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
        bodyPolygon: [[275, 56], [391, 56], [455, 135], [472, 270], [481, 548], [189, 548], [195, 270], [210, 135]],
        sleevePolygons: {
          left: [[275, 40], [0, 40], [0, 300], [195, 300], [210, 135]],
          right: [[391, 40], [HALF_WIDTH, 40], [HALF_WIDTH, 300], [472, 300], [455, 135]],
        },
        sleeveEndPolygons: {
          left: [[107, 240], [198, 250], [195, 274], [105, 260]],
          right: [[469, 250], [558, 240], [560, 260], [472, 274]],
        },
        shirtEndPolygon: [[189, 545], [481, 545], [482, 555], [187, 555]],
        shortsPolygon: [[176, 555], [485, 555], [500, 840], [163, 840]],
        shortsEndPolygon: [[163, 810], [500, 810], [500, 840], [163, 840]],
      },
      back: {
        centerX: 257,
        collarY: 62,
        bodyLeft: 127,
        bodyRight: 390,
        bodyPolygon: [[196, 52], [315, 52], [379, 135], [394, 270], [402, 548], [111, 548], [119, 270], [135, 135]],
        sleevePolygons: {
          left: [[196, 36], [0, 36], [0, 300], [119, 300], [135, 135]],
          right: [[315, 36], [HALF_WIDTH, 36], [HALF_WIDTH, 300], [394, 300], [379, 135]],
        },
        sleeveEndPolygons: {
          left: [[32, 240], [122, 250], [119, 274], [30, 260]],
          right: [[391, 250], [481, 240], [483, 260], [394, 274]],
        },
        shirtEndPolygon: [[111, 545], [402, 545], [404, 555], [109, 555]],
        shortsPolygon: [[105, 555], [408, 555], [424, 840], [92, 840]],
        shortsEndPolygon: [[92, 810], [424, 810], [424, 840], [92, 840]],
      },
    },
  },
  basketball: {
    shirtTop: 155, bottomStart: 735, kitBottom: 1225,
    sleeveBottom: 390, shortSleeveBottom: 390, bodyLeft: 170, bodyRight: 410, collarY: 215,
    nativeSleeve: "sleeveless",
  },
  netball: {
    spriteWidth: 2048, spriteHeight: 1536,
    shirtTop: 20, bottomStart: 1420, kitBottom: 1536,
    sleeveBottom: 470, shortSleeveBottom: 470, bodyLeft: 320, bodyRight: 704, collarY: 190,
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
    <g
      data-garment-tint="fabric-multiply"
      mask={`url(#${mask})`}
      opacity={opacity}
      style={{ mixBlendMode: "multiply" }}
    >
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
  zones,
  zoneStyles = {},
  selectedZoneId = null,
  showZoneOutlines = false,
  correctionMode = false,
  onSelectZone,
  onMoveZonePoint,
}) {
  const uid = useId().replaceAll(":", "");
  const maskId = `approved-kit-${uid}`;
  const jerseyMaskId = `approved-jersey-${uid}`;
  const shortsMaskId = `approved-shorts-${uid}`;
  const socksMaskId = `approved-socks-${uid}`;
  const shapeMaskId = `approved-kit-shape-${uid}`;
  const sleeveGradientId = `approved-kit-sleeve-${uid}`;
  const asset = APPROVED_ASSETS[sport] || APPROVED_ASSETS.other;
  const baseRegion = KIT_REGIONS[sport] || KIT_REGIONS.other;
  const spriteWidth = baseRegion.spriteWidth || SPRITE_WIDTH;
  const spriteHeight = baseRegion.spriteHeight || SPRITE_HEIGHT;
  const halfWidth = spriteWidth / 2;
  const offset = view === "back" ? halfWidth : 0;
  const region = { ...baseRegion, ...(baseRegion.views?.[view] || {}) };
  const collarCenterX = offset + (region.centerX ?? halfWidth / 2);
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
  const nativeSleeveless = region.nativeSleeve === "sleeveless";
  const shortSleeveBottom = region.shortSleeveBottom || region.sleeveBottom;
  const longSleeveBottom = nativeLongSleeve
    ? region.sleeveBottom
    : Math.max(shortSleeveBottom + 90, region.bottomStart - 26);
  const baseSleeveBottom = nativeLongSleeve ? region.sleeveBottom : shortSleeveBottom;
  const editableZones = zones || (sport === "soccer" ? SOCCER_ZONE_MODEL[view] : []);

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
    return `M${offset + halfWidth},${shortSleeveBottom} H${offset + region.bodyRight - 8} L${offset + region.bodyRight - 5},${region.sleeveBottom} H${offset + halfWidth} Z`;
  };
  const longCuffPath = (side) => {
    const left = side === "left";
    const outer = left ? region.bodyLeft - 65 : region.bodyRight + 65;
    const inner = left ? region.bodyLeft - 5 : region.bodyRight + 5;
    return `M${offset + outer},${longSleeveBottom} L${offset + inner},${longSleeveBottom}`;
  };
  const polygonPath = (points) => points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${offset + x},${y}`)
    .join(" ") + " Z";

  return (
    <svg
      data-uniform-view={view}
      viewBox={`${offset} 0 ${halfWidth} ${spriteHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full overflow-hidden"
      role="img"
      aria-label={`${sport} complete uniform ${view}`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={spriteWidth} height={spriteHeight}>
          <image href={asset} x="0" y="0" width={spriteWidth} height={spriteHeight} />
        </mask>
        <mask id={jerseyMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={spriteWidth} height={spriteHeight}>
          <image href={asset} x="0" y="0" width={spriteWidth} height={spriteHeight} />
          <rect x="0" y={region.bottomStart} width={spriteWidth} height={spriteHeight - region.bottomStart} fill="black" />
        </mask>
        <mask id={shortsMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={spriteWidth} height={spriteHeight}>
          <image href={asset} x="0" y="0" width={spriteWidth} height={spriteHeight} />
          <rect x="0" y="0" width={spriteWidth} height={region.bottomStart} fill="black" />
          <rect x="0" y={bottomEnd} width={spriteWidth} height={spriteHeight - bottomEnd} fill="black" />
        </mask>
        <mask id={socksMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={spriteWidth} height={spriteHeight}>
          <image href={asset} x="0" y="0" width={spriteWidth} height={spriteHeight} />
          <rect x="0" y="0" width={spriteWidth} height={region.socksStart || spriteHeight} fill="black" />
        </mask>
        <mask id={shapeMaskId} maskUnits="userSpaceOnUse" x={offset} y="0" width={halfWidth} height={spriteHeight}>
          <rect x={offset} y="0" width={halfWidth} height={spriteHeight} fill="white" />
          {isSleeveless && !nativeSleeveless && (
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
        <filter id="zone-mesh" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="7" result="noise" />
          <feComposite in="noise" in2="SourceGraphic" operator="in" result="texture" />
          <feBlend in="SourceGraphic" in2="texture" mode="multiply" />
        </filter>
      </defs>

      {!isSleeveless && !nativeLongSleeve && (
        <g opacity={opacityFor("sleeve")} data-sleeve-extension={sleeveStyle}>
          {hasLeftLongSleeve && <path d={longSleevePath("left")} fill={`url(#${sleeveGradientId})`} />}
          {hasRightLongSleeve && <path d={longSleevePath("right")} fill={`url(#${sleeveGradientId})`} />}
        </g>
      )}

      <g mask={`url(#${shapeMaskId})`}>
        <image href={asset} x="0" y="0" width={spriteWidth} height={spriteHeight} />

        {/* Start with one shirt/body color across the complete torso, then let
            the sleeve layer replace only the sleeves. There is deliberately no
            side-panel zone: every shirt pixel belongs to body or sleeve. */}
        <TintLayer mask={maskId} fill={body} opacity={opacityFor("body")}>
          {(fill) => region.bodyPolygon
            ? <path d={polygonPath(region.bodyPolygon)} fill={fill} />
            : <rect x={offset} y={region.shirtTop} width={halfWidth} height={region.bottomStart - region.shirtTop} fill={fill} />}
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
          region.shortsPolygon
            ? <path d={polygonPath(region.shortsPolygon)} fill={fill} />
            : <rect
                x={offset}
                y={region.bottomStart}
                width={halfWidth}
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
              width={halfWidth}
              height={region.kitBottom - region.socksStart}
              fill={fill}
            />
          )}
          </TintLayer>
      )}

        {/* The shirt hem is clipped to the jersey-only mask. This prevents
            its color from bleeding into the shorts waistband while the wider
            traced polygon follows the complete curved bottom edge. */}
        <TintLayer mask={jerseyMaskId} fill={shirtEnd} opacity={opacityFor("shirtStrip")}>
          {(fill) => region.shirtEndPolygon
            ? <path d={polygonPath(region.shirtEndPolygon)} fill={fill} />
            : <rect x={offset} y={region.bottomStart - 18} width={halfWidth} height="18" fill={fill} />}
        </TintLayer>

        {!isSleeveless && <TintLayer mask={jerseyMaskId} fill={sleeveEnd} opacity={opacityFor("sleeveStrip")}>
        {(fill) => (
          <>
              {region.sleeveEndPolygons ? (
                <>
                  <path d={polygonPath(region.sleeveEndPolygons.left)} fill={fill} />
                  <path d={polygonPath(region.sleeveEndPolygons.right)} fill={fill} />
                </>
              ) : (
                <>
                  {(!hasLeftLongSleeve || nativeLongSleeve) && (
                    <path d={baseSleevePath("left", true, hasLeftLongSleeve ? longSleeveBottom : shortSleeveBottom)} fill={fill} />
                  )}
                  {(!hasRightLongSleeve || nativeLongSleeve) && (
                    <path d={baseSleevePath("right", true, hasRightLongSleeve ? longSleeveBottom : shortSleeveBottom)} fill={fill} />
                  )}
                </>
              )}
          </>
        )}
        </TintLayer>}

        <TintLayer mask={maskId} fill={shortsEnd} opacity={opacityFor("shortsStrip")}>
        {(fill) => (
            region.shortsEndPolygon
              ? <path d={polygonPath(region.shortsEndPolygon)} fill={fill} />
              : <rect x={offset} y={bottomEnd - 22} width={halfWidth} height="22" fill={fill} />
        )}
        </TintLayer>
      </g>

      {editableZones.length > 0 && (
        <g>
          <ZoneCorrectionOverlay
            zones={editableZones}
            offsetX={offset}
            selectedZoneId={selectedZoneId}
            showOutlines={showZoneOutlines}
            correctionMode={correctionMode}
            zoneStyles={zoneStyles}
            colorValues={{
              ...colors,
              armhole: colors.armhole || colors.sleeve || colors.body,
              waistband: colors.waistband || colors.shorts || colors.body,
              sockTrim: colors.sockTrim || colors.socks || colors.body,
            }}
            onSelectZone={onSelectZone}
            onMovePoint={onMoveZonePoint}
            maskIds={{ garment: maskId, jersey: jerseyMaskId, shorts: shortsMaskId, socks: socksMaskId }}
          />
        </g>
      )}

      {/* Collar controls need to change the visible cut, not only a stored
          option. These clean vector overlays sit over the photographed collar
          and deliberately differ enough to be obvious at editor scale. */}
      {!(sport === "netball" && collar === "Crew") && <g
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
      </g>}

      {!isSleeveless && !nativeLongSleeve && (
        <g opacity={opacityFor("sleeveStrip")}>
          {hasLeftLongSleeve && <path d={longCuffPath("left")} fill="none" stroke={sleeveEnd} strokeWidth="18" strokeLinecap="round" />}
          {hasRightLongSleeve && <path d={longCuffPath("right")} fill="none" stroke={sleeveEnd} strokeWidth="18" strokeLinecap="round" />}
        </g>
      )}
    </svg>
  );
}
