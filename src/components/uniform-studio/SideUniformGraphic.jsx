import { useId } from "react";

const ASSET_BASE = import.meta.env.BASE_URL;
const WIDTH = 1024;
const HEIGHT = 1536;

export const SIDE_ASSET_BY_SPORT = {
  soccer: `${ASSET_BASE}uploads/uniform-editor/approved-soccer-side.png`,
  basketball: `${ASSET_BASE}uploads/uniform-editor/approved-basketball-side.png`,
  netball: `${ASSET_BASE}uploads/uniform-editor/approved-netball-side.png`,
  baseball: `${ASSET_BASE}uploads/uniform-editor/approved-baseball-side.png`,
  cricket: `${ASSET_BASE}uploads/uniform-editor/approved-cricket-side.png`,
  goalkeeper: `${ASSET_BASE}uploads/uniform-editor/approved-goalkeeper-side.png`,
  other: `${ASSET_BASE}uploads/uniform-editor/approved-other-side.png`,
};

// The generated assets share a fixed 1024 x 1536 production canvas. These
// cut lines isolate the same garment groups used by the front/back editor so
// colour changes remain visible from the new side orientation.
const SIDE_REGIONS = {
  soccer: { bottomStart: 708, socksStart: 1114, shirtHem: 695, bottomHem: 1081, sleeve: "M244 86 C330 46 515 52 607 136 L604 466 C516 470 427 458 334 429 Z" },
  basketball: { bottomStart: 754, socksStart: HEIGHT, shirtHem: 742, bottomHem: 1262 },
  // Netball is a one-piece court dress. Only the concealed fitted shorts at
  // the bottom use the shorts colour; the full dress remains the body colour.
  netball: { bottomStart: 1422, socksStart: HEIGHT, shirtHem: 1406, bottomHem: 1500 },
  baseball: { bottomStart: 606, socksStart: HEIGHT, shirtHem: 594, bottomHem: 1458, sleeve: "M229 78 C319 42 517 46 610 143 L603 451 C510 454 413 445 323 412 Z" },
  cricket: { bottomStart: 706, socksStart: HEIGHT, shirtHem: 694, bottomHem: 1454, sleeve: "M245 70 C350 33 534 45 621 142 L610 738 C520 744 428 733 339 694 Z" },
  goalkeeper: { bottomStart: 716, socksStart: 1120, shirtHem: 704, bottomHem: 1090, sleeve: "M230 57 C330 25 525 40 620 145 L612 733 C517 739 421 725 326 684 Z" },
  other: { bottomStart: 808, socksStart: HEIGHT, shirtHem: 796, bottomHem: 1320, sleeve: "M246 93 C338 52 531 59 620 157 L610 486 C517 490 424 478 333 444 Z" },
};

function Tint({ maskId, fill, opacity = 0.92, children }) {
  return (
    <g mask={`url(#${maskId})`} opacity={opacity} style={{ mixBlendMode: "multiply" }}>
      {children(fill)}
    </g>
  );
}

/**
 * Photorealistic right-side proof used as the third 2D workspace surface.
 * It deliberately shares the normal data-uniform-view contract so artwork,
 * downloads and click-to-place work without a separate editor implementation.
 */
export default function SideUniformGraphic({
  sport = "soccer",
  colors = {},
  garmentPattern,
  highlightZone = null,
}) {
  const uid = useId().replaceAll(":", "");
  const maskId = `approved-side-${uid}`;
  const asset = SIDE_ASSET_BY_SPORT[sport] || SIDE_ASSET_BY_SPORT.other;
  const region = SIDE_REGIONS[sport] || SIDE_REGIONS.other;
  const body = colors.body || "#f6f1e7";
  const sleeve = colors.sleeve || body;
  const bottom = colors.shorts || body;
  const socks = colors.socks || body;
  const shirtEnd = colors.shirtStrip || colors.trim || body;
  const shortsEnd = colors.shortsStrip || colors.trim || bottom;
  const opacityFor = (zone, base = 1) => (highlightZone && highlightZone !== zone ? base * 0.24 : base);
  const patternApplies = Boolean(
    garmentPattern?.enabled
      && garmentPattern.key !== "none"
      && (!garmentPattern.view || garmentPattern.view === "both" || garmentPattern.view === "side"),
  );

  return (
    <svg
      data-uniform-view="side"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full overflow-hidden"
      role="img"
      aria-label={`${sport} complete uniform side`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT} style={{ maskType: "alpha" }}>
          <image href={asset} x="0" y="0" width={WIDTH} height={HEIGHT} />
        </mask>
      </defs>

      <image href={asset} x="0" y="0" width={WIDTH} height={HEIGHT} />

      <Tint maskId={maskId} fill={body} opacity={opacityFor("body", 0.94)}>
        {(fill) => <rect x="0" y="0" width={WIDTH} height={region.bottomStart} fill={fill} />}
      </Tint>
      <Tint maskId={maskId} fill={bottom} opacity={opacityFor("shorts", 0.94)}>
        {(fill) => <rect x="0" y={region.bottomStart} width={WIDTH} height={region.socksStart - region.bottomStart} fill={fill} />}
      </Tint>
      {region.socksStart < HEIGHT && (
        <Tint maskId={maskId} fill={socks} opacity={opacityFor("socks", 0.94)}>
          {(fill) => <rect x="0" y={region.socksStart} width={WIDTH} height={HEIGHT - region.socksStart} fill={fill} />}
        </Tint>
      )}
      {region.sleeve && (
        <Tint maskId={maskId} fill={sleeve} opacity={opacityFor("sleeve", 0.96)}>
          {(fill) => <path d={region.sleeve} fill={fill} />}
        </Tint>
      )}

      {patternApplies && (
        <g mask={`url(#${maskId})`} opacity="0.76" data-ai-garment-pattern={garmentPattern.key}>
          {garmentPattern.key === "bands-h" && <rect x="0" y="360" width={WIDTH} height="54" fill={shirtEnd} />}
          {garmentPattern.key === "bands-v" && <rect x="500" y="0" width="58" height={region.bottomStart} fill={shirtEnd} />}
          {garmentPattern.key === "gradient" && <rect x="0" y="0" width={WIDTH} height={region.bottomStart} fill={shirtEnd} opacity="0.32" />}
        </g>
      )}

      <g mask={`url(#${maskId})`} style={{ mixBlendMode: "normal" }}>
        <rect x="0" y={region.shirtHem} width={WIDTH} height="16" fill={shirtEnd} opacity={opacityFor("shirtStrip", 0.9)} />
        <rect x="0" y={region.bottomHem} width={WIDTH} height="16" fill={shortsEnd} opacity={opacityFor("shortsStrip", 0.9)} />
      </g>
    </svg>
  );
}
