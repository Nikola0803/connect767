import { useId } from "react";
import ZoneCorrectionOverlay from "./ZoneCorrectionOverlay";
import { SOCCER_ZONE_MODEL } from "./uniformZoneModel";
import SideUniformGraphic from "./SideUniformGraphic";

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
    shirtTop: 20, shirtBodyCleanupStart: 510, shirtEndStart: 534, bottomStart: 580,
    socksStart: 865, kitBottom: 1358,
    shortsEndPaths: [
      "M155,792 C200,812 255,815 306,790 L306,850 C258,870 205,868 155,850 Z",
      "M357,790 C408,815 463,812 505,792 L505,850 C458,868 405,870 357,850 Z",
    ],
    sleeveBottom: 300, shortSleeveBottom: 300, bodyLeft: 190, bodyRight: 390, collarY: 66,
    nativeSleeve: "short",
    views: {
      front: {
        shortsEndShiftX: 0,
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
        shortsPolygon: [[176, 555], [485, 555], [500, 840], [163, 840]],
        shortsEndPolygon: [[163, 810], [500, 810], [500, 840], [163, 840]],
      },
      back: {
        shortsEndShiftX: -76,
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
        shortsPolygon: [[105, 555], [408, 555], [424, 840], [92, 840]],
        shortsEndPolygon: [[92, 810], [424, 810], [424, 840], [92, 840]],
      },
    },
  },
  basketball: {
    shirtTop: 155, bottomStart: 735, kitBottom: 1225,
    sleeveBottom: 390, shortSleeveBottom: 390, bodyLeft: 170, bodyRight: 410, collarY: 215,
    nativeSleeve: "sleeveless",
    views: {
      front: {
        centerX: 334,
        collarY: 206,
        collarPatch: { cy: 213, rx: 87, ry: 67 },
        vNeck: { outerHalf: 75, outerTop: 173, outerPoint: 266, innerHalf: 52, innerTop: 187, innerPoint: 242 },
      },
      back: {
        centerX: 257,
        collarY: 184,
        collarPatch: { cy: 193, rx: 82, ry: 61 },
        vNeck: { outerHalf: 71, outerTop: 158, outerPoint: 244, innerHalf: 49, innerTop: 173, innerPoint: 222 },
      },
    },
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

function TintLayer({ mask, fill, opacity, blendMode = "multiply", children }) {
  return (
    <g
      data-garment-tint={blendMode === "multiply" ? "fabric-multiply" : "flat-color"}
      mask={`url(#${mask})`}
      opacity={opacity}
      style={{ mixBlendMode: blendMode }}
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
  garmentPattern,
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
  if (["side", "sleeve-left", "sleeve-right"].includes(view)) {
    return (
      <SideUniformGraphic
        sport={sport}
        colors={colors}
        garmentPattern={garmentPattern}
        highlightZone={highlightZone}
        side={view === "sleeve-left" ? "left" : "right"}
        focus={view.startsWith("sleeve-") ? "sleeve" : "full"}
        viewKey={view}
      />
    );
  }
  const maskId = `approved-kit-${uid}`;
  const jerseyMaskId = `approved-jersey-${uid}`;
  const jerseyClipId = `approved-jersey-clip-${uid}`;
  const bodyClipId = `approved-body-clip-${uid}`;
  const patternFadeId = `approved-pattern-fade-${uid}`;
  const shortsMaskId = `approved-shorts-${uid}`;
  const shortsClipId = `approved-shorts-clip-${uid}`;
  const socksMaskId = `approved-socks-${uid}`;
  const socksClipId = `approved-socks-clip-${uid}`;
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
  const collarPatch = region.collarPatch || { cy: region.collarY + 13, rx: 65, ry: 49 };
  const vNeck = region.vNeck;
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
  const hasLeftLongSleeve = sleeveStyle === "Long";
  const hasRightLongSleeve = sleeveStyle === "Long";
  const nativeLongSleeve = region.nativeSleeve === "long";
  const nativeSleeveless = region.nativeSleeve === "sleeveless";
  const shortSleeveBottom = region.shortSleeveBottom || region.sleeveBottom;
  const longSleeveBottom = nativeLongSleeve
    ? region.sleeveBottom
    : Math.max(shortSleeveBottom + 90, region.bottomStart - 26);
  const baseSleeveBottom = nativeLongSleeve ? region.sleeveBottom : shortSleeveBottom;
  const editableZones = zones || (sport === "soccer" ? SOCCER_ZONE_MODEL[view] : []);
  const patternApplies = Boolean(
    garmentPattern?.enabled
    && garmentPattern.key !== "none"
    && (garmentPattern.view === "both" || !garmentPattern.view || garmentPattern.view === view),
  );

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
        {/* Match the side view's alpha mask. A luminance mask weakens the
            tint over photographed folds and makes dark sleeves look gray. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={spriteWidth} height={spriteHeight} style={{ maskType: "alpha" }}>
          <image href={asset} x="0" y="0" width={spriteWidth} height={spriteHeight} />
        </mask>
        <clipPath id={jerseyClipId} clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width={spriteWidth} height={region.bottomStart} />
        </clipPath>
        <clipPath id={bodyClipId} clipPathUnits="userSpaceOnUse">
          {region.bodyPolygon
            ? <path d={polygonPath(region.bodyPolygon)} />
            : <rect x={offset + region.bodyLeft - 18} y={region.shirtTop} width={region.bodyRight - region.bodyLeft + 36} height={region.bottomStart - region.shirtTop} />}
        </clipPath>
        <mask
          id={jerseyMaskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={spriteWidth}
          height={spriteHeight}
          style={{ maskType: "alpha" }}
        >
          <image
            href={asset}
            x="0"
            y="0"
            width={spriteWidth}
            height={spriteHeight}
            clipPath={`url(#${jerseyClipId})`}
          />
        </mask>
        <clipPath id={shortsClipId} clipPathUnits="userSpaceOnUse">
          <rect
            x="0"
            y={region.bottomStart}
            width={spriteWidth}
            height={Math.max(0, bottomEnd - region.bottomStart)}
          />
        </clipPath>
        <mask
          id={shortsMaskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={spriteWidth}
          height={spriteHeight}
          style={{ maskType: "alpha" }}
        >
          <image
            href={asset}
            x="0"
            y="0"
            width={spriteWidth}
            height={spriteHeight}
            clipPath={`url(#${shortsClipId})`}
          />
        </mask>
        <clipPath id={socksClipId} clipPathUnits="userSpaceOnUse">
          <rect
            x="0"
            y={region.socksStart || spriteHeight}
            width={spriteWidth}
            height={Math.max(0, spriteHeight - (region.socksStart || spriteHeight))}
          />
        </clipPath>
        <mask
          id={socksMaskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={spriteWidth}
          height={spriteHeight}
          style={{ maskType: "alpha" }}
        >
          <image
            href={asset}
            x="0"
            y="0"
            width={spriteWidth}
            height={spriteHeight}
            clipPath={`url(#${socksClipId})`}
          />
        </mask>
        <mask id={shapeMaskId} maskUnits="userSpaceOnUse" x={offset} y="0" width={halfWidth} height={spriteHeight} style={{ maskType: "luminance" }}>
          <rect x={offset} y="0" width={halfWidth} height={spriteHeight} fill="white" />
          {isSleeveless && !nativeSleeveless && (
            <>
              <path d={baseSleevePath("left", false, region.sleeveBottom)} fill="black" />
              <path d={baseSleevePath("right", false, region.sleeveBottom)} fill="black" />
            </>
          )}
          {!isSleeveless && nativeLongSleeve && sleeveStyle !== "Long" && (
            <>
              {sleeveStyle !== "Long" && <path d={cutLowerSleevePath("left")} fill="black" />}
              <path d={cutLowerSleevePath("right")} fill="black" />
            </>
          )}
        </mask>
        <linearGradient id={sleeveGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={sleeve} stopOpacity="0.82" />
          <stop offset="0.5" stopColor={sleeve} />
          <stop offset="1" stopColor={sleeve} stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id={patternFadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shirtEnd} stopOpacity="0.9" />
          <stop offset="1" stopColor={shirtEnd} stopOpacity="0" />
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

        {/* Composite the shirt body and sleeves into one palette before the
            multiply blend is applied to the photographed fabric. Separate
            blend groups used to create a light/dark border where their
            antialiased edges met. A small same-colour overlap removes that
            artificial border while preserving independent sleeve colours. */}
        <TintLayer mask={maskId} fill={body} opacity={1}>
          {() => (
            <>
              {region.bodyPolygon
                ? <path data-garment-zone="body" d={polygonPath(region.bodyPolygon)} fill={body} stroke={body} strokeWidth="5" strokeLinejoin="round" opacity={opacityFor("body")} />
                : <rect data-garment-zone="body" x={offset} y={region.shirtTop} width={halfWidth} height={region.bottomStart - region.shirtTop} fill={body} opacity={opacityFor("body")} />}
              {!isSleeveless && (
                <>
                  <path data-garment-zone="sleeve" data-sleeve-side="left" d={baseSleevePath("left")} fill={sleeve} stroke={sleeve} strokeWidth="5" strokeLinejoin="round" opacity={opacityFor("sleeve")} />
                  <path data-garment-zone="sleeve" data-sleeve-side="right" d={baseSleevePath("right")} fill={sleeve} stroke={sleeve} strokeWidth="5" strokeLinejoin="round" opacity={opacityFor("sleeve")} />
                </>
              )}
            </>
          )}
        </TintLayer>

        {patternApplies && (
          <g
            data-ai-garment-pattern={garmentPattern.key}
            clipPath={`url(#${bodyClipId})`}
            mask={`url(#${maskId})`}
            opacity="0.86"
          >
            {garmentPattern.key === "bands-h" && (
              <>
                <rect x={offset} y={region.shirtTop + 150} width={halfWidth} height="42" fill={shirtEnd} />
                <rect x={offset} y={region.shirtTop + 220} width={halfWidth} height="18" fill={shirtEnd} opacity="0.72" />
              </>
            )}
            {garmentPattern.key === "bands-v" && (
              <>
                <rect x={collarCenterX - 52} y={region.shirtTop} width="54" height={region.bottomStart - region.shirtTop} fill={shirtEnd} />
                <rect x={collarCenterX + 18} y={region.shirtTop} width="20" height={region.bottomStart - region.shirtTop} fill={shirtEnd} opacity="0.7" />
              </>
            )}
            {(garmentPattern.key === "diagonal" || garmentPattern.key === "sash") && (
              <path
                d={`M${offset - 40},${region.shirtTop + 360} L${offset + halfWidth + 40},${region.shirtTop + 85} L${offset + halfWidth + 40},${region.shirtTop + 185} L${offset - 40},${region.shirtTop + 460} Z`}
                fill={shirtEnd}
              />
            )}
            {garmentPattern.key === "chevron" && (
              <path d={`M${offset + 70},${region.shirtTop + 175} L${collarCenterX},${region.shirtTop + 310} L${offset + halfWidth - 70},${region.shirtTop + 175}`} fill="none" stroke={shirtEnd} strokeWidth="42" strokeLinejoin="round" />
            )}
            {garmentPattern.key === "halves" && (
              <rect x={collarCenterX} y={region.shirtTop} width={halfWidth / 2} height={region.bottomStart - region.shirtTop} fill={shirtEnd} />
            )}
            {garmentPattern.key === "quarters" && (
              <>
                <rect x={collarCenterX} y={region.shirtTop} width={halfWidth / 2} height={(region.bottomStart - region.shirtTop) / 2} fill={shirtEnd} />
                <rect x={offset} y={(region.shirtTop + region.bottomStart) / 2} width={halfWidth / 2} height={(region.bottomStart - region.shirtTop) / 2} fill={shirtEnd} />
              </>
            )}
            {garmentPattern.key === "cross" && (
              <>
                <rect x={collarCenterX - 28} y={region.shirtTop} width="56" height={region.bottomStart - region.shirtTop} fill={shirtEnd} />
                <rect x={offset} y={region.shirtTop + 205} width={halfWidth} height="56" fill={shirtEnd} />
              </>
            )}
            {garmentPattern.key === "tricolour" && (
              <>
                <rect x={offset} y={region.shirtTop + 165} width={halfWidth} height="34" fill={shirtEnd} />
                <rect x={offset} y={region.shirtTop + 199} width={halfWidth} height="34" fill="#FFFFFF" opacity="0.82" />
                <rect x={offset} y={region.shirtTop + 233} width={halfWidth} height="34" fill={collarColor} />
              </>
            )}
            {garmentPattern.key === "fade" && (
              <rect x={offset} y={region.shirtTop} width={halfWidth} height={region.bottomStart - region.shirtTop} fill={`url(#${patternFadeId})`} />
            )}
            {(garmentPattern.key === "camo" || garmentPattern.key === "splash") && (
              <>
                <circle cx={collarCenterX - 85} cy={region.shirtTop + 160} r="74" fill={shirtEnd} />
                <circle cx={collarCenterX + 78} cy={region.shirtTop + 270} r="96" fill={shirtEnd} opacity="0.72" />
                <circle cx={collarCenterX - 55} cy={region.shirtTop + 390} r="58" fill={shirtEnd} opacity="0.58" />
              </>
            )}
            {(garmentPattern.key === "shield" || garmentPattern.key === "star") && (
              <path d={`M${collarCenterX},${region.shirtTop + 95} L${collarCenterX + 105},${region.shirtTop + 155} L${collarCenterX + 72},${region.shirtTop + 345} L${collarCenterX},${region.shirtTop + 410} L${collarCenterX - 72},${region.shirtTop + 345} L${collarCenterX - 105},${region.shirtTop + 155} Z`} fill={shirtEnd} />
            )}
          </g>
        )}

        <TintLayer mask={shortsMaskId} fill={bottom} opacity={opacityFor("shorts")}>
        {(fill) => (
          <rect
            x={offset}
            y={region.bottomStart}
            width={halfWidth}
            height={bottomEnd - region.bottomStart}
            fill={fill}
          />
        )}
        </TintLayer>

      {region.socksStart && (
          <TintLayer mask={socksMaskId} fill={socks} opacity={opacityFor("socks")}>
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

        {/* The source photo has a dark upper seam immediately before the hem.
            Repaint that narrow area as shirt body so it cannot appear as a
            separate green/black garment zone above the selected shirt edge. */}
        {region.shirtBodyCleanupStart != null && <TintLayer
          mask={jerseyMaskId}
          fill={body}
          opacity={opacityFor("body")}
          blendMode="normal"
        >
          {(fill) => <rect
            data-shirt-body-cleanup="complete"
            x={offset}
            y={region.shirtBodyCleanupStart}
            width={halfWidth}
            height={(region.shirtEndStart ?? region.bottomStart - 18) - region.shirtBodyCleanupStart}
            fill={fill}
          />}
        </TintLayer>}

        {/* Cover the complete photographed waist construction with one edge.
            The full-width rectangle is clipped by the jersey alpha mask, so
            it reaches both outer contours without leaving white end pixels. */}
        <TintLayer
          mask={jerseyMaskId}
          fill={shirtEnd}
          opacity={opacityFor("shirtStrip")}
          blendMode="normal"
        >
          {(fill) => <rect
            data-shirt-edge="complete"
            x={offset}
            y={region.shirtEndStart ?? region.bottomStart - 18}
            width={halfWidth}
            height={region.bottomStart - (region.shirtEndStart ?? region.bottomStart - 18)}
            fill={fill}
          />}
        </TintLayer>

        {/* Sleeve cuffs must replace the photographed source color. The soccer
            source has black cuff pixels, so multiply blending can never show a
            selected bright color there (orange × black remains black). */}
        {!isSleeveless && <TintLayer mask={jerseyMaskId} fill={sleeveEnd} opacity={opacityFor("sleeveStrip")} blendMode="normal">
        {(fill) => (
          <>
              {region.sleeveEndPolygons ? (
                <>
                  <path data-garment-zone="sleeveStrip" d={polygonPath(region.sleeveEndPolygons.left)} fill={fill} />
                  <path data-garment-zone="sleeveStrip" d={polygonPath(region.sleeveEndPolygons.right)} fill={fill} />
                </>
              ) : (
                <>
                  {(!hasLeftLongSleeve || nativeLongSleeve) && (
                    <path data-garment-zone="sleeveStrip" d={baseSleevePath("left", true, hasLeftLongSleeve ? longSleeveBottom : shortSleeveBottom)} fill={fill} />
                  )}
                  {(!hasRightLongSleeve || nativeLongSleeve) && (
                    <path data-garment-zone="sleeveStrip" d={baseSleevePath("right", true, hasRightLongSleeve ? longSleeveBottom : shortSleeveBottom)} fill={fill} />
                  )}
                </>
              )}
          </>
        )}
        </TintLayer>}

        {/* Apply the shorts end exactly once. A flat alpha-clipped band covers
            the photographed dark underside and reaches both outer leg edges
            without stacking a second editable-zone color over it. */}
        <TintLayer
          mask={shortsMaskId}
          fill={shortsEnd}
          opacity={opacityFor("shortsStrip")}
          blendMode="normal"
        >
        {(fill) => region.shortsEndPaths ? (
          <g
            data-shorts-edge="complete"
            data-shorts-edge-width="18"
            transform={`translate(${offset + (region.shortsEndShiftX || 0)} 0)`}
          >
            {region.shortsEndPaths.map((path) => <path key={path} d={path} fill={fill} />)}
          </g>
        ) : (
          <rect
            data-shorts-edge="complete"
            x={offset}
            y={bottomEnd - 22}
            width={halfWidth}
            height="22"
            fill={fill}
          />
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
              sockTrim: colors.socks || colors.body,
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
          <ellipse
            data-collar-patch="source-cleanup"
            cx={collarCenterX}
            cy={collarPatch.cy}
            rx={collarPatch.rx}
            ry={collarPatch.ry}
            fill={body}
          />
          {collar === "V-Neck" && (
            <path
              data-collar-part="v-neck-band"
              d={vNeck
                ? `M${collarCenterX - vNeck.outerHalf},${vNeck.outerTop} L${collarCenterX},${vNeck.outerPoint} L${collarCenterX + vNeck.outerHalf},${vNeck.outerTop} L${collarCenterX + vNeck.innerHalf},${vNeck.innerTop} L${collarCenterX},${vNeck.innerPoint} L${collarCenterX - vNeck.innerHalf},${vNeck.innerTop} Z`
                : `M${collarCenterX - 55},${region.collarY - 16} L${collarCenterX},${region.collarY + 50} L${collarCenterX + 55},${region.collarY - 16} L${collarCenterX + 40},${region.collarY - 22} L${collarCenterX},${region.collarY + 29} L${collarCenterX - 40},${region.collarY - 22} Z`}
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
          <path
            data-collar-part="v-neck-opening"
            d={vNeck
              ? `M${collarCenterX - vNeck.innerHalf},${vNeck.innerTop} L${collarCenterX},${vNeck.innerPoint} L${collarCenterX + vNeck.innerHalf},${vNeck.innerTop}`
              : `M${collarCenterX - 35},${region.collarY - 12} L${collarCenterX},${region.collarY + 29} L${collarCenterX + 35},${region.collarY - 12}`}
            fill="none"
            stroke="#171512"
            strokeOpacity="0.72"
            strokeWidth="5"
            strokeLinejoin="round"
          />
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
