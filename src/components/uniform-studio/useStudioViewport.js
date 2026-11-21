import { useEffect, useRef, useState } from "react";

export default function useStudioViewport() {
  const shellRef = useRef(null);
  const [compact, setCompact] = useState(() => window.matchMedia?.("(max-width: 1279px)").matches || false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 1279px)");
    const update = () => {
      setCompact(Boolean(media?.matches));
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      shellRef.current?.style.setProperty("--studio-viewport-height", `${height}px`);
      shellRef.current?.style.setProperty("--studio-viewport-top", `${viewport?.offsetTop || 0}px`);
      const editing = document.activeElement?.matches("input, textarea, select, [contenteditable=true]");
      // Retain the compact keyboard layout while focus moves to Send/Close.
      // Reflowing on focusout can move that button between touchstart and click.
      setKeyboardOpen((current) => Boolean((editing || current) && height < window.screen.height * 0.75));
    };
    update();
    media?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      media?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return { shellRef, compact, keyboardOpen };
}
