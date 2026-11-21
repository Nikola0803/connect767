export const UNIFORM_ORDER_DRAFT_KEY = "c767:uniform-order-designs:v1";

const storage = () => (typeof window === "undefined" ? null : window.localStorage);

export function loadUniformOrderDesigns() {
  try {
    const value = JSON.parse(storage()?.getItem(UNIFORM_ORDER_DRAFT_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.payload) : [];
  } catch {
    return [];
  }
}

export function persistUniformOrderDesigns(items) {
  try {
    const compact = (items || []).map((item) => ({
      ...item,
      payload: {
        ...item.payload,
        // Generated previews can exceed localStorage's quota. The protected
        // project file remains server-side and is still bound by projectId.
        previewImage: String(item.payload?.previewImage || "").length <= 1500000
          ? item.payload?.previewImage || null
          : null,
      },
    }));
    storage()?.setItem(UNIFORM_ORDER_DRAFT_KEY, JSON.stringify(compact));
    return true;
  } catch {
    return false;
  }
}

export function createUniformOrderDesign(payload, existingId = "") {
  const id = existingId || globalThis.crypto?.randomUUID?.() || `design-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    savedAt: Date.now(),
    payload: { ...payload, draftItemId: id },
  };
}

export function upsertUniformOrderDesign(items, item) {
  const current = Array.isArray(items) ? items : [];
  const index = current.findIndex((candidate) => candidate.id === item.id);
  if (index < 0) return [...current, item];
  return current.map((candidate, itemIndex) => itemIndex === index ? item : candidate);
}

export function removeUniformOrderDesign(items, id) {
  return (Array.isArray(items) ? items : []).filter((item) => item.id !== id);
}

export function designOrderUnitCount(payload) {
  const roster = (payload?.roster || []).reduce((total, row) => total + Math.max(0, Number(row?.quantity) || 0), 0);
  const extras = (payload?.extraTeamShirts || []).reduce((total, row) => total + Math.max(0, Number(row?.quantity) || 0), 0);
  const supporters = payload?.fanJerseyAdded
    ? (payload?.supporterJerseys || []).reduce((total, row) => total + Math.max(0, Number(row?.quantity) || 0), 0)
    : 0;
  return roster + extras + supporters;
}
