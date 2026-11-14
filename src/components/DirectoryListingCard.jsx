import { Link } from "react-router-dom";
import TierBadge from "./ui/TierBadge";
import { imageCropStyle } from "../lib/imagePosition";
import { directoryCategories } from "../data/directory";
import { findIndustry } from "../data/industries";
import { isRentalBookingType, normalizeRentalRateUnit } from "../lib/bookingTypes";
import DefaultListingCover from "./ui/DefaultListingCover";

const getCategoryLabel = (slug) =>
  directoryCategories.find((category) => category.slug === slug)?.label || "";

const mainCategoryLabel = (listing) => {
  const industryParent = findIndustry(listing.industrySlug || listing.categorySlug)?.categorySlug;
  return (
    listing.parentCategoryLabel ||
    getCategoryLabel(listing.parentCategorySlug) ||
    getCategoryLabel(listing.categoryPath) ||
    getCategoryLabel(industryParent) ||
    getCategoryLabel(listing.categorySlug) ||
    "Other"
  );
};

const reviewCount = (listing) =>
  Number(listing.reviewCount ?? String(listing.reviews || "").replace(/\D/g, "")) || 0;

const industryLabel = (listing) => {
  const category = mainCategoryLabel(listing);
  const knownIndustry = findIndustry(listing.industrySlug || listing.categorySlug)?.label;
  const legacyLabel = listing.category?.includes("·")
    ? listing.category.split("·").slice(1).join("·").trim()
    : String(listing.category || "").trim();
  const industry = listing.industryLabel || knownIndustry || legacyLabel;

  return industry && industry.toLocaleLowerCase() !== category.toLocaleLowerCase()
    ? industry
    : "Industry not specified";
};

function BookingSignal({ listing }) {
  if (!listing.bookingEnabled) return null;
  const price = Number(listing.bookingPriceCents) > 0
    ? `$${(Number(listing.bookingPriceCents) / 100).toFixed(0)}`
    : "Free";
  const detail = isRentalBookingType(listing.bookingType)
    ? `${price} / ${normalizeRentalRateUnit(listing.bookingRentalRateUnit, listing.bookingType)}`
    : `${price} · ${listing.bookingDurationMinutes || 30} min`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-[10px] font-semibold text-primary-800 shadow-[0_6px_18px_rgba(31,112,78,0.08)] whitespace-nowrap">
      <i className="ri-calendar-check-line text-xs" />
      Book · {detail}
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

function ListingIdentity({ listing, compact = false, alignGridRows = false }) {
  const category = mainCategoryLabel(listing);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
            <p
              data-testid="listing-category-industry"
              className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700"
              title={category}
            >
              {category}
            </p>
          </div>
          <h3 className={`${compact ? "text-xl" : "text-[1.22rem]"} ${alignGridRows ? "min-h-[3.05rem]" : ""} mt-1.5 flex items-start gap-1.5 font-heading font-semibold leading-tight tracking-[-0.02em] text-foreground-950 transition-colors group-hover:text-primary-700`}>
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
        <span className="rounded-full border border-background-200 bg-background-100 px-2.5 py-1 font-label text-xs font-bold text-foreground-800 whitespace-nowrap" title="Price level">
          {listing.price}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-foreground-600">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <i className="ri-map-pin-2-line text-sm" />
        </span>
        <span className="font-label truncate">{listing.location || "Location available on profile"}</span>
      </div>
    </>
  );
}

function ListingHighlights({ listing }) {
  const experience = listing.yearsExperience
    ? String(listing.yearsExperience)
    : "Not provided";
  return (
    <div data-testid="listing-highlights" className="mt-3 grid min-h-[4.35rem] grid-cols-[0.7fr_1.3fr] items-stretch gap-2">
      <div className="flex min-w-0 flex-col justify-between rounded-xl border border-background-200 bg-background-100/75 px-3 py-2.5">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground-500">Yrs. Exp.</span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground-800 truncate" title={experience}>
          <i className="ri-briefcase-line text-primary-700 flex-shrink-0" />
          {experience}
        </span>
      </div>
      <div className="flex min-w-0 flex-col justify-between rounded-xl border border-background-200 bg-background-100/75 px-3 py-2.5">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground-500">Industry</span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground-800 truncate" title={industryLabel(listing)}>
          <i className="ri-building-line text-primary-700 flex-shrink-0" />
          {industryLabel(listing)}
        </span>
      </div>
    </div>
  );
}

