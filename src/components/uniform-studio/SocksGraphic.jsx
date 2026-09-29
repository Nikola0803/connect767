import { useId } from "react";
import { fabricShades } from "../../lib/color";

function ZoneGradient({ id, hex, angle = 100 }) {
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

function Sock({ x, gradBody, gradStrip }) {
  return (
    <g transform={`translate(${x},0)`}>
      <path
        d="M18,10 Q46,2 74,10 Q80,60 76,120 Q78,160 64,184 Q46,194 26,184 Q14,160 16,120 Q12,60 18,10 Z"
        fill={gradBody}
      />
      {/* Cuff */}
      <path d="M18,10 Q46,2 74,10 L72,32 Q46,24 20,32 Z" fill={gradStrip} />
      {/* Shin stripe */}
      <rect x="30" y="46" width="34" height="10" rx="2" fill={gradStrip} opacity="0.9" />
    </g>
  );
}

/**
 * Vector sock pair — read-only preview so the client's explicit "socks,
 * shirt, and shorts all shown together in one view" requirement is met.
 * Socks stay non-editable in the studio (per spec: sock customization needs
 * a 50-pair minimum handled separately in the quote conversation).
 */
export default function SocksGraphic({ colors }) {
  const uid = useId();
  const gradId = (zone) => `sk-${uid}-${zone}`;
  const body = colors.socks || colors.panel || "#1b1a16";
  const strip = colors.shortsStrip || colors.trim || "#f6f1e7";

  return (
    <svg viewBox="0 0 180 200" className="w-full h-full" role="img" aria-label="Socks">
      <defs>
        <ZoneGradient id={gradId("body")} hex={body} angle={100} />
        <ZoneGradient id={gradId("strip")} hex={strip} angle={100} />
        <filter id={gradId("shadow")} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>
      <g filter={`url(#${gradId("shadow")})`}>
        <Sock x={0} gradBody={`url(#${gradId("body")})`} gradStrip={`url(#${gradId("strip")})`} />
        <Sock x={86} gradBody={`url(#${gradId("body")})`} gradStrip={`url(#${gradId("strip")})`} />
      </g>
    </svg>
  );
}
