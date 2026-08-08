import { Link } from "react-router-dom";
import TierBadge from "./ui/TierBadge";
import { imageCropStyle } from "../lib/imagePosition";

export default function DirectoryListingCard({ listing, view = "grid", matchScore }) {
  if (view === "list") {
    return (
      <Link
        to={`/listings/${listing.slug}`}
        className="group bg-background-50 rounded-2xl border border-background-200/70 overflow-hidden hover:border-primary-300 transition-colors flex flex-col sm:flex-row cursor-pointer"
      >
        <div className="relative sm:w-56 flex-shrink-0">
          <div className="w-full h-52 sm:h-full overflow-hidden">
            <img
              alt={`${listing.title} — ${listing.category}`}
              title={`${listing.title} — ${listing.category}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              src={listing.image}
              style={imageCropStyle(listing.coverPosition, listing.coverZoom)}
            />
          </div>
          <TierBadge tier={listing.badge} className="absolute top-3 left-3" />
          {matchScore === undefined && listing.verified && (
            <span className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-background-50/95 backdrop-blur text-primary-600">
              <i className="ri-verified-badge-fill text-base" />
            </span>
          )}
        </div>
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center justify-between text-xs text-foreground-600 mb-1.5">
            <span className="font-label">{listing.category}</span>
            <span className="font-label font-semibold text-foreground-800">{listing.price}</span>
          </div>
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="font-heading text-lg font-medium text-foreground-950 group-hover:text-primary-700 transition-colors leading-snug flex items-center gap-1.5">
              {listing.title}
              {matchScore !== undefined && listing.verified && (
                <i className="ri-verified-badge-fill text-primary-600 text-sm" title="Verified" />
              )}
            </h3>
            {matchScore !== undefined && (
              <div className="flex-shrink-0 text-right">
                <div className="text-lg font-heading font-semibold text-primary-700 leading-none">
                  {matchScore}%
                </div>
                <div className="text-[10px] text-foreground-500 font-label uppercase tracking-wide">
                  Match
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-foreground-600 mb-3">
            <i className="ri-map-pin-line text-xs" />
            <span className="font-label truncate">{listing.location}</span>
          </div>
          {(listing.education || listing.experienceLevel) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {listing.education && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-label rounded-full bg-secondary-50 text-secondary-800 border border-secondary-200">
                  <i className="ri-graduation-cap-line" />
                  {listing.education}
                </span>
              )}
              {listing.experienceLevel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-label rounded-full bg-secondary-50 text-secondary-800 border border-secondary-200">
                  <i className="ri-briefcase-line" />
                  {listing.experienceLevel}
                </span>
              )}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-background-200/70">
            <div className="flex items-center gap-1">
              <i className="ri-star-fill text-accent-500 text-xs" />
              <span className="text-sm font-semibold text-foreground-950">{listing.rating}</span>
              <span className="text-xs text-foreground-500 font-label">{listing.reviews}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 group-hover:text-primary-800 whitespace-nowrap">
              Profile
              <i className="ri-arrow-right-line" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/listings/${listing.slug}`}
      className="group bg-background-50 rounded-2xl border border-background-200/70 overflow-hidden hover:border-primary-300 transition-colors flex flex-col cursor-pointer"
    >
      <div className="relative">
        <div className="w-full h-52 overflow-hidden">
          <img
            alt={`${listing.title} — ${listing.category}`}
            title={`${listing.title} — ${listing.category}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            src={listing.image}
            style={imageCropStyle(listing.coverPosition, listing.coverZoom)}
          />
        </div>
        <TierBadge tier={listing.badge} className="absolute top-3 left-3" />
        {listing.verified && (
          <span className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-background-50/95 backdrop-blur text-primary-600">
            <i className="ri-verified-badge-fill text-base" />
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between text-xs text-foreground-600 mb-1.5">
          <span className="font-label">{listing.category}</span>
          <span className="font-label font-semibold text-foreground-800">{listing.price}</span>
        </div>
        <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1.5 group-hover:text-primary-700 transition-colors leading-snug">
          {listing.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-foreground-600 mb-3">
          <i className="ri-map-pin-line text-xs" />
          <span className="font-label truncate">{listing.location}</span>
        </div>
        {(listing.education || listing.experienceLevel) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {listing.education && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-label rounded-full bg-secondary-50 text-secondary-800 border border-secondary-200">
                <i className="ri-graduation-cap-line" />
                {listing.education}
              </span>
            )}
            {listing.experienceLevel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-label rounded-full bg-secondary-50 text-secondary-800 border border-secondary-200">
                <i className="ri-briefcase-line" />
                {listing.experienceLevel}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-background-200/70">
          <div className="flex items-center gap-1">
            <i className="ri-star-fill text-accent-500 text-xs" />
            <span className="text-sm font-semibold text-foreground-950">{listing.rating}</span>
            <span className="text-xs text-foreground-500 font-label">{listing.reviews}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 group-hover:text-primary-800 whitespace-nowrap">
            Profile
            <i className="ri-arrow-right-line" />
          </span>
        </div>
      </div>
    </Link>
  );
}
