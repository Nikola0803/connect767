import { useId } from "react";

const ASSET_BASE = import.meta.env.BASE_URL;

export const SIDE_ASSET_BY_SPORT = {
  soccer: `${ASSET_BASE}uploads/uniform-editor/approved-soccer-side.png`,
  basketball: `${ASSET_BASE}uploads/uniform-editor/approved-basketball-side.png`,
  netball: `${ASSET_BASE}uploads/uniform-editor/approved-netball-side.png`,
  baseball: `${ASSET_BASE}uploads/uniform-editor/approved-baseball-side.png`,
  cricket: `${ASSET_BASE}uploads/uniform-editor/approved-cricket-side.png`,
  goalkeeper: `${ASSET_BASE}uploads/uniform-editor/approved-goalkeeper-side.png`,
  other: `${ASSET_BASE}uploads/uniform-editor/approved-other-side.png`,
};

// Coordinates are native image pixels. The source images have different
// dimensions; fitting them into a guessed canvas misaligns every color zone.
export const SIDE_REGIONS = {
  soccer: {
    width: 887, height: 1774, bottomStart: 754, socksStart: 1125, shirtHem: 730, bottomHem: 1080,
    sleeve: "M369 38 C297 68 252 149 253 240 L281 363 C325 391 380 390 430 368 C441 284 441 212 423 158 C414 105 389 63 369 38 Z",
    sleeveEnd: "M302 337 C338 329 395 332 434 346 L430 369 C391 389 337 381 303 363 Z",
    longSleeve: "M369 38 C297 68 252 149 253 240 L281 363 C290 455 305 545 326 626 C348 641 381 642 406 628 C420 540 428 455 430 368 C441 284 441 212 423 158 C414 105 389 63 369 38 Z",
    longSleeveEnd: "M326 626 C348 641 381 642 406 628 L405 654 C380 668 350 667 328 652 Z",
    collar: "M370 17 C424 27 481 70 515 115 L500 136 C461 92 407 58 353 46 Z",
  },
  basketball: { width: 1159, height: 1358, bottomStart: 766, shirtHem: 742, bottomHem: 1232 },
  // Netball is a one-piece court dress. Only the concealed fitted shorts at
  // the bottom use the shorts colour; the full dress remains the body colour.
  netball: { width: 1024, height: 1536, bottomStart: 1446, shirtHem: 1406, bottomHem: 1500 },
  baseball: {
    width: 819, height: 1920, bottomStart: 704, shirtHem: 680, bottomHem: 1798,
    sleeve: "M333 122 C263 155 225 232 232 322 L275 442 C315 473 392 480 438 445 C450 356 456 274 429 208 C411 168 368 133 333 122 Z",
    sleeveEnd: "M275 414 C323 391 396 398 439 426 L438 449 C391 478 319 474 277 448 Z",
    collar: "M334 80 C403 90 479 140 516 196 L491 211 C449 155 386 122 319 116 Z",
  },
  cricket: {
    width: 887, height: 1774, bottomStart: 754, shirtHem: 724, bottomHem: 1737,
    nativeSleeve: "long",
    sleeve: "M367 73 C312 110 281 177 294 269 L327 467 C353 580 388 665 438 722 L509 712 C488 635 471 551 466 460 L467 264 C473 174 433 105 367 73 Z",
    sleeveEnd: "M429 697 L500 676 L514 722 L447 744 Z",
    collar: "M368 27 C423 34 495 82 534 120 L509 142 C467 103 411 76 360 68 Z",
  },
  goalkeeper: {
    width: 819, height: 1920, bottomStart: 803, socksStart: 1190, shirtHem: 777, bottomHem: 1148,
    nativeSleeve: "long",
    sleeve: "M312 52 C244 88 221 166 229 278 L257 470 C291 605 350 718 418 790 L495 771 C472 676 444 590 434 481 L444 263 C453 160 398 83 312 52 Z",
    sleeveEnd: "M406 756 L478 733 L501 782 L431 805 Z",
    collar: "M307 17 C375 25 451 75 493 135 L475 151 C430 99 365 61 300 50 Z",
  },
  other: {
    width: 1159, height: 1358, bottomStart: 857, shirtHem: 831, bottomHem: 1232,
    sleeve: "M475 122 C416 162 392 226 402 308 L440 445 C475 477 555 480 600 451 C613 375 618 292 596 226 C572 174 525 139 475 122 Z",
    sleeveEnd: "M447 423 C489 409 559 412 601 432 L596 457 C552 480 490 476 450 453 Z",
    collar: "M479 71 C548 77 628 130 671 187 L645 211 C600 162 534 131 468 118 Z",
  },
};

