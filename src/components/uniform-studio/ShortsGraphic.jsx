import { useId } from "react";
import { fabricShades } from "../../lib/color";

function ZoneGradient({ id, hex, angle = 120 }) {
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

/**
 * Vector shorts mockup — same fabric-gradient technique as JerseyGraphic so
 * it reads as part of the same kit rather than a flat placeholder swatch.
 * Rendered read-only alongside the shirt so the full kit (shirt + shorts +
 * socks) is visible together on one page, per the client's explicit "all
 * uniforms must show fully on one window" requirement.
 */
export default function ShortsGraphic({ sport = "soccer", colors }) {
  const uid = useId();
  const gradId = (zone) => `sg-${uid}-${zone}`;
  const body = colors.shorts || colors.panel || "#1b1a16";
  const strip = colors.shortsStrip || colors.trim || "#f6f1e7";

  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" role="img" aria-label="Shorts">
      <defs>
        <ZoneGradient id={gradId("body")} hex={body} angle={120} />
        <ZoneGradient id={gradId("strip")} hex={strip} angle={100} />
        <filter id={gradId("shadow")} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>
      <g filter={`url(#${gradId("shadow")})`}>
        <path d="M110,30 Q200,14 290,30 L294,58 Q200,42 106,58 Z" fill={`url(#${gradId("strip")})`} />

        {(sport === "baseball" || sport === "cricket") ? (
          <>
            <path
              d="M106,58 Q200,43 294,58 Q298,108 284,144 L265,280 Q240,288 219,278 L205,142 L195,142 L181,278 Q160,288 135,280 L116,144 Q102,108 106,58 Z"
              fill={`url(#${gradId("body")})`}
            />
            <path d="M195,65 L195,142" stroke={`url(#${gradId("strip")})`} strokeWidth="3" opacity="0.55" />
            <path d="M205,65 L205,142" stroke={`url(#${gradId("strip")})`} strokeWidth="3" opacity="0.55" />
            {sport === "baseball" && (
              <>
                <path d="M135,280 Q158,288 181,278" fill="none" stroke={`url(#${gradId("strip")})`} strokeWidth="7" />
                <path d="M219,278 Q242,288 265,280" fill="none" stroke={`url(#${gradId("strip")})`} strokeWidth="7" />
              </>
            )}
          </>
        ) : sport === "basketball" ? (
          <>
            <path
              d="M106,58 Q200,44 294,58 Q302,130 286,178 Q249,184 226,177 Q220,151 210,140 Q200,150 190,140 Q180,151 174,177 Q151,184 114,178 Q98,130 106,58 Z"
              fill={`url(#${gradId("body")})`}
            />
            <path d="M114,178 Q151,184 174,177 Q180,220 168,268 Q143,278 118,270 Q104,224 114,178 Z" fill={`url(#${gradId("body")})`} />
            <path d="M226,177 Q249,184 286,178 Q296,224 282,270 Q257,278 232,268 Q220,220 226,177 Z" fill={`url(#${gradId("body")})`} />
            <path d="M118,270 Q144,280 168,268" fill="none" stroke={`url(#${gradId("strip")})`} strokeWidth="9" />
            <path d="M232,268 Q256,280 282,270" fill="none" stroke={`url(#${gradId("strip")})`} strokeWidth="9" />
          </>
        ) : (
          <>
            <path
              d="M106,58 Q200,44 294,58 Q300,120 288,168 Q244,172 224,168 Q220,140 210,132 Q200,142 190,132 Q180,140 176,168 Q156,172 112,168 Q100,120 106,58 Z"
              fill={`url(#${gradId("body")})`}
            />
            <path d="M112,168 Q156,172 176,168 Q178,200 168,238 Q146,246 122,240 Q108,206 112,168 Z" fill={`url(#${gradId("body")})`} />
            <path d="M224,168 Q244,172 288,168 Q292,206 278,240 Q254,246 232,238 Q222,200 224,168 Z" fill={`url(#${gradId("body")})`} />
            <path d="M122,240 Q146,246 168,238 L170,252 Q146,260 120,254 Z" fill={`url(#${gradId("strip")})`} />
            <path d="M232,238 Q254,246 278,240 L280,254 Q254,260 230,252 Z" fill={`url(#${gradId("strip")})`} />
            <path d="M112,72 Q104,120 100,166" stroke={`url(#${gradId("strip")})`} strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d="M288,72 Q296,120 300,166" stroke={`url(#${gradId("strip")})`} strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.9" />
          </>
        )}
      </g>
    </svg>
  );
}
