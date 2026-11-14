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
  soccer: { bottomStart: 555, socksStart: 865 },
  basketball: { bottomStart: 735 },
  baseball: { bottomStart: 520 },
  cricket: { bottomStart: 565 },
  goalkeeper: { bottomStart: 465, socksStart: 710 },
  other: { bottomStart: 735 },
};

function TintLayer({ mask, fill, opacity, children }) {
  return (
    <g mask={`url(#${mask})`} opacity={opacity} style={{ mixBlendMode: "multiply" }}>
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
  const opacityFor = (zone, base) => (highlightZone && highlightZone !== zone ? base * 0.28 : base);
  const body = colors.body || "#f6f1e7";
  const sleeve = colors.sleeve || body;
  const panel = colors.panel || body;
  const bottom = colors.shorts || panel;
  const socks = colors.socks || colors.trim || body;

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

      <TintLayer mask={maskId} fill={body} opacity={opacityFor("body", 0.72)}>
        {(fill) => <rect x={offset} y="0" width={HALF_WIDTH} height={SPRITE_HEIGHT} fill={fill} />}
      </TintLayer>

      <TintLayer mask={maskId} fill={sleeve} opacity={opacityFor("sleeve", 0.78)}>
        {(fill) => (
          <>
            <path d={`M${offset + 18},40 H${offset + 212} L${offset + 188},500 H${offset + 5} Z`} fill={fill} />
            <path d={`M${offset + 562},40 H${offset + 368} L${offset + 392},500 H${offset + 574} Z`} fill={fill} />
          </>
        )}
      </TintLayer>

      <TintLayer mask={maskId} fill={panel} opacity={opacityFor("panel", 0.58)}>
        {(fill) => (
          <>
            <path d={`M${offset + 58},170 H${offset + 170} L${offset + 192},${region.bottomStart} H${offset + 72} Z`} fill={fill} />
            <path d={`M${offset + 522},170 H${offset + 410} L${offset + 388},${region.bottomStart} H${offset + 508} Z`} fill={fill} />
          </>
        )}
      </TintLayer>

      <TintLayer mask={maskId} fill={bottom} opacity={opacityFor("shorts", 0.76)}>
        {(fill) => (
          <rect
            x={offset}
            y={region.bottomStart}
            width={HALF_WIDTH}
            height={(region.socksStart || SPRITE_HEIGHT) - region.bottomStart}
            fill={fill}
          />
        )}
      </TintLayer>

      {region.socksStart && (
        <TintLayer mask={maskId} fill={socks} opacity={opacityFor("socks", 0.78)}>
          {(fill) => (
            <rect
              x={offset}
              y={region.socksStart}
              width={HALF_WIDTH}
              height={SPRITE_HEIGHT - region.socksStart}
              fill={fill}
            />
          )}
        </TintLayer>
      )}
    </svg>
  );
}
