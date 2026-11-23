import { useEffect, useRef, useState } from "react";

export default function useReadyMadeImageProtection(active) {
  const [captureShieldActive, setCaptureShieldActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setCaptureShieldActive(false);
      return undefined;
    }
    const showShield = (autoHide = false) => {
      window.clearTimeout(timerRef.current);
      setCaptureShieldActive(true);
      if (autoHide) timerRef.current = window.setTimeout(() => setCaptureShieldActive(false), 1800);
    };
    const hideShield = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCaptureShieldActive(false), 250);
    };
    const handleKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      const captureShortcut = event.key === "PrintScreen"
        || ((event.metaKey || event.ctrlKey) && event.shiftKey && ["s", "3", "4", "5"].includes(key));
      const blockedShortcut = (event.metaKey || event.ctrlKey) && ["p", "s"].includes(key);
      if (!captureShortcut && !blockedShortcut) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showShield(true);
    };
    const blockProtectedAction = (event) => {
      if (!event.target?.closest?.('[data-protected-ready-made="true"]')) return;
      event.preventDefault();
    };
    const handleVisibility = () => document.hidden ? showShield() : hideShield();
    const handleWindowBlur = () => showShield();
    const handleBeforePrint = () => showShield();

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("contextmenu", blockProtectedAction, true);
    document.addEventListener("copy", blockProtectedAction, true);
    document.addEventListener("cut", blockProtectedAction, true);
    document.addEventListener("dragstart", blockProtectedAction, true);
    document.addEventListener("selectstart", blockProtectedAction, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", hideShield);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", hideShield);
    return () => {
      window.clearTimeout(timerRef.current);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("contextmenu", blockProtectedAction, true);
      document.removeEventListener("copy", blockProtectedAction, true);
      document.removeEventListener("cut", blockProtectedAction, true);
      document.removeEventListener("dragstart", blockProtectedAction, true);
      document.removeEventListener("selectstart", blockProtectedAction, true);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", hideShield);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", hideShield);
    };
  }, [active]);

  return captureShieldActive;
}
