import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * React Router doesn't touch scroll position on navigation — the browser
 * just leaves the viewport wherever it was on the previous page. That's why
 * every new route was loading part-way down the page instead of at the top.
 * This resets scroll on every pathname change, except for actual back/
 * forward navigation (POP), where restoring the previous scroll spot is the
 * expected behavior.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