function Cover({ listing, listView = false }) {
  const coverPosition = listing.coverPosition || "center";
  return (
    <div className={`relative flex-shrink-0 overflow-hidden rounded-[1.15rem] ${listView ? "m-2 sm:w-64" : "m-2 mb-0"}`}>
      <div className={`w-full overflow-hidden bg-background-100 ${listView ? "h-52 sm:h-full" : "aspect-[4/3]"}`}>
        {listing.image ? (
          <img
            loading="lazy"
            decoding="async"
            alt={`${listing.title} — ${industryLabel(listing)}`}
            title={`${listing.title} — ${industryLabel(listing)}`}
            className="listing-cover-media h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            src={listing.image}
            style={imageCropStyle(coverPosition, listing.coverZoom, "cover")}
          />
        ) : (
          <DefaultListingCover title={listing.title} compact />
        )}
      </div>
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-foreground-950/40 via-transparent to-foreground-950/5 pointer-events-none" />
      <TierBadge tier={listing.badge} featured={listing.isFeatured} className="absolute left-3 top-3 z-20 shadow-[0_8px_22px_rgba(0,0,0,0.18)]" />
    </div>
  );
}

export default function DirectoryListingCard({
  listing,
  view = "grid",
  matchScore,
  className = "",
}) {
  const description = String(listing.description || "").trim();

  if (view === "list") {
    return (
      <article className={`group relative isolate rounded-[1.5rem] border border-background-200/90 bg-background-50 shadow-[0_10px_34px_rgba(37,30,20,0.07)] transition-all duration-300 before:absolute before:inset-x-6 before:top-0 before:z-20 before:h-[3px] before:rounded-b-full before:bg-gradient-to-r before:from-primary-500 before:via-primary-300 before:to-accent-400 hover:-translate-y-1.5 hover:border-primary-200 hover:shadow-[0_24px_60px_rgba(31,112,78,0.16)] ${className}`}>
        <Link
          to={`/listings/${listing.slug}`}
          className="flex flex-col cursor-pointer sm:flex-row"
        >
          <Cover listing={listing} listView />
          <div className="flex min-w-0 flex-1 flex-col p-5">
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
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-background-200/70 pt-4">
              <div className="flex flex-wrap items-center gap-3"><RatingSignal listing={listing} /><BookingSignal listing={listing} /></div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-700 px-3.5 py-2 text-xs font-semibold text-background-50 shadow-[0_8px_20px_rgba(31,112,78,0.2)] transition-colors group-hover:bg-primary-800 whitespace-nowrap">
                View profile <i className="ri-arrow-right-line" />
              </span>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className={`group relative isolate flex flex-col rounded-[1.5rem] border border-background-200/90 bg-background-50 shadow-[0_10px_34px_rgba(37,30,20,0.07)] transition-all duration-300 before:absolute before:inset-x-6 before:top-0 before:z-20 before:h-[3px] before:rounded-b-full before:bg-gradient-to-r before:from-primary-500 before:via-primary-300 before:to-accent-400 hover:-translate-y-1.5 hover:border-primary-200 hover:shadow-[0_24px_60px_rgba(31,112,78,0.16)] ${className}`}>
      <Link to={`/listings/${listing.slug}`} className="flex h-full flex-col cursor-pointer">
        <Cover listing={listing} />
        <div className="flex min-w-0 flex-1 flex-col p-4 pt-4.5">
          <ListingIdentity listing={listing} alignGridRows />
          <p
            data-testid="listing-description-row"
            className="mt-3 h-9 line-clamp-2 text-xs leading-relaxed text-foreground-600"
          >
            {description || "\u00a0"}
          </p>
          <ListingHighlights listing={listing} />
          <div data-testid="listing-booking-row" className="mt-3 flex min-h-8 items-start">
            {listing.bookingEnabled && <BookingSignal listing={listing} />}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-background-200/70 pt-4">
            <RatingSignal listing={listing} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-700 px-3.5 py-2 text-xs font-semibold text-background-50 shadow-[0_8px_20px_rgba(31,112,78,0.2)] transition-colors group-hover:bg-primary-800 whitespace-nowrap">
              Profile <i className="ri-arrow-right-line" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
