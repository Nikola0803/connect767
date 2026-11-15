import { Fragment, useRef } from "react";
import { commandsToPath } from "./uniformZoneModel";

const OUTLINE_COLORS = ["#00a86b", "#f15b40", "#2b7fff", "#e0a11a", "#8d5de7", "#00a7a7"];

function svgPoint(event) {
  const svg = event.currentTarget.ownerSVGElement;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

export default function ZoneCorrectionOverlay({
  zones,
  offsetX = 0,
  selectedZoneId,
  showOutlines = false,
  correctionMode = false,
  zoneStyles = {},
  colorValues = {},
  onSelectZone,
  onMovePoint,
  maskIds = {},
}) {
  const dragRef = useRef(null);
  const selected = zones.find((item) => item.id === selectedZoneId);
  const parentMask = (item) => {
    if (item.id.includes("sock")) return maskIds.socks || maskIds.garment;
    if (item.id.includes("shorts") || item.id.includes("waistband")) return maskIds.shorts || maskIds.garment;
    return maskIds.jersey || maskIds.garment;
  };

  const beginDrag = (event, commandIndex, pointType) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { commandIndex, pointType };
  };

  const drag = (event) => {
    if (!dragRef.current || !selected) return;
    event.stopPropagation();
    const point = svgPoint(event);
    onMovePoint?.(selected.id, dragRef.current.commandIndex, dragRef.current.pointType, {
      x: point.x - offsetX,
      y: point.y,
    });
  };

  const endDrag = (event) => {
    if (!dragRef.current) return;
    event.stopPropagation();
    dragRef.current = null;
  };

  return (
    <g data-zone-correction-overlay="true">
      <defs>
        {zones.map((item) => {
          const style = zoneStyles[item.id] || {};
          const safe = item.id.replace(/[^a-z0-9-]/gi, "");
          const primary = style.color || colorValues[item.colorKey] || "#f6f1e7";
          const secondary = style.gradientColor || primary;
          return (
            <Fragment key={`defs-${item.id}`}>
              <linearGradient id={`zone-gradient-${safe}`} x1="0" y1="0" x2={style.gradientDirection === "vertical" ? "0" : "1"} y2={style.gradientDirection === "vertical" ? "1" : "1"}>
                <stop offset="0" stopColor={primary} />
                <stop offset="1" stopColor={secondary} />
              </linearGradient>
              <pattern id={`zone-pattern-${safe}`} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`rotate(${style.pattern === "diagonal" ? 35 : 0})`}>
                <rect width="24" height="24" fill={style.gradientEnabled ? `url(#zone-gradient-${safe})` : primary} />
                {style.pattern === "diagonal" && <rect width="8" height="24" fill={style.patternColor || "#ffffff"} fillOpacity="0.65" />}
                {style.pattern === "checks" && <><rect width="12" height="12" fill={style.patternColor || "#ffffff"} fillOpacity="0.65" /><rect x="12" y="12" width="12" height="12" fill={style.patternColor || "#ffffff"} fillOpacity="0.65" /></>}
                {style.pattern === "dots" && <circle cx="12" cy="12" r="5" fill={style.patternColor || "#ffffff"} fillOpacity="0.72" />}
              </pattern>
            </Fragment>
          );
        })}
      </defs>
      {zones.map((item) => {
        const active = item.id === selectedZoneId;
        const style = zoneStyles[item.id] || {};
        const color = style.color || colorValues[item.colorKey] || "#f6f1e7";
        const safe = item.id.replace(/[^a-z0-9-]/gi, "");
        const fill = style.pattern && style.pattern !== "none"
          ? `url(#zone-pattern-${safe})`
          : style.gradientEnabled
            ? `url(#zone-gradient-${safe})`
            : color;
        const opacity = Number.isFinite(style.opacity) ? style.opacity : 0.88;
        return (
          <path
            key={item.id}
            d={commandsToPath(item.commands, offsetX)}
            fill={fill}
            fillOpacity={opacity}
            stroke={style.borderColor || "none"}
            strokeOpacity={style.borderColor ? 0.95 : 0}
            strokeWidth={style.borderWidth || 2}
            vectorEffect="non-scaling-stroke"
            mask={parentMask(item) ? `url(#${parentMask(item)})` : undefined}
            style={{
              mixBlendMode: style.blendMode || "color",
              cursor: correctionMode ? "crosshair" : "pointer",
              filter: style.texture === "mesh" ? "url(#zone-mesh)" : undefined,
            }}
            data-zone-id={item.id}
            data-zone-name={item.name}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelectZone?.(item.id);
            }}
          >
            <title>{`${item.id} — ${item.name}`}</title>
          </path>
        );
      })}

      {/* Verification is intentionally outside the parent garment masks.
          That keeps boundary strokes and correction anchors visible even
          when they sit exactly on the source alpha edge. */}
      {zones.map((item, index) => {
        const active = item.id === selectedZoneId;
        const style = zoneStyles[item.id] || {};
        return (
          <path
            key={`outline-${item.id}`}
            d={commandsToPath(item.commands, offsetX)}
            fill="transparent"
            stroke={active ? "#ff6b4a" : (style.borderColor || OUTLINE_COLORS[index % OUTLINE_COLORS.length])}
            strokeOpacity={showOutlines || active || style.borderColor ? 0.95 : 0}
            strokeWidth={active ? 4 : (style.borderWidth || 2)}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: correctionMode ? "crosshair" : "pointer" }}
            data-zone-id={item.id}
            onPointerDown={(event) => { event.stopPropagation(); onSelectZone?.(item.id); }}
          />
        );
      })}

      {correctionMode && selected && (
        <g aria-label={`Boundary controls for ${selected.name}`}>
          {selected.commands.map((command, index) => {
            const previous = selected.commands[index - 1] || selected.commands[selected.commands.length - 1];
            return (
              <g key={`${selected.id}-${index}`}>
                {command.type === "C" && (
                  <>
                    <line x1={previous.x + offsetX} y1={previous.y} x2={command.c1x + offsetX} y2={command.c1y} stroke="#29b6f6" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                    <line x1={command.x + offsetX} y1={command.y} x2={command.c2x + offsetX} y2={command.c2y} stroke="#29b6f6" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                    {[{ type: "c1", x: command.c1x, y: command.c1y }, { type: "c2", x: command.c2x, y: command.c2y }].map((handle) => (
                      <circle
                        key={handle.type}
                        cx={handle.x + offsetX}
                        cy={handle.y}
                        r="7"
                        fill="#101820"
                        stroke="#29b6f6"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: "grab" }}
                        onPointerDown={(event) => beginDrag(event, index, handle.type)}
                        onPointerMove={drag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                    ))}
                  </>
                )}
                <circle
                  cx={command.x + offsetX}
                  cy={command.y}
                  r="9"
                  fill="#fff"
                  stroke="#ff6b4a"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "move" }}
                  onPointerDown={(event) => beginDrag(event, index, "anchor")}
                  onPointerMove={drag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}
