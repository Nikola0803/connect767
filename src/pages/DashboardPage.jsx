import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import {
  getMyBookings,
  getMyListings,
  requestBookingCashout,
  setBookingStatus,
} from "../data/repository";
import { isLiveApi } from "../lib/config";
import Button from "../components/ui/Button";
import { bookingRateUnit, isRentalBookingType } from "../lib/bookingTypes";
import TierBadge from "../components/ui/TierBadge";
import { CardSkeleton, ErrorState } from "../components/ui/States";
import VendorProductsPanel from "../components/dashboard/VendorProductsPanel";
import {
  DASHBOARD_ACTION,
  DASHBOARD_EYEBROW,
  DASHBOARD_PANEL,
  DASHBOARD_SECTION_HEADING,
  DASHBOARD_SECTION_SUBTITLE,
} from "../components/dashboard/dashboardStyles";

const statusMeta = {
  publish: { label: "Live", className: "bg-primary-100 text-primary-800" },
  pending: { label: "Awaiting review", className: "bg-accent-100 text-accent-900" },
  draft: { label: "Draft", className: "bg-background-200 text-foreground-700" },
};

export default function DashboardPage() {
  const { isAuthenticated, name, email } = useAuth();
  const { data: listings, loading, error, reload } = useAsync(() => getMyListings(), []);
  const {
    data: bookings,
    loading: bookingsLoading,
    error: bookingsError,
    reload: reloadBookings,
  } = useAsync(() => getMyBookings(), []);
  const [searchParams] = useSearchParams();
  const productListingId = searchParams.get("products") || "";
  const storefrontListingId = searchParams.get("storefront") || "";
  const [bookingBusy, setBookingBusy] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  useEffect(() => {
    if (!productListingId || !listings?.length) return;
    document.getElementById("products-services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [productListingId, listings]);

  useEffect(() => {
    if (!storefrontListingId || !listings?.length) return;
    document.getElementById("store-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [storefrontListingId, listings]);

  const changeBookingStatus = async (booking, status) => {
    setBookingBusy(booking.id);
    setBookingError(null);
    try {
      await setBookingStatus(booking.id, status);
      reloadBookings();
    } catch (err) {
      setBookingError(err.message || "Couldn't update this booking.");
    } finally {
      setBookingBusy(null);
    }
  };

  const cashOutBooking = async (booking) => {
    setBookingBusy(booking.id);
    setBookingError(null);
    try {
      await requestBookingCashout(booking.id);
      reloadBookings();
    } catch (err) {
      setBookingError(err.message || "Couldn't request this payout.");
    } finally {
      setBookingBusy(null);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: "/dashboard" }} replace />;
  }

  return (
    <div className="min-h-screen bg-background-50 pt-16 md:pt-20">
      <div className="w-full border-b border-background-200 bg-gradient-to-br from-background-100/80 to-background-50 px-4 py-10 md:px-8 md:py-14 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-3">
              <i className="ri-dashboard-line" />
              Seller Center
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em] text-foreground-950 md:text-4xl">Connect767 Seller Center</h1>
            <p className="mt-2 text-sm font-medium text-foreground-700">Welcome back{name ? `, ${name}` : ""}.</p>
            <p className="text-sm text-foreground-600 font-label mt-1">{email}</p>
          </div>
          <Button to="/listings/submit" variant="primary" icon="ri-add-line">
            Add another listing
          </Button>
        </div>
      </div>

      <div className="w-full px-4 py-10 md:px-8 md:py-14 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5">
            <p className={DASHBOARD_EYEBROW}>Directory management</p>
            <h2 id="my-listings" className={`scroll-mt-24 ${DASHBOARD_SECTION_HEADING}`}>
              Your listings
            </h2>
            <p className={DASHBOARD_SECTION_SUBTITLE}>Manage directory profiles, storefronts, and listing plans.</p>
          </div>

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
                    className={`${DASHBOARD_PANEL} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5`}
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
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      <Link
                        to={`/dashboard?products=${item.id}#products-services`}
                        className={`${DASHBOARD_ACTION} border border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100`}
                      >
                        <i className="ri-store-2-line" />
                        Products
                      </Link>
                      <Link
                        to={`/listings/${item.slug}/edit`}
                        className={`${DASHBOARD_ACTION} border border-background-300 text-foreground-800 hover:bg-background-100`}
                      >
                        <i className="ri-file-edit-line" />
                        Edit directory listing
                      </Link>
                      <Link
                        to={`/dashboard?storefront=${item.id}#store-settings`}
                        className={`${DASHBOARD_ACTION} border border-background-300 text-foreground-800 hover:bg-background-100`}
                      >
                        <i className="ri-edit-line" />
                        Edit storefront
                      </Link>
                      {item.viewUrl ? (
                        <Link
                          to={`/listings/${item.slug}`}
                          className={`${DASHBOARD_ACTION} border border-background-300 text-foreground-800 hover:bg-background-100`}
                        >
                          View listing
                          <i className="ri-arrow-right-line" />
                        </Link>
                      ) : (
                        <span className={`${DASHBOARD_ACTION} bg-background-100 text-foreground-500`}>
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

          {!loading && !error && listings.length > 0 && (
            <VendorProductsPanel
              listings={listings}
              initialListingId={productListingId}
              initialStorefrontListingId={storefrontListingId}
              ownerName={name}
            />
          )}

          <div id="bookings-rentals" className="mt-12 scroll-mt-24 border-t border-background-200 pt-10">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className={DASHBOARD_EYEBROW}>Scheduling</p>
                <h2 className={DASHBOARD_SECTION_HEADING}>
                  Bookings & rentals
                </h2>
                <p className={DASHBOARD_SECTION_SUBTITLE}>
                  Paid bookings confirm automatically. Free requests need your approval.
                </p>
              </div>
              <button
                type="button"
                onClick={reloadBookings}
                className="text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
              >
                <i className="ri-refresh-line mr-1" /> Refresh
              </button>
            </div>

            {bookingError && (
              <p className="mb-4 text-xs text-accent-600 font-label">{bookingError}</p>
            )}
            {bookingsLoading && <CardSkeleton count={2} className="space-y-3" />}
            {bookingsError && (
              <ErrorState message="Couldn't load bookings and rentals." onRetry={reloadBookings} />
            )}
            {!bookingsLoading && !bookingsError && bookings.length === 0 && (
              <div className="rounded-2xl border border-dashed border-background-300 p-8 text-center">
                <i className="ri-calendar-event-line text-2xl text-foreground-300" />
                <p className="text-sm text-foreground-600 font-label mt-2">
                  No booking or rental requests yet.
                </p>
              </div>
            )}
            {!bookingsLoading && !bookingsError && bookings.length > 0 && (
              <div className="space-y-3">
                {bookings.map((booking) => {
                  const paid = booking.paymentStatus === "paid";
                  const requiresPayment = booking.amountCents > 0;
                  return (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-background-200/70 bg-background-50 p-4 sm:p-5"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-heading text-base font-medium text-foreground-950">
                              {booking.name} · {booking.listingTitle}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              booking.status === "confirmed"
                                ? "bg-primary-100 text-primary-800"
                                : booking.status === "declined"
                                ? "bg-accent-100 text-accent-800"
                                : "bg-secondary-100 text-secondary-900"
                            }`}>
                              {booking.status}
                            </span>
                            {requiresPayment && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                paid ? "bg-primary-100 text-primary-800" : "bg-background-200 text-foreground-700"
                              }`}>
                                {paid ? "Paid" : `Awaiting $${(booking.amountCents / 100).toFixed(2)}`}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-600 font-label">
                            {isRentalBookingType(booking.bookingType) ? <>
                              <span><i className="ri-calendar-check-line mr-1" />{bookingRateUnit(booking.bookingType) === "night" ? "Check-in" : "Start"}: {booking.checkIn}</span>
                              <span><i className="ri-calendar-close-line mr-1" />{bookingRateUnit(booking.bookingType) === "night" ? "Check-out" : "End"}: {booking.checkOut}</span>
                              <span>{booking.units || booking.nights} {booking.rateUnit || bookingRateUnit(booking.bookingType)}{(booking.units || booking.nights) === 1 ? "" : "s"}</span>
                            </> : <>
                              <span><i className="ri-calendar-line mr-1" />{booking.preferredDate || "Date not specified"}</span>
                              <span><i className="ri-time-line mr-1" />{booking.preferredTime || "Time not specified"}</span>
                              <span>{booking.durationMinutes} minutes</span>
                            </>}
                            {booking.email && <a href={`mailto:${booking.email}`} className="hover:text-primary-700">{booking.email}</a>}
                            {booking.phone && <a href={`tel:${booking.phone}`} className="hover:text-primary-700">{booking.phone}</a>}
                          </div>
                          {booking.notes && (
                            <p className="text-xs text-foreground-600 font-label mt-2">{booking.notes}</p>
                          )}
                          {paid && (
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-label text-foreground-600">
                              <span>Customer paid <strong className="text-foreground-900">${(booking.amountCents / 100).toFixed(2)}</strong></span>
                              <span>Connect767 fee ({booking.platformFeePercent || 10}%) <strong className="text-foreground-900">${((booking.platformFeeAmountCents ?? Math.round(booking.amountCents * 0.1)) / 100).toFixed(2)}</strong></span>
                              <span>Your payout <strong className="text-primary-800">${((booking.ownerPayoutAmountCents ?? Math.floor(booking.amountCents * 0.9)) / 100).toFixed(2)}</strong></span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {booking.status === "confirmed" && booking.meetingUrl && (
                            <a
                              href={booking.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary-600 text-background-50 text-xs font-semibold"
                            >
                              <i className="ri-video-chat-line" /> Join meeting
                            </a>
                          )}
                          {booking.status === "pending" && (!requiresPayment || paid) && (
                            <button
                              type="button"
                              onClick={() => changeBookingStatus(booking, "confirmed")}
                              disabled={bookingBusy === booking.id}
                              className="px-3 py-2 rounded-md bg-primary-500 text-background-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          )}
                          {booking.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => changeBookingStatus(booking, "declined")}
                              disabled={bookingBusy === booking.id}
                              className="px-3 py-2 rounded-md border border-background-300 text-xs font-semibold text-foreground-700 cursor-pointer disabled:opacity-50"
                            >
                              Decline
                            </button>
                          )}
                          {paid && booking.ownerPayoutStatus === "pending" && (
                            <button
                              type="button"
                              onClick={() => cashOutBooking(booking)}
                              disabled={bookingBusy === booking.id}
                              className="inline-flex items-center gap-1.5 rounded-md bg-foreground-950 px-3 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                            >
                              <i className="ri-wallet-3-line" /> Cash out ${(booking.ownerPayoutAmountCents / 100).toFixed(2)}
                            </button>
                          )}
                          {paid && ["requested", "processing", "paid"].includes(booking.ownerPayoutStatus) && (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700">
                              <i className={booking.ownerPayoutStatus === "paid" ? "ri-checkbox-circle-line text-primary-700" : "ri-time-line text-secondary-700"} />
                              {booking.ownerPayoutStatus === "paid" ? "Payout sent" : booking.ownerPayoutStatus === "processing" ? "Payout processing" : "Cash-out requested"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
