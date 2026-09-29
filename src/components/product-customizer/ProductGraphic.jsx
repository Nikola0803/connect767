import { useId } from "react";
import { fabricShades } from "../../lib/color";

function FabricGradient({ id, hex, angle = 135 }) {
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

function TShirt({ fillUrl, back }) {
  return (
    <g>
      <path
        d="M140,64
           L160,46 Q200,30 240,46 L260,64
           L320,90 L340,140 L300,158
           L288,128 L288,340
           Q200,352 112,340
           L112,128 L100,158 L60,140
           L80,90 Z"
        fill={fillUrl}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="2"
      />
      {!back && (
        <path
          d="M160,46 Q200,72 240,46 Q234,66 200,72 Q166,66 160,46 Z"
          fill="rgba(0,0,0,0.12)"
        />
      )}
      {back && (
        <path
          d="M172,58 Q200,50 228,58 Q224,68 200,70 Q176,68 172,58 Z"
          fill="rgba(0,0,0,0.1)"
        />
      )}
    </g>
  );
}

function Hoodie({ fillUrl, back }) {
  return (
    <g>
      {/* Hood */}
      <path
        d={
          back
            ? "M150,58 Q200,20 250,58 Q256,86 200,92 Q144,86 150,58 Z"
            : "M148,60 Q200,26 252,60 Q252,90 200,98 Q148,90 148,60 Z"
        }
        fill={fillUrl}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="2"
      />
      {/* Body */}
      <path
        d="M132,92
           L158,80 Q200,64 242,80 L268,92
           L326,116 L344,166 L302,184
           L290,152 L290,344
           Q200,358 110,344
           L110,152 L98,184 L56,166
           L74,116 Z"
        fill={fillUrl}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="2"
      />
      {!back && (
        <>
          <path
            d="M150,210 Q200,196 250,210 L250,260 Q200,276 150,260 Z"
            fill="rgba(0,0,0,0.08)"
          />
          <path d="M198,210 L198,260" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
          <circle cx="200" cy="118" r="5" fill="rgba(0,0,0,0.18)" />
          <path
            d="M186,110 Q186,150 178,205 M214,110 Q214,150 222,205"
            fill="none"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

function Sock({ fillUrl }) {
  return (
    <g transform="translate(100,40)">
      <path
        d="M50,10
           Q90,8 96,40
           L96,180
           Q96,210 130,230
           Q170,252 168,286
           Q166,312 130,314
           L40,314
           Q14,312 14,286
           L14,40
           Q14,10 50,10 Z"
        fill={fillUrl}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="2"
      />
      {/* Cuff ribbing */}
      <g stroke="rgba(0,0,0,0.1)" strokeWidth="2">
        <path d="M18,30 L92,30" />
        <path d="M16,50 L94,50" />
        <path d="M15,70 L95,70" />
      </g>
      {/* Heel shading */}
      <path d="M96,190 Q130,205 155,235 Q135,250 96,230 Z" fill="rgba(0,0,0,0.08)" />
    </g>
  );
}

function Cap({ fillUrl }) {
  return (
    <g transform="translate(60,90)">
      {/* Brim */}
      <path
        d="M20,150 Q100,190 280,150 Q270,175 200,182 Q100,186 30,172 Q18,164 20,150 Z"
        fill="rgba(0,0,0,0.16)"
      />
      {/* Crown panels */}
      <path
        d="M140,10 Q60,18 30,90 Q22,120 40,150
           Q140,178 240,150
           Q258,120 250,90
           Q220,18 140,10 Z"
        fill={fillUrl}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="2"
      />
      {/* Panel seams */}
      <g stroke="rgba(0,0,0,0.12)" strokeWidth="2" fill="none">
        <path d="M140,10 L140,178" />
        <path d="M90,20 Q70,90 78,155" />
        <path d="M190,20 Q210,90 202,155" />
      </g>
      {/* Button */}
      <circle cx="140" cy="14" r="6" fill="rgba(0,0,0,0.18)" />
    </g>
  );
}

/** A close-up of the sleeve cuff area — its own printable placement, same
 * as Printful's "Short left/right sleeve" tabs, not just a zoom of the
 * full-garment view. */
function SleevePanel({ fillUrl, side }) {
  const flip = side === "right";
  return (
    <g transform={flip ? "translate(400,0) scale(-1,1)" : undefined}>
      <path
        d="M60,120 Q40,160 45,220 Q48,260 70,290 L180,290 Q195,250 190,190 Q185,140 150,110 Q100,95 60,120 Z"
        fill={fillUrl}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="2"
      />
      <path d="M45,225 Q115,245 190,192" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
      <text
        x={flip ? -200 : 200}
        y="340"
        textAnchor="middle"
        fontSize="14"
        fill="rgba(0,0,0,0.35)"
        transform={flip ? "scale(-1,1)" : undefined}
        style={{ fontFamily: "sans-serif" }}
      >
        {side === "right" ? "Right sleeve" : "Left sleeve"}
      </text>
    </g>
  );
}

/** A care-label-style rectangle for the inside-label placement — small
 * printable area, no dashed print-safe guide needed since the label
 * itself is effectively the safe zone. */
function InsideLabelPanel() {
  return (
    <g transform="translate(100,140)">
      <rect
        x="0"
        y="0"
        width="200"
        height="90"
        rx="6"
        fill="#fdfcf9"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="2"
      />
      <line x1="20" y1="30" x2="180" y2="30" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <line x1="20" y1="50" x2="150" y2="50" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
      <line x1="20" y1="70" x2="160" y2="70" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
    </g>
  );
}

/**
 * Same recolor technique as the Uniform Studio's JerseyGraphic — a single
 * gradient built from `fabricShades()` (highlight/base/shadow derived from
 * one hex) rather than a flat fill or a real photo per color, so any
 * garment color can be previewed instantly without needing product photos
 * for every combination.
 */
export default function ProductGraphic({ productType, view, color }) {
  const gradientId = useId();
  const fillUrl = `url(#${gradientId})`;
  const back = view === "back";

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-sm">
      <defs>
        <FabricGradient id={gradientId} hex={color} />
      </defs>
      {view === "sleeve-left" && <SleevePanel fillUrl={fillUrl} side="left" />}
      {view === "sleeve-right" && <SleevePanel fillUrl={fillUrl} side="right" />}
      {view === "inside-label" && <InsideLabelPanel />}
      {view !== "sleeve-left" && view !== "sleeve-right" && view !== "inside-label" && (
        <>
          {productType === "tshirt" && <TShirt fillUrl={fillUrl} back={back} />}
          {productType === "hoodie" && <Hoodie fillUrl={fillUrl} back={back} />}
          {productType === "socks" && <Sock fillUrl={fillUrl} />}
          {productType === "cap" && <Cap fillUrl={fillUrl} />}
        </>
      )}
    </svg>
  );
}
