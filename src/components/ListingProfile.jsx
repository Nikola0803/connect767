import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StarRating from "./ui/StarRating";
import TierBadge from "./ui/TierBadge";
import { geocodeLocation, staticMapUrl, embedMapUrl, MAPBOX_TOKEN } from "../lib/mapbox";
import { useSavedListings } from "../hooks/useSavedListings";
import { imageCropStyle } from "../lib/imagePosition";
import BookingForm from "./BookingForm";
import ShareMenu from "./ShareMenu";

/**
 * The actual listing profile presentation — used by both
 * ListingDetailPage.jsx (real, fetched data) and AddListingPage.jsx's
 * Preview step (in-progress form data). Same component, same markup, same
 * classes: whatever a business owner sees in the wizard's Preview step is
 * pixel-for-pixel what their real profile will look like, not a
 * simplified mockup — because it's the same code rendering both.
 *
 * `isPreview` only affects the breadcrumb (a listing being drafted has no
 * real category route to link to yet) — everything else renders
 * identically either way.
 */
export default function ListingProfile({ data, isPreview = false }) {
  const [activeImage, setActiveImage] = useState(0);
  const [mapCoords, setMapCoords] = useState(null);
  const { isSaved, toggleSaved } = useSavedListings();
  const gallery = data.gallery.length > 0 ? data.gallery : [{ alt: data.title, src: "" }];
  const saved = !isPreview && isSaved(data.slug);

  const handleSave = () => {
    if (isPreview) return;
    toggleSaved({
      slug: data.slug,
      title: data.title,
      category: data.category,
      image: gallery[0]?.src || "",
    });
  };

  // Listings only ever store a free-text location string, not real
  // coordinates — geocode it client-side (via mapbox.js) so the map card
  // has something to show even though data.mapEmbedUrl is never set
  // anywhere in the app today.
  useEffect(() => {
    let cancelled = false;
    setMapCoords(null);
    if (data.location && MAPBOX_TOKEN) {
      geocodeLocation(data.location).then((coords) => {
        if (!cancelled) setMapCoords(coords);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [data.location]);

  return (
    <div>
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 border-b border-background-200/70 bg-background-50">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-label text-foreground-500">
          {isPreview ? (
            <span>Home</span>
          ) : (
            <Link className="hover:text-foreground-800 cursor-pointer" to="/">
              Home
            </Link>
          )}
          <i className="ri-arrow-right-s-line text-xs" />
          {isPreview ? (
            <span>Directory</span>
          ) : (
            <Link className="hover:text-foreground-800 cursor-pointer" to="/listings">
              Directory
            </Link>
          )}
          {data.categoryLabel && (
            <>
              <i className="ri-arrow-right-s-line text-xs" />
              {isPreview ? (
                <span>{data.categoryLabel}</span>
              ) : (
                <Link
                  className="hover:text-foreground-800 cursor-pointer"
                  to={`/listings?category=${data.categoryPath}`}
                >
                  {data.categoryLabel}
                </Link>
              )}
            </>
          )}
          <i className="ri-arrow-right-s-line text-xs" />
          <span className="text-foreground-800 font-medium truncate">{data.title}</span>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="relative">
                <div className="w-full h-[320px] md:h-[500px] rounded-2xl overflow-hidden border border-background-200/70 bg-background-100 flex items-center justify-center">
                  {gallery[activeImage]?.src ? (
                    <img
                      alt={gallery[activeImage]?.alt}
                      className="w-full h-full object-cover"
                      src={gallery[activeImage]?.src}
                      style={
                        activeImage === 0
                          ? imageCropStyle(data.coverPosition, data.coverZoom)
                          : { objectPosition: "center top" }
                      }
                    />
                  ) : (
                    <i className="ri-image-line text-4xl text-foreground-300" />
                  )}
                </div>
                {gallery.length > 1 && (
                  <>
                    <button
                      aria-label="Previous image"
                      type="button"
                      onClick={() =>
                        setActiveImage((i) => (i - 1 + gallery.length) % gallery.length)
                      }
                      className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-background-50/90 backdrop-blur text-foreground-950 hover:bg-background-50 shadow-sm cursor-pointer transition-all"
                    >
                      <i className="ri-arrow-left-s-line text-xl" />
                    </button>
                    <button
                      aria-label="Next image"
                      type="button"
                      onClick={() => setActiveImage((i) => (i + 1) % gallery.length)}
                      className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-background-50/90 backdrop-blur text-foreground-950 hover:bg-background-50 shadow-sm cursor-pointer transition-all"
                    >
                      <i className="ri-arrow-right-s-line text-xl" />
                    </button>
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {gallery.map((img, i) => (
                        <button
                          key={img.src || i}
                          type="button"
                          onClick={() => setActiveImage(i)}
                          className={`shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            i === activeImage
                              ? "border-primary-500 ring-1 ring-primary-300"
                              : "border-background-200/70 hover:border-background-400 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            alt={`${data.title} thumbnail ${i + 1}`}
                            className="w-full h-full object-cover"
                            src={img.src}
                          />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    {/* Verified is no longer its own pill. A separate
                        "Verified" chip competed with the tier badge and read
                        as a second label; as a mark after the name it says
                        "this business is verified" instead of occupying a slot
                        of its own. */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <TierBadge tier={data.badge} />
                    </div>
                    <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 leading-tight flex items-center gap-3">
                      {data.logo && (
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-background-200/70 flex-shrink-0">
                          <img
                            src={data.logo}
                            alt={`${data.title} logo`}
                            className="w-full h-full object-cover"
                            style={imageCropStyle(data.logoPosition, data.logoZoom)}
                          />
                        </div>
                      )}
                      <span className="inline-flex items-center gap-2">
                        {data.title}
                        {data.verified && (
                          <i
                            className="ri-verified-badge-fill text-primary-600 text-2xl flex-shrink-0"
                            title="Verified business"
                            aria-label="Verified business"
                            role="img"
                          />
                        )}
                      </span>
                    </h1>
                    {/* Category and credentials on ONE line, each with its own
                        icon. Built from a filtered array rather than nested
                        conditionals: the separators are inserted BETWEEN real
                        entries, so an empty field can't leave a dangling "·"
                        the way "Master's Degree·Engineering Management·" did. */}
                    {(() => {
                      const years = Number(data.yearsExperience);
                      const parts = [
                        data.category && { icon: "ri-briefcase-4-line", text: data.category },
                        // Graduation cap = the qualification itself (Master's,
                        // Bachelor's). Book = what it's in (Engineering
                        // Management, Nursing).
                        data.education && {
                          icon: "ri-graduation-cap-line",
                          text: data.education,
                        },
                        data.degreeType && { icon: "ri-book-open-line", text: data.degreeType },
                        (data.yearsExperience || data.experienceLevel) && {
                          icon: "ri-time-line",
                          // Abbreviated: "12 Years of Experience" spelled out
                          // was long enough to wrap this line onto a second
                          // row on most screens once a degree and field of
                          // study were also present. Full wording is kept in
                          // the title attribute for anyone who hovers.
                          text: data.yearsExperience
                            ? `${data.yearsExperience} ${years === 1 ? "Yr" : "Yrs"} Exp.`
                            : data.experienceLevel,
                          title: data.yearsExperience
                            ? `${data.yearsExperience} ${
                                years === 1 ? "Year" : "Years"
                              } of Experience`
                            : data.experienceLevel,
                        },
                      ].filter(Boolean);

                      if (!parts.length) return null;

                      return (
                        // No dot separators: every entry now carries its own
                        // icon, which already marks where one ends and the
                        // next begins. Dots on top of that were doing the same
                        // job twice and cluttering the line. Wider gaps do the
                        // separating instead.
                        <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-foreground-600 font-label mt-2">
                          {parts.map((part) => (
                            <span
                              key={part.text}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap"
                              title={part.title || undefined}
                            >
                              {part.icon && <i className={`${part.icon} text-foreground-400`} />}
                              {part.text}
                            </span>
                          ))}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      aria-pressed={saved}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer whitespace-nowrap transition-colors ${
                        saved
                          ? "border-accent-300 bg-accent-50 text-accent-700"
                          : "border-background-300 text-foreground-700 hover:bg-background-100"
                      }`}
                    >
                      <i className={saved ? "ri-heart-fill" : "ri-heart-line"} />
                      <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
                    </button>
                    {!isPreview && <ShareMenu title={data.title} />}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={data.rating} size="text-sm" />
                    <span className="font-semibold text-foreground-950">{data.rating}</span>
                    <span className="text-foreground-500 font-label">
                      ({data.reviewCount} reviews)
                    </span>
                  </div>
                  <span className="text-foreground-300">|</span>
                  <div className="flex items-center gap-1.5 text-foreground-700 font-label">
                    <i className="ri-map-pin-line" />
                    <span>{data.location}</span>
                  </div>
                  <span className="text-foreground-300">|</span>
                  <span className="font-label font-semibold text-foreground-800">
                    {data.price}
                  </span>
                </div>

                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground-700 leading-relaxed whitespace-pre-line">
                    {data.description}
                  </p>
                </div>

                {data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-5">
                    {data.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-[11px] font-label rounded-full bg-secondary-50 text-secondary-800 border border-secondary-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {data.amenities.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-background-200/70">
                    <h3 className="font-heading text-lg font-medium text-foreground-950 mb-4">
                      Amenities
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {data.amenities.map((a) => (
                        <div
                          key={a}
                          className="flex items-center gap-2 text-sm text-foreground-700 font-label"
                        >
                          <i className="ri-check-line text-primary-600 text-sm" />
                          {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.hours.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-background-200/70">
                    <h3 className="font-heading text-lg font-medium text-foreground-950 mb-4">
                      Hours
                    </h3>
                    <div className="space-y-1">
                      {data.hours.map((h) => (
                        <p key={h} className="text-sm text-foreground-700 font-label">
                          {h}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <section className="mt-10 pt-10 border-t border-background-200/70">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-heading text-2xl font-light text-foreground-950">
                      Reviews
                      <span className="text-sm font-label text-foreground-500 font-normal ml-2">
                        ({data.reviewCount})
                      </span>
                    </h2>
                    <div className="flex items-center gap-1">
                      <i className="ri-star-fill text-accent-500" />
                      <span className="text-lg font-semibold text-foreground-950">
                        {data.rating}
                      </span>
                    </div>
                  </div>

                  {data.reviews.length > 0 ? (
                    <>
                      <div className="space-y-5">
                        {data.reviews.map((r) => (
                          <div
                            key={r.name}
                            className="pb-5 border-b border-background-100 last:border-b-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                                {r.initial}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground-950 font-label">
                                  {r.name}
                                </p>
                                <p className="text-xs text-foreground-500 font-label">{r.time}</p>
                              </div>
                              <div className="ml-auto flex items-center gap-0.5">
                                <StarRating rating={r.stars} size="text-xs" />
                              </div>
                            </div>
                            <p className="text-sm text-foreground-700 leading-relaxed">{r.text}</p>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
                      >
                        Read all {data.reviewCount} reviews
                        <i className="text-xs ri-arrow-down-s-line" />
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-foreground-500 font-label">
                      No reviews yet — be the first to share your experience.
                    </p>
                  )}
                </section>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <div className="rounded-2xl border border-background-200/70 bg-background-50 p-6">
                  <h3 className="font-heading text-lg font-medium text-foreground-950 mb-5">
                    Contact
                  </h3>
                  {data.contact ? (
                    <>
                      {data.contact.phone && (
                        <a
                          className="flex items-center gap-3 py-3 border-b border-background-100 text-sm text-foreground-700 hover:text-primary-700 font-label cursor-pointer transition-colors"
                          href={`tel:${data.contact.phone.replace(/\s/g, "")}`}
                        >
                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-50 text-primary-600 shrink-0">
                            <i className="ri-phone-line" />
                          </div>
                          <span>{data.contact.phone}</span>
                        </a>
                      )}
                      {data.contact.email && (
                        <a
                          className="flex items-center gap-3 py-3 border-b border-background-100 text-sm text-foreground-700 hover:text-primary-700 font-label cursor-pointer transition-colors"
                          href={`mailto:${data.contact.email}`}
                        >
                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary-50 text-secondary-700 shrink-0">
                            <i className="ri-mail-line" />
                          </div>
                          <span className="truncate">{data.contact.email}</span>
                        </a>
                      )}
                      {data.contact.websiteUrl && (
                        <a
                          className="flex items-center gap-3 py-3 border-b border-background-100 text-sm text-foreground-700 hover:text-primary-700 font-label cursor-pointer transition-colors"
                          href={data.contact.websiteUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent-50 text-accent-600 shrink-0">
                            <i className="ri-global-line" />
                          </div>
                          <span className="truncate">{data.contact.website}</span>
                        </a>
                      )}
                      {data.contact.address && (
                        <div className="flex items-center gap-3 py-3 border-b border-background-100 text-sm text-foreground-700 font-label">
                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-200 text-foreground-600 shrink-0">
                            <i className="ri-map-pin-line" />
                          </div>
                          <span>{data.contact.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-4">
                        {data.contact.instagram && (
                          <a
                            aria-label="Instagram"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-background-100 hover:bg-accent-100 text-foreground-600 hover:text-accent-700 cursor-pointer transition-colors"
                            href={data.contact.instagram}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <i className="ri-instagram-line" />
                          </a>
                        )}
                        {data.contact.facebook && (
                          <a
                            aria-label="Facebook"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-background-100 hover:bg-accent-100 text-foreground-600 hover:text-accent-700 cursor-pointer transition-colors"
                            href={data.contact.facebook}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <i className="ri-facebook-line" />
                          </a>
                        )}
                        {data.contact.youtube && (
                          <a
                            aria-label="YouTube"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-background-100 hover:bg-accent-100 text-foreground-600 hover:text-accent-700 cursor-pointer transition-colors"
                            href={data.contact.youtube}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <i className="ri-youtube-line" />
                          </a>
                        )}
                        {data.contact.twitter && (
                          <a
                            aria-label="Twitter / X"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-background-100 hover:bg-accent-100 text-foreground-600 hover:text-accent-700 cursor-pointer transition-colors"
                            href={data.contact.twitter}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <i className="ri-twitter-x-line" />
                          </a>
                        )}
                        {data.contact.whatsapp && (
                          <a
                            aria-label="WhatsApp"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-background-100 hover:bg-accent-100 text-foreground-600 hover:text-accent-700 cursor-pointer transition-colors"
                            href={`https://wa.me/${data.contact.whatsapp.replace(/[^\d]/g, "")}`}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <i className="ri-whatsapp-line" />
                          </a>
                        )}
                      </div>
                      {(data.contact.phone || data.contact.email || data.contact.websiteUrl) && (
                        <div className="mt-5 flex flex-col gap-2">
                          {data.contact.phone && (
                            <a
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer whitespace-nowrap transition-colors"
                              href={`tel:${data.contact.phone.replace(/\s/g, "")}`}
                            >
                              <i className="ri-phone-line" />
                              Call Now
                            </a>
                          )}
                          {data.contact.email && (
                            <a
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg border border-background-300 bg-background-50 text-foreground-800 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
                              href={`mailto:${data.contact.email}`}
                            >
                              <i className="ri-mail-send-line" />
                              Send Message
                            </a>
                          )}
                          {!data.contact.phone && !data.contact.email && data.contact.websiteUrl && (
                            <a
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer whitespace-nowrap transition-colors"
                              href={data.contact.websiteUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <i className="ri-global-line" />
                              Visit Website
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-foreground-500 font-label">
                      Contact details haven't been added by this business yet.
                    </p>
                  )}
                </div>

                {/* Sits directly under the contact card — someone who has just
                    read how to reach this business is exactly who wants to
                    book it. Hidden in the wizard's Preview step, where there's
                    no saved listing to submit a booking against yet. */}
                {data.bookingEnabled && !isPreview && data.slug && (
                  <BookingForm slug={data.slug} businessName={data.title} />
                )}

                {/* Falls back to a keyless embed built from the location text
                    when Mapbox can't resolve it — production has no Mapbox
                    token (gitignored .env), which is why this panel was blank
                    on the live site but fine locally. Now a listing with a
                    location always shows a map. */}
                {(data.mapEmbedUrl || mapCoords || data.location) && (
                  <div className="rounded-2xl border border-background-200/70 overflow-hidden">
                    {data.mapEmbedUrl || !mapCoords ? (
                      <div className="h-56 w-full">
                        <iframe
                          allowFullScreen
                          className="w-full h-full"
                          height="100%"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={data.mapEmbedUrl || embedMapUrl(data.location)}
                          style={{ border: 0 }}
                          title={`${data.title} location`}
                          width="100%"
                        />
                      </div>
                    ) : (
                      <a
                        className="block h-56 w-full cursor-pointer"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          data.location
                        )}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <img
                          alt={`Map showing ${data.location}`}
                          className="w-full h-full object-cover"
                          src={staticMapUrl(mapCoords)}
                        />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