function Tint({ maskId, children }) {
  return (
    <g data-garment-tint="fabric-multiply" mask={`url(#${maskId})`} style={{ mixBlendMode: "multiply" }}>
      {children}
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
  collar: collarStyle = "Crew",
  sleeve: sleeveStyle = "Short",
  side = "right",
  focus = "full",
  viewKey = "side",
}) {
  const uid = useId().replaceAll(":", "");
  const maskId = `approved-side-${uid}`;
  const collarFabricId = `approved-side-collar-${uid}`;
  const shirtEdgeId = `approved-side-shirt-edge-${uid}`;
  const sleeveEdgeId = `approved-side-sleeve-edge-${uid}`;
  const shortsEdgeId = `approved-side-shorts-edge-${uid}`;
  const sockEdgeId = `approved-side-sock-edge-${uid}`;
  const asset = SIDE_ASSET_BY_SPORT[sport] || SIDE_ASSET_BY_SPORT.other;
  const region = SIDE_REGIONS[sport] || SIDE_REGIONS.other;
  const { width, height } = region;
  const socksStart = region.socksStart || height;
  const body = colors.body || "#f6f1e7";
  const sleeve = colors.sleeve || body;
  const bottom = colors.shorts || body;
  const socks = colors.socks || body;
  const collarColor = colors.collar || body;
  const sleeveEnd = colors.sleeveStrip || colors.trim || collarColor;
  const shirtEnd = colors.shirtStrip || colors.trim || body;
  const shortsEnd = colors.shortsStrip || colors.trim || bottom;
  const opacityFor = (zone, base = 1) => (highlightZone && highlightZone !== zone ? base * 0.24 : base);
  const patternApplies = Boolean(
    garmentPattern?.enabled
      && garmentPattern.key !== "none"
      && (!garmentPattern.view || ["side", "both", "all"].includes(garmentPattern.view)),
  );
  const sleeveCropHeight = Math.min(height, Math.max(region.bottomStart + 90, height * 0.44));
  const showLongSleeve = sleeveStyle === "Long" && region.nativeSleeve !== "long" && region.longSleeve;
  // Soccer front/back use a 30px edge on a 1358px source. Preserve that
  // finished-band proportion on the taller side photograph.
  const shirtEdgeDepth = sport === "soccer"
    ? Math.round(height * (30 / 1358))
    : Math.max(18, region.bottomStart - region.shirtHem);
  const shirtHem = region.bottomStart - shirtEdgeDepth;
  // Keep trims visually identical after each native source is fitted into the
  // same workspace card. Front/back use 18px shorts and 20px sleeve bands on
  // a 1358px source; scale those canonical measurements for this photograph.
  const shortsEdgeDepth = Math.round(height * (18 / 1358));
  const sleeveEdgeDepth = Math.round(height * (20 / 1358));

  return (
    <svg
      data-uniform-view={viewKey}
      data-sleeve-side={focus === "sleeve" ? side : undefined}
      viewBox={focus === "sleeve" ? `0 0 ${width} ${sleeveCropHeight}` : `0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      colorInterpolation="sRGB"
      className="h-full w-full overflow-hidden"
      style={{ transform: side === "left" ? "scaleX(-1)" : undefined, imageRendering: "auto" }}
      role="img"
      aria-label={focus === "sleeve" ? `${sport} ${side} sleeve` : `${sport} complete uniform side`}
    >
      <defs>
        <linearGradient id={collarFabricId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={collarColor} />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.64" stopColor={collarColor} />
          <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>
        {[[shirtEdgeId, shirtEnd], [sleeveEdgeId, sleeveEnd], [shortsEdgeId, shortsEnd], [sockEdgeId, socks]].map(([id, color]) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
            <stop offset="0.2" stopColor={color} />
            <stop offset="0.72" stopColor={color} />
            <stop offset="1" stopColor="#000000" stopOpacity="0.24" />
          </linearGradient>
        ))}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height} style={{ maskType: "alpha" }}>
          <image href={asset} x="0" y="0" width={width} height={height} />
        </mask>
      </defs>

      <image href={asset} x="0" y="0" width={width} height={height} />

      {/* Composite the zone fills first, then multiply the resulting palette
          onto the photograph once. Separate multiply groups mix sleeve and
          body colors together instead of replacing the sleeve color. */}
      <Tint maskId={maskId}>
        <rect data-garment-zone="body" x="0" y="0" width={width} height={region.bottomStart} fill={body} opacity={opacityFor("body")} />
        <rect data-garment-zone="shorts" x="0" y={region.bottomStart} width={width} height={socksStart - region.bottomStart} fill={bottom} opacity={opacityFor("shorts")} />
        {socksStart < height && <rect data-garment-zone="socks" x="0" y={socksStart} width={width} height={height - socksStart} fill={socks} opacity={opacityFor("socks")} />}
        <rect data-garment-zone="shirtStrip" data-edge-color={shirtEnd} data-shirt-edge-width="30" data-edge-depth={shirtEdgeDepth} x="0" y={shirtHem} width={width} height={shirtEdgeDepth} rx={Math.max(3, Math.round(shirtEdgeDepth * 0.13))} fill={`url(#${shirtEdgeId})`} opacity={opacityFor("shirtStrip")} />
        <rect data-garment-zone="shortsStrip" data-edge-color={shortsEnd} data-shorts-edge-width="18" data-edge-depth={shortsEdgeDepth} x="0" y={region.bottomHem} width={width} height={shortsEdgeDepth} rx={Math.max(2, Math.round(shortsEdgeDepth * 0.16))} fill={`url(#${shortsEdgeId})`} opacity={opacityFor("shortsStrip")} />
        {region.sleeve && <path data-garment-zone="sleeve" d={region.sleeve} fill={sleeve} stroke={sleeve} strokeWidth="6" strokeLinejoin="round" opacity={opacityFor("sleeve")} />}
        {region.sleeveEnd && !showLongSleeve && <path data-garment-zone="sleeveStrip" data-edge-color={sleeveEnd} data-sleeve-edge-width="20" data-edge-depth={sleeveEdgeDepth} d={region.sleeveEnd} fill={`url(#${sleeveEdgeId})`} stroke={sleeveEnd} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" paintOrder="stroke fill" opacity={opacityFor("sleeveStrip")} />}
      </Tint>

      {region.collar && <g data-collar-shape={collarStyle} opacity={opacityFor("collar")}>
        {collarStyle === "Polo" && <path d={region.collar} transform="translate(0 9)" fill="#171512" fillOpacity="0.24" />}
        <path data-garment-zone="collar" data-collar-part="side-band" d={region.collar} fill={collarColor} stroke={collarColor} strokeWidth="2" strokeLinejoin="round" opacity={opacityFor("collar")} />
        {collarStyle === "V-Neck" && <path d={region.collar} fill="none" stroke="#171512" strokeOpacity="0.4" strokeWidth="4" strokeLinecap="round" />}
      </g>}

      <g mask={`url(#${maskId})`} pointerEvents="none" data-edge-detail="side-view">
        <line x1="0" x2={width} y1={shirtHem} y2={shirtHem} stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
        <line x1="0" x2={width} y1={region.bottomStart - 2} y2={region.bottomStart - 2} stroke="#171512" strokeOpacity="0.22" strokeWidth="1.5" />
        <line x1="0" x2={width} y1={region.bottomHem} y2={region.bottomHem} stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.25" />
        {socksStart < height && <><rect data-sock-opening="complete" data-edge-color={socks} x="0" y={socksStart} width={width} height="18" fill={`url(#${sockEdgeId})`} /><line x1="0" x2={width} y1={socksStart + 2} y2={socksStart + 2} stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" /></>}
      </g>

      {showLongSleeve && (
        <g data-sleeve-replacement="Long" opacity={opacityFor("sleeve")}>
          <path data-long-sleeve-side={side} d={region.longSleeve} fill={sleeve} />
        </g>
      )}

      {showLongSleeve && (
        <path
          data-garment-zone="sleeveStrip"
          data-long-sleeve-cuff={side}
          data-edge-color={sleeveEnd}
          d={region.longSleeveEnd}
          fill={`url(#${sleeveEdgeId})`}
          stroke={sleeveEnd}
          strokeWidth="3"
          strokeLinejoin="round"
          opacity={opacityFor("sleeveStrip")}
        />
      )}

      {patternApplies && (
        <g mask={`url(#${maskId})`} opacity="0.76" data-ai-garment-pattern={garmentPattern.key}>
          {garmentPattern.key === "bands-h" && <rect x="0" y={region.bottomStart * 0.5} width={width} height="54" fill={shirtEnd} />}
          {garmentPattern.key === "bands-v" && <rect x={width * 0.5} y="0" width="58" height={region.bottomStart} fill={shirtEnd} />}
          {garmentPattern.key === "gradient" && <rect x="0" y="0" width={width} height={region.bottomStart} fill={shirtEnd} opacity="0.32" />}
        </g>
      )}

    </svg>
  );
}
