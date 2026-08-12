import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { getMyListings, setListingTier } from "../data/repository";
import { isLiveApi } from "../lib/config";
import Button from "../components/ui/Button";
import TierBadge from "../components/ui/TierBadge";
import { CardSkeleton, ErrorState } from "../components/ui/States";

const statusMeta = {
  publish: { label: "Live", className: "bg-primary-100 text-primary-800" },
  pending: { label: "Awaiting review", className: "bg-accent-100 text-accent-900" },
  draft: { label: "Draft", className: "bg-background-200 text-foreground-700" },
};

export default function DashboardPage() {
  const { isAuthenticated, name, email } = useAuth();
  const { data: listings, loading, error, reload } = useAsync(() => getMyListings(), []);
  const navigate = useNavigate();
  const [tierBusy, setTierBusy] = useState(null);
  const [tierError, setTierError] = useState(null);

  /**
   * Switch a listing between Free and Classified.
   *
   * Upgrading marks it Classified/unpaid server-side and hands back
   * `paymentRequired`; the owner is then sent to the same payment step the
   * submission wizard uses. Nothing grants a paid tier without payment.
   */
  const changeTier = async (item, tier) => {
    if (tier === "free" && !window.confirm(`Move "${item.title}" down to the Free plan?`)) return;
    setTierError(null);
    setTierBusy(item.id);
    try {
      const result = await setListingTier(item.id, tier);
      if (result?.paymentRequired) {
        navigate(`/listings/${item.slug}/edit?upgrade=1`);
        return;
      }
      reload();
    } catch (err) {
      setTierError(err.message || "Couldn't change the plan. Please try again.");
    } finally {
      setTierBusy(null);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: "/dashboard" }} replace />;
  }

  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-14 bg-background-100/50 border-b border-background-200/70">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-3">
              <i className="ri-dashboard-line" />
              Dashboard
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
              Welcome back{name ? `, ${name}` : ""}.
            </h1>
            <p className="text-sm text-foreground-600 font-label mt-1">{email}</p>
          </div>
          <Button to="/listings/submit" variant="primary" icon="ri-add-line">
            Add another listing
          </Button>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-xl font-medium text-foreground-950 mb-5">
            Your listings
          </h2>

          {!isLiveApi && (
            <div className="mb-6 px-3.5 py-2.5 rounded-lg bg-secondary-100 border border-secondary-200 text-xs text-secondary-900 flex items-start gap-2">
              <i className="ri-flask-line mt-0.5 flex-shrink-0" />
              <span>
                Demo mode — no backend connected, so there's nothing to show here yet. Listings
                you submit only exist for real once{" "}
                <code className="font-mono">VITE_WP_BASE_URL</code> is set.
              </span>
            </div>
          )}

          {tierError && (
            <p className="mb-4 text-xs text-accent-600 font-label flex items-start gap-1.5">
              <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
              {tierError}
            </p>
          )}

          {loading && <CardSkeleton count={3} className="space-y-3" />}

          {error && <ErrorState message="Couldn't load your listings." onRetry={reload} />}

          {!loading && !error && listings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-background-300 p-10 text-center">
              <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-background-100 text-foreground-400 mb-4">
                <i className="ri-store-2-line text-xl" />
              </div>
              <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1.5">
                No listings yet
              </h3>
              <p className="text-sm text-foreground-600 max-w-sm mx-auto mb-5">
                Once you submit a business, it'll show up here — including anything still
                awaiting review.
              </p>
              <Button to="/listings/submit" variant="primary" icon="ri-add-line">
                Add your first listing
              </Button>
            </div>
          )}

          {!loading && !error && listings.length > 0 && (
            <div className="space-y-3">
              {listings.map((item) => {
                const status = statusMeta[item.status] || statusMeta.draft;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-xl border border-background-200/70 bg-background-50 p-4 sm:p-5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="font-heading text-base font-medium text-foreground-950 truncate">
                          {item.title}
                        </h3>
                        <TierBadge tier={item.tier} />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-600 font-label">
                        {item.category && <span>{item.category}</span>}
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <i className="ri-map-pin-line" />
                            {item.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <i className="ri-star-fill text-accent-500" />
                          {item.rating} ({item.reviewCount})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Tier change without re-running the whole wizard —
                          upgrading was previously only possible at submission
                          time, so an existing Free listing had no route to
                          Classified at all. */}
                      {item.tier === "Classified" ? (
                        <button
                          type="button"
                          onClick={() => changeTier(item, "free")}
                          disabled={tierBusy === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-background-300 text-sm font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          <i className="ri-arrow-down-line" />
                          {tierBusy === item.id ? "Saving…" : "Downgrade"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => changeTier(item, "classified")}
                          disabled={tierBusy === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          <i className="ri-vip-crown-line" />
                          {tierBusy === item.id ? "Saving…" : "Upgrade"}
                        </button>
                      )}
                      <Link
                        to={`/listings/${item.slug}/edit`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-background-300 text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-edit-line" />
                        Edit
                      </Link>
                      {item.viewUrl ? (
                        <Link
                          to={`/listings/${item.slug}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-background-300 text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer whitespace-nowrap"
                        >
                          View listing
                          <i className="ri-arrow-right-line" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-background-100 text-sm text-foreground-500 whitespace-nowrap">
                          <i className="ri-time-line" />
                          Pending review
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
