import { useEffect, useRef, useState } from "react";

const same = (a, b) => a && b && Object.keys(a).every((key) => a[key] === b[key]);

// Keep immutable garment/layer references, rather than copying image data on
// every edit. View changes and AI-only previews never enter this history.
export default function useDesignHistory({ enabled, identity, snapshot, onRestore }) {
  const entries = useRef([]);
  const cursor = useRef(-1);
  const scope = useRef(null);
  const restoring = useRef(null);
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!enabled || scope.current !== identity) {
      entries.current = enabled ? [snapshot] : [];
      cursor.current = enabled ? 0 : -1;
      scope.current = enabled ? identity : null;
      restoring.current = null;
      redraw((value) => value + 1);
      return;
    }
    if (same(restoring.current, snapshot)) { restoring.current = null; return; }
    if (same(entries.current[cursor.current], snapshot)) return;
    entries.current = [...entries.current.slice(0, cursor.current + 1), snapshot].slice(-60);
    cursor.current = entries.current.length - 1;
    redraw((value) => value + 1);
  }, [enabled, identity, snapshot]);
  const move = (direction) => {
    const next = cursor.current + direction;
    if (!enabled || next < 0 || next >= entries.current.length) return;
    cursor.current = next;
    restoring.current = entries.current[next];
    restore.current(entries.current[next]);
    redraw((value) => value + 1);
  };
  return {
    canUndo: enabled && cursor.current > 0,
    canRedo: enabled && cursor.current < entries.current.length - 1,
    undo: () => move(-1),
    redo: () => move(1),
  };
}
