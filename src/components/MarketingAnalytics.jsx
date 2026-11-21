import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackMarketingEvent } from "../lib/marketingAnalytics";

export default function MarketingAnalytics() {
  const location = useLocation();

  useEffect(() => {
    trackMarketingEvent("page_view", { path: `${location.pathname}${location.search}` });
  }, [location.pathname, location.search]);

  return null;
}
