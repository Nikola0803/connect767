import { Link } from "react-router-dom";
import TierBadge from "./ui/TierBadge";
import { directoryCategories } from "../data/directory";

const getCategoryLabel = (slug) =>
  directoryCategories.find((category) => category.slug === slug)?.label || "";

const reviewCount = (listing) =>
  Number(listing.reviewCount ?? String(listing.reviews || "").replace(/\D/g, "")) || 0;

const industryLabel = (listing) =>
  listing.industryLabel ||
  (listing.category?.includes("·")
    ? listing.category.split("·").slice(1).join("·").trim()
    : listing.category) ||
  getCategoryLabel(listing.categorySlug);

function BookingSignal({ listing }) {
  if (!listing.bookingEnabled) return null;
  const price = Number(listing.bookingPriceCents) > 0
    ? `$${(Number(listing.bookingPriceCents) / 100).toFixed(0)}`
    : "Free";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-800 border border-primary-100 whitespace-nowrap">
      <i className="ri-calendar-check-line text-xs" />
      Book · {price} · {listing.bookingDurationMinutes || 30} min
    </span>
  );
}

function RatingSignal({ listing }) {
  const count = reviewCount(listing);
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-600">
        <i className="ri-sparkling-line text-accent-500" />
        New listing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="ri-star-fill text-accent-500 text-sm" />
      <span className="text-sm font-semibold text-foreground-950">{listing.rating}</span>
      <span className="text-xs text-foreground-500 font-label">
        {count} {count === 1 ? "review" : "reviews"}
      </span>
    </span>
  );
}

function ListingIdentity({ listing, compact = false }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700 truncate">
            {getCategoryLabel(listing.categorySlug) || "Directory profile"}
          </p>
          <h3 className={`${compact ? "text-xl" : "text-lg"} font-heading font-medium text-foreground-950 group-hover:text-primary-700 transition-colors leading-snug flex items-center gap-1.5 mt-1`}>
            <span className="line-clamp-2">{listing.title}</span>
            {listing.verified && (
              <i
                className="ri-verified-badge-fill text-primary-600 text-base flex-shrink-0"
                title="Verified profile"
                aria-label="Verified profile"
                role="img"
              />
            )}
          </h3>
        </div>
        <span className="font-label font-semibold text-foreground-800 text-sm whitespace-nowrap" title="Price level">
          {listing.price}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-foreground-600 mt-2">
        <i className="ri-map-pin-2-line text-sm text-foreground-500" />
        <span className="font-label truncate">{listing.location || "Location available on profile"}</span>
      </div>
    </>
  );
}

function ListingHighlights({ listing }) {
  const experience = listing.yearsExperience
    ? `${listing.yearsExperience} ${Number(listing.yearsExperience) === 1 ? "year" : "years"}`
    : "Not provided";
  return (
    <div className="grid grid-cols-[0.7fr_1.3fr] gap-2 mt-3 rounded-lg border border-background-200/70 bg-background-100/70 px-3 py-2.5">
      <div className="min-w-0 border-r border-background-200 pr-2">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground-500">Yrs Exp.</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground-800 truncate" title={experience}>
          <i className="ri-briefcase-line text-primary-700 flex-shrink-0" />
          {experience}
        </span>
      </div>
      <div className="min-w-0 pl-1">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground-500">Industry</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground-800 truncate" title={industryLabel(listing)}>
          <i className="ri-building-line text-primary-700 flex-shrink-0" />
          {industryLabel(listing)}
        </span>
      </div>
    </div>
  );
}

function Cover({ listing, listView = false }) {
  return (
    <div className={`relative flex-shrink-0 ${listView ? "sm:w-64" : ""}`}>
      <div className={`w-full overflow-hidden bg-background-100 ${listView ? "h-52 sm:h-full" : "h-48"}`}>
        <img
          alt={`${listing.title} — ${industryLabel(listing)}`}
          title={`${listing.title} — ${industryLabel(listing)}`}
          className="w-full h-full object-contain"
          src={listing.image}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-foreground-950/35 via-transparent to-transparent pointer-events-none" />
      <TierBadge tier={listing.badge} className="absolute top-3 left-3" />
      {listing.bookingEnabled && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-background-50/95 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-primary-800 shadow-sm">
          <i className="ri-calendar-check-fill" />
          Bookable
        </span>
      )}
    </div>
  );
}

export default function DirectoryListingCard({ listing, view = "grid", matchScore }) {
  const description = String(listing.description || "").trim();

  if (view === "list") {
    return (
      <Link
        to={`/listings/${listing.slug}`}
        className="group bg-background-50 rounded-2xl border border-background-200/70 overflow-hidden hover:border-primary-300 hover:shadow-sm transition-all flex flex-col sm:flex-row cursor-pointer"
      >
        <Cover listing={listing} listView />
        <div className="p-5 flex flex-col flex-1 min-w-0">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0"><ListingIdentity listing={listing} compact /></div>
            {matchScore !== undefined && (
              <div className="flex-shrink-0 text-right rounded-xl bg-primary-50 border border-primary-100 px-3 py-2">
                <div className="text-lg font-heading font-semibold text-primary-700 leading-none">{matchScore}%</div>
                <div className="text-[9px] text-primary-700 font-label uppercase tracking-wide mt-1">Match</div>
              </div>
            )}
          </div>
          {description && <p className="text-sm text-foreground-600 leading-relaxed mt-3 line-clamp-2 max-w-3xl">{description}</p>}
          <ListingHighlights listing={listing} />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-background-200/70">
            <div className="flex flex-wrap items-center gap-3"><RatingSignal listing={listing} /><BookingSignal listing={listing} /></div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 whitespace-nowrap">
              View profile <i className="ri-arrow-right-line" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/listings/${listing.slug}`}
      className="group bg-background-50 rounded-2xl border border-background-200/70 overflow-hidden hover:border-primary-300 hover:shadow-sm transition-all flex flex-col cursor-pointer"
    >
      <Cover listing={listing} />
      <div className="p-4 flex flex-col flex-1 min-w-0">
        <ListingIdentity listing={listing} />
        {description && <p className="text-xs text-foreground-600 leading-relaxed mt-3 line-clamp-2">{description}</p>}
        <ListingHighlights listing={listing} />
        {listing.bookingEnabled && <div className="mt-3"><BookingSignal listing={listing} /></div>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-background-200/70">
          <RatingSignal listing={listing} />
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 whitespace-nowrap">
            Profile <i className="ri-arrow-right-line" />
          </span>
        </div>
      </div>
    </Link>
  );
}
