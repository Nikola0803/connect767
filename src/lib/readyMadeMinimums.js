export const READY_MADE_CATEGORY_SLUG = "ready-made-designs";

export const READY_MADE_MINIMUMS = Object.freeze({
  soccer: 22,
  basketball: 10,
  netball: 10,
  cricket: 20,
  goalkeeper: 1,
  other: 10,
});

const CATEGORY_ALIASES = Object.freeze({
  "goal-keeper": "goalkeeper",
  clothing: "other",
  "clothing-other": "other",
  "clothing-and-other": "other",
});

export function normalizeReadyMadeCategory(value) {
  const slug = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return CATEGORY_ALIASES[slug] || slug;
}

export function minimumForReadyMadeCategory(value) {
  return READY_MADE_MINIMUMS[normalizeReadyMadeCategory(value)] || 1;
}

export function readyMadeCartIssues(items = []) {
  const totals = new Map();
  for (const item of items) {
    if (!item?.readyMade) continue;
    const category = normalizeReadyMadeCategory(item.uniformCategory);
    if (!READY_MADE_MINIMUMS[category]) continue;
    totals.set(category, (totals.get(category) || 0) + Math.max(0, Math.floor(Number(item.qty) || 0)));
  }

  const issues = [];
  for (const [category, quantity] of totals) {
    const minimum = minimumForReadyMadeCategory(category);
    if (quantity < minimum) {
      issues.push({
        category,
        quantity,
        minimum,
        message: `Add ${minimum - quantity} more ${category === "other" ? "clothing" : category} item${minimum - quantity === 1 ? "" : "s"} to meet the ${minimum}-unit minimum.`,
      });
    }
  }

  if ((totals.get("goalkeeper") || 0) > 0 && (totals.get("soccer") || 0) === 0) {
    issues.push({
      category: "goalkeeper",
      quantity: totals.get("goalkeeper"),
      minimum: 1,
      message: "Goalkeeper designs must be ordered with a ready-made soccer order.",
    });
  }

  return issues;
}
