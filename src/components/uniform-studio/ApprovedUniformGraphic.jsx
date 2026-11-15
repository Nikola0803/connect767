import { useId } from "react";

const SPRITE_WIDTH = 1159;
const SPRITE_HEIGHT = 1358;
const HALF_WIDTH = SPRITE_WIDTH / 2;

const APPROVED_ASSETS = {
  soccer: "/uploads/uniform-editor/approved-soccer-kit.png",
  basketball: "/uploads/uniform-editor/approved-basketball-kit.png",
  baseball: "/uploads/uniform-editor/approved-baseball-kit.png",
  cricket: "/uploads/uniform-editor/approved-cricket-kit.png",
  goalkeeper: "/uploads/uniform-editor/approved-goalkeeper-kit.png",
  other: "/uploads/uniform-editor/approved-other-kit.png",
};

const KIT_REGIONS = {
  soccer: {
    shirtTop: 20, bottomStart: 555, socksStart: 865, kitBottom: 1358,
    sleeveBottom: 300, bodyLeft: 125, bodyRight: 455, collarY: 66,
  },
  basketball: {
    shirtTop: 155, bottomStart: 735, kitBottom: 1225,
    sleeveBottom: 390, bodyLeft: 150, bodyRight: 430, collarY: 215,
  },
  baseball: {
    shirtTop: 145, bottomStart: 520, kitBottom: 1225,
    sleeveBottom: 405, bodyLeft: 145, bodyRight: 435, collarY: 205,
  },
  cricket: {
    shirtTop: 10, bottomStart: 565, kitBottom: 1320,
    sleeveBottom: 545, bodyLeft: 135, bodyRight: 445, collarY: 72,
  },
  goalkeeper: {
    shirtTop: 0, bottomStart: 465, socksStart: 710, kitBottom: 1085,
    sleeveBottom: 460, bodyLeft: 130, bodyRight: 450, collarY: 48,
  },
  other: {
    shirtTop: 225, bottomStart: 735, kitBottom: 1135,
    sleeveBottom: 535, bodyLeft: 145, bodyRight: 435, collarY: 292,
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
  colors = {},
  highlightZone = null,
}) {
  const uid = useId().replaceAll(":", "");
  const maskId = `approved-kit-${uid}`;
  const asset = APPROVED_ASSETS[sport] || APPROVED_ASSETS.other;
  const region = KIT_REGIONS[sport] || KIT_REGIONS.other;
  const offset = view === "back" ? HALF_WIDTH : 0;
  const opacityFor = (zone, base = 1) => (highlightZone && highlightZone !== zone ? base * 0.22 : base);
  const body = colors.body || "#f6f1e7";
  const sleeve = colors.sleeve || body;
  const panel = colors.panel || body;
  const bottom = colors.shorts || panel;
  const socks = colors.socks || colors.trim || body;
  const collar = colors.collar || colors.trim || body;
  const trim = colors.trim || collar;
  const sleeveStrip = colors.sleeveStrip || trim;
  const shortsStrip = colors.shortsStrip || trim;
  const sleeveWidth = Math.max(105, region.bodyLeft + 38);
  const rightSleeveX = HALF_WIDTH - sleeveWidth;
  const bottomEnd = region.socksStart || region.kitBottom;

  return (
    <svg
      viewBox={`${offset} 0 ${HALF_WIDTH} ${SPRITE_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full overflow-visible"
      role="img"
      aria-label={`${sport} complete uniform ${view}`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={SPRITE_WIDTH} height={SPRITE_HEIGHT}>
          <image href={asset} x="0" y="0" width={SPRITE_WIDTH} height={SPRITE_HEIGHT} />
        </mask>
      </defs>

      <image href={asset} x="0" y="0" width={SPRITE_WIDTH} height={SPRITE_HEIGHT} />

      {/* Each control owns a distinct garment region. The old implementation
          tinted the complete sprite with the body color first, then multiplied
          every later color over it. Red shorts on a green body therefore became
          brown and sleeve controls appeared to recolor the torso. Color blend
          layers preserve the photographed folds while the later, precise zone
          masks replace hue instead of mixing two garment selections together. */}
      <TintLayer mask={maskId} fill={body} opacity={opacityFor("body")}>
        {(fill) => (
          <rect
            x={offset + region.bodyLeft}
            y={region.shirtTop}
            width={region.bodyRight - region.bodyLeft}
            height={region.bottomStart - region.shirtTop}
            fill={fill}
          />
        )}
      </TintLayer>

      <TintLayer mask={maskId} fill={sleeve} opacity={opacityFor("sleeve")}>
        {(fill) => (
          <>
            <rect x={offset} y={region.shirtTop} width={sleeveWidth} height={region.sleeveBottom - region.shirtTop} fill={fill} />
            <rect x={offset + rightSleeveX} y={region.shirtTop} width={sleeveWidth} height={region.sleeveBottom - region.shirtTop} fill={fill} />
          </>
        )}
      </TintLayer>

      <TintLayer mask={maskId} fill={panel} opacity={opacityFor("panel")}>
        {(fill) => (
          <>
            <path d={`M${offset + region.bodyLeft},${region.shirtTop + 100} H${offset + region.bodyLeft + 54} L${offset + region.bodyLeft + 68},${region.bottomStart} H${offset + region.bodyLeft} Z`} fill={fill} />
            <path d={`M${offset + region.bodyRight},${region.shirtTop + 100} H${offset + region.bodyRight - 54} L${offset + region.bodyRight - 68},${region.bottomStart} H${offset + region.bodyRight} Z`} fill={fill} />
          </>
        )}
      </TintLayer>

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

      <TintLayer mask={maskId} fill={collar} opacity={opacityFor("collar")}>
        {(fill) => <ellipse cx={offset + HALF_WIDTH / 2} cy={region.collarY} rx="64" ry="38" fill={fill} />}
      </TintLayer>

      <TintLayer mask={maskId} fill={trim} opacity={opacityFor("trim")}>
        {(fill) => (
          <>
            <rect x={offset} y={region.sleeveBottom - 24} width={sleeveWidth} height="24" fill={fill} />
            <rect x={offset + rightSleeveX} y={region.sleeveBottom - 24} width={sleeveWidth} height="24" fill={fill} />
            <rect x={offset + region.bodyLeft} y={region.bottomStart - 18} width={region.bodyRight - region.bodyLeft} height="18" fill={fill} />
          </>
        )}
      </TintLayer>

      <TintLayer mask={maskId} fill={sleeveStrip} opacity={opacityFor("sleeveStrip")}>
        {(fill) => (
          <>
            <rect x={offset} y={region.sleeveBottom - 48} width={sleeveWidth} height="14" fill={fill} />
            <rect x={offset + rightSleeveX} y={region.sleeveBottom - 48} width={sleeveWidth} height="14" fill={fill} />
          </>
        )}
      </TintLayer>

      <TintLayer mask={maskId} fill={shortsStrip} opacity={opacityFor("shortsStrip")}>
        {(fill) => (
          <>
            <rect x={offset} y={bottomEnd - 22} width={HALF_WIDTH} height="22" fill={fill} />
            <rect x={offset + region.bodyLeft - 14} y={region.bottomStart} width="16" height={bottomEnd - region.bottomStart} fill={fill} />
            <rect x={offset + region.bodyRight - 2} y={region.bottomStart} width="16" height={bottomEnd - region.bottomStart} fill={fill} />
          </>
        )}
      </TintLayer>
    </svg>
  );
}
