import { Navigate, useLocation } from "react-router-dom";
import { listingOnboardingRequired } from "../lib/listingOnboarding";

export default function ListingOnboardingGate({ children }) {
  const location = useLocation();

  if (listingOnboardingRequired()) {
    return (
      <Navigate
        replace
        to="/listings/submit?onboarding=1&tier=free"
        state={{ from: location.pathname, notice: "Complete your first listing to open your dashboard." }}
      />
    );
  }

  return children;
}
