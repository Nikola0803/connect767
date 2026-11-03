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

const sellerCenterPreviewListing = {
  id: "seller-center-preview",
  title: "James Local Fruits",
  slug: "james-local-fruits",
  status: "publish",
  tier: "free",
  category: "Catering, Eat & Drink",
  location: "Roseau, Dominica",
  rating: 5,
  reviewCount: 3,
  viewUrl: "/listings/james-local-fruits",
  payoutConfigured: true,
  storefrontConfigured: true,
  bookingEnabled: false,
};

export default function DashboardPage() {
  const { isAuthenticated, name, email } = useAuth();
  const { data: loadedListings, loading, error, reload } = useAsync(() => getMyListings(), []);
  const {
    data: bookings,
    loading: bookingsLoading,
    error: bookingsError,
    reload: reloadBookings,
  } = useAsync(() => getMyBookings(), []);
  const [searchParams] = useSearchParams();
  const isDesignPreview = import.meta.env.DEV && searchParams.get("designPreview") === "1";
  const listings = isDesignPreview
    ? [{ ...sellerCenterPreviewListing, bookingEnabled: searchParams.get("bookingPreview") === "1" }]
    : loadedListings;
  const showScheduling = Boolean(listings?.some((listing) => listing?.bookingEnabled === true));
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

  if (!isAuthenticated && !isDesignPreview) {
    return <Navigate to="/auth/login" state={{ from: "/dashboard" }} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-100/70 via-background-50 to-background-50 pt-16 md:pt-20">
      <div className="relative w-full overflow-hidden border-b border-secondary-200 bg-gradient-to-br from-secondary-100 via-background-50 to-primary-50 px-4 py-10 md:px-8 md:py-14 lg:px-12">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-secondary-300/25 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/80 px-3 py-1 text-xs font-semibold text-primary-800 shadow-sm">
              <i className="ri-dashboard-line" />
              Seller Center
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em] text-foreground-950 md:text-4xl">Connect767 Seller Center</h1>
            <p className="mt-2 text-sm font-medium text-foreground-700">Welcome back{name || isDesignPreview ? `, ${name || "shop dog"}` : ""}.</p>
            <p className="text-sm text-foreground-600 font-label mt-1">{email || (isDesignPreview ? "seller@connect767.com" : "")}</p>
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
            <h2 className={DASHBOARD_SECTION_HEADING}>
              Your business workspace
            </h2>
            <p className={DASHBOARD_SECTION_SUBTITLE}>Manage your storefront, directory listings, and scheduling from three focused areas.</p>
          </div>

          {!isLiveApi && !isDesignPreview && (
            <div className="mb-6 px-3.5 py-2.5 rounded-lg bg-secondary-100 border border-secondary-200 text-xs text-secondary-900 flex items-start gap-2">
              <i className="ri-flask-line mt-0.5 flex-shrink-0" />
              <span>
                Demo mode — no backend connected, so there's nothing to show here yet. Listings
                you submit only exist for real once{" "}
                <code className="font-mono">VITE_WP_BASE_URL</code> is set.
              </span>
            </div>
          )}

          {loading && !isDesignPreview && <CardSkeleton count={3} className="space-y-3" />}

          {error && !isDesignPreview && <ErrorState message="Couldn't load your listings." onRetry={reload} />}

          {(isDesignPreview || (!loading && !error)) && listings.length > 0 && (
            <VendorProductsPanel
              listings={listings}
              initialListingId={productListingId}
              initialStorefrontListingId={storefrontListingId}
              ownerName={name}
            />
          )}

          <section id="my-listings" className={`${DASHBOARD_PANEL} mt-8 scroll-mt-24 overflow-hidden`}>
            <div className="flex items-start justify-between gap-4 border-b border-secondary-200 bg-gradient-to-r from-secondary-100/80 via-background-50 to-primary-50/70 px-5 py-6 sm:px-7">
              <div>
                <p className={DASHBOARD_EYEBROW}>Directory listings</p>
                <h2 className={DASHBOARD_SECTION_HEADING}>Directory listings overview</h2>
                <p className={DASHBOARD_SECTION_SUBTITLE}>Edit your public directory information or open the published profile.</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-secondary-200 bg-secondary-100 text-xl text-secondary-900 shadow-sm"><i className="ri-profile-line" /></span>
            </div>
            <div className="p-5 sm:p-7">

          {(isDesignPreview || (!loading && !error)) && listings.length === 0 && (
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

          {(isDesignPreview || (!loading && !error)) && listings.length > 0 && (
            <div className="space-y-3">
              {listings.map((item) => {
                const status = statusMeta[item.status] || statusMeta.draft;
                return (
                  <div
                    key={item.id}
                    className={`${DASHBOARD_PANEL} flex flex-col gap-4 border-l-4 border-l-primary-500 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(83,55,35,0.1)] sm:flex-row sm:items-center sm:gap-5 sm:p-5`}
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
                    <div className="grid w-full gap-3 sm:w-auto sm:min-w-[390px] sm:grid-cols-2">
                      <Link
                        to={`/listings/${item.slug}/edit`}
                        className="group flex min-h-24 flex-col justify-between rounded-2xl border border-primary-200 border-t-4 border-t-primary-500 bg-gradient-to-br from-primary-50 to-background-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(31,112,78,0.14)]"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-lg text-primary-800"><i className="ri-file-edit-line" /></span>
                        <span className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-foreground-950">
                          Edit directory
                          <i className="ri-arrow-right-line text-primary-700 transition group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                      {item.viewUrl ? (
                        <Link
                          to={`/listings/${item.slug}`}
                          className="group flex min-h-24 flex-col justify-between rounded-2xl border border-secondary-200 border-t-4 border-t-secondary-400 bg-gradient-to-br from-secondary-50 to-background-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(153,119,72,0.14)]"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary-100 text-lg text-secondary-800"><i className="ri-eye-line" /></span>
                          <span className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-foreground-950">
                            View listing
                            <i className="ri-arrow-right-line text-secondary-700 transition group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      ) : (
                        <span className="flex min-h-24 flex-col justify-between rounded-2xl border border-background-200 border-t-4 border-t-background-300 bg-background-100/70 p-4 text-foreground-500">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background-200 text-lg"><i className="ri-time-line" /></span>
                          <span className="mt-3 text-sm font-semibold">Pending review</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

            </div>
          </section>

          {showScheduling && (
          <div id="bookings-rentals" className="mt-8 scroll-mt-24 rounded-3xl border border-secondary-200 bg-gradient-to-br from-background-50 to-secondary-50/60 p-5 shadow-[0_16px_44px_rgba(83,55,35,0.06)] sm:p-7">
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
              <div className="rounded-2xl border border-dashed border-secondary-300 bg-background-50/70 p-8 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-calendar-event-line text-xl" /></span>
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
          )}
        </div>
      </div>
    </div>
  );
}
