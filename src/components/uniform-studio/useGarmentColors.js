import { useMemo } from "react";
import { normalizeZoneColors } from "../../data/uniforms";

// The controls and all garment views must edit the same palette, including
// while a generated AI plan is being previewed on the production map.
export default function useGarmentColors({ colors, setColors, previewPlan, setPreviewPlan, zoneModel, setZoneStyles }) {
  const visibleColors = useMemo(() => previewPlan?.colors ? normalizeZoneColors(previewPlan.colors) : colors, [previewPlan, colors]);
  const updateColors = (update) => {
    const next = typeof update === "function" ? update(visibleColors) : update;
    setColors(next);
    if (previewPlan) setPreviewPlan((plan) => plan ? { ...plan, colors: next } : plan);

    // A saved panel-specific color must not conceal a later garment swatch
    // change. Keep its boundary, pattern and other customization intact.
    const aliases = { armhole: "sleeve", waistband: "shorts", sockTrim: "socks" };
    setZoneStyles((styles) => Object.fromEntries(Object.entries(styles).map(([side, entries]) => [side,
      Object.fromEntries(Object.entries(entries).map(([id, style]) => {
        const zone = zoneModel?.[side]?.find((item) => item.id === id);
        const key = aliases[zone?.colorKey] || zone?.colorKey;
        if (!style?.color || !key || next[key] === visibleColors[key]) return [id, style];
        const remainingStyle = { ...style };
        delete remainingStyle.color;
        return [id, remainingStyle];
      })),
    ])));
  };
  return [visibleColors, updateColors];
}
