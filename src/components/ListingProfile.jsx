import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StarRating from "./ui/StarRating";
import TierBadge from "./ui/TierBadge";
import { geocodeLocation, staticMapUrl, embedMapUrl, MAPBOX_TOKEN } from "../lib/mapbox";
import { useSavedListings } from "../hooks/useSavedListings";
import { imageCropStyle } from "../lib/imagePosition";
import BookingForm from "./BookingForm";
import ShareMenu from "./ShareMenu";
import { WriteReviewButton } from "./WriteReviewModal";
import DefaultListingCover from "./ui/DefaultListingCover";
import ListingProducts from "./ListingProducts";
import { getBlogPostForListing } from "../data/repository";
import { dedupeListingGallery } from "../lib/listingGallery";

export function listingOwnerMessagePath(data, isPreview = false) {
  if (isPreview || !data?.slug) return "";
  return `/messages?listing=${encodeURIComponent(data.slug)}&title=${encodeURIComponent(data.title || "")}`;
}

export function listingContactActionLinks(contact = {}) {
  const phone = String(contact?.phone || "").trim();
  const phoneTarget = phone.replace(/[^\d+]/g, "");
  const phoneDigits = phoneTarget.replace(/\D/g, "");
  const website = String(contact?.websiteUrl || "").trim();
  const whatsappDigits = String(contact?.whatsapp || "").replace(/\D/g, "");

  return {
    call: phoneDigits.length >= 7 ? `tel:${phoneTarget}` : "",
    website,
    whatsapp: whatsappDigits.length >= 7 ? `https://wa.me/${whatsappDigits}` : "",
  };
}

export function listingLocationMapUrl(location = "") {
  const query = String(location || "").trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "";
}

export function listingEducationDetails(data = {}) {
  const educationLevel = String(
    data.education || data.degreeLevel || data.highestDegreeLevel || ""
  ).trim();
  const degreeType = String(
    data.degreeType || data.degree || data.fieldOfStudy || ""
  ).trim();

  return [
    educationLevel && {
      icon: "ri-graduation-cap-line",
      text: educationLevel,
      title: `Highest Degree Level: ${educationLevel}`,
    },
    degreeType && {
      icon: "ri-book-open-line",
      text: degreeType,
      title: `Degree Type: ${degreeType}`,
    },
  ].filter(Boolean);
}

const BUSINESS_DAY = "(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)";

export function parseBusinessHours(entry) {
  const text = String(entry || "").trim();
  if (!text) return { day: "", time: "" };

  const pipeParts = text.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length > 1) {
    return { day: pipeParts[0], time: pipeParts.slice(1).join(" | ") };
  }

  const dayRange = new RegExp(`^(${BUSINESS_DAY}(?:\\s*[–—-]\\s*${BUSINESS_DAY})?)\\s*:?[\\s]+(.+)$`, "i");
  const match = text.match(dayRange);
  if (match) return { day: match[1], time: match[2] };

  return { day: text, time: "" };
}

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
  const [activeSection, setActiveSection] = useState("overview");
  const [mapCoords, setMapCoords] = useState(null);
  const [hasProducts, setHasProducts] = useState(false);
  const [relatedBlogPost, setRelatedBlogPost] = useState(null);
  const { isSaved, toggleSaved } = useSavedListings();
  const uniqueGallery = dedupeListingGallery(data.gallery);
  const gallery = uniqueGallery.length > 0 ? uniqueGallery : [{ alt: data.title, src: "" }];
  const saved = !isPreview && isSaved(data.slug);
  const messagePath = listingOwnerMessagePath(data, isPreview);
  const contactActions = listingContactActionLinks(data.contact);
  const hasContactActions = Object.values(contactActions).some(Boolean);
  const contactLocation = String(
    data.contact?.address ||
      (typeof data.location === "string"
        ? data.location
        : data.location?.display || data.location?.address || "")
  ).trim();
  const educationDetails = listingEducationDetails(data);
  const contactLocationUrl = listingLocationMapUrl(contactLocation);
  const isClassified = String(data.badge || "").toLowerCase() === "classified";
  const parsedHours = data.hours.map(parseBusinessHours);
  const regularHours = parsedHours.filter(({ day }) => !/^(sat(?:urday)?|sun(?:day)?)\b/i.test(day));
  const weekendHours = parsedHours.filter(({ day }) => /^(sat(?:urday)?|sun(?:day)?)\b/i.test(day));

  const jumpToSection = (section) => {
    setActiveSection(section);
    document.getElementById(`listing-${section}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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

  useEffect(() => {
    let cancelled = false;
    setRelatedBlogPost(null);

    if (!isPreview && isClassified && data.slug) {
      getBlogPostForListing(data)
        .then((post) => {
          if (!cancelled) setRelatedBlogPost(post);
        })
        .catch(() => {
          // A blog lookup should never prevent the directory profile itself
          // from rendering. Profiles simply omit the optional story link.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [data.slug, data.title, isClassified, isPreview]);

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
        <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-8">
          <div id="listing-gallery" className="max-w-5xl scroll-mt-28 lg:col-span-2 lg:col-start-1 lg:row-start-1">
            <section className="relative w-full overflow-hidden rounded-[1.75rem] border border-background-200/80 bg-background-100 shadow-[0_24px_70px_rgba(29,42,35,0.12)]">
            <div className="relative aspect-[5/3] w-full">
              {gallery[activeImage]?.src ? (
                <img
                  alt={gallery[activeImage]?.alt}
                  className={`h-full w-full ${activeImage === 0 ? "listing-profile-cover-media object-cover" : "object-contain bg-background-100"}`}
                  src={gallery[activeImage]?.src}
                  style={
                    activeImage === 0
                      ? imageCropStyle(data.coverPosition, data.coverZoom, "cover")
                      : undefined
                  }
                />
              ) : (
                <DefaultListingCover title={data.title} />
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    aria-label="Previous image"
                    type="button"
                    onClick={() => setActiveImage((i) => (i - 1 + gallery.length) % gallery.length)}
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground-950 shadow-md backdrop-blur transition hover:bg-white"
                  >
                    <i className="ri-arrow-left-s-line text-xl" />
                  </button>
                  <button
                    aria-label="Next image"
                    type="button"
                    onClick={() => setActiveImage((i) => (i + 1) % gallery.length)}
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground-950 shadow-md backdrop-blur transition hover:bg-white"
                  >
                    <i className="ri-arrow-right-s-line text-xl" />
                  </button>
                </>
              )}

            </div>
            </section>

            {gallery.length > 1 && (
              <div className="mt-3 flex w-full gap-2 overflow-x-auto pb-1" aria-label="Listing photo gallery">
                {gallery.map((img, i) => (
                  <button
                    key={img.src || i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                      i === activeImage
                        ? "border-primary-500 ring-2 ring-primary-100"
                        : "border-background-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img alt={`${data.title} thumbnail ${i + 1}`} className="h-full w-full object-cover" src={img.src} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <section className="relative z-10 mt-5 lg:col-span-2 lg:col-start-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2">
                  <TierBadge tier={data.badge} featured={data.isFeatured} />
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  {data.logo && (
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-background-200 bg-white shadow-sm">
                      <img
                        src={data.logo}
                        alt={`${data.title} logo`}
                        className="h-full w-full object-cover"
                        style={imageCropStyle(data.logoPosition, data.logoZoom)}
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="flex min-w-0 items-center gap-2 font-heading text-3xl font-medium leading-tight text-foreground-950 sm:text-4xl">
                      <span className="truncate">{data.title}</span>
                      {data.verified && (
                        <i
                          className="ri-verified-badge-fill shrink-0 text-xl text-primary-600 sm:text-2xl"
                          title="Verified business"
                          aria-label="Verified business"
                          role="img"
                        />
                      )}
                    </h1>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-600">
                      {[
                        (data.parentCategoryLabel || data.categoryLabel) && {
                          icon: "ri-folder-line",
                          text: data.parentCategoryLabel || data.categoryLabel,
                        },
                        data.industryLabel && {
                          icon: "ri-building-line",
                          text: data.industryLabel,
                        },
                        {
                          icon: "ri-time-line",
                          text: `${
                            data.yearsExperience !== "" && data.yearsExperience != null
                              ? data.yearsExperience
                              : "—"
                          } Yrs. Exp.`,
                        },
                        ...educationDetails,
                      ]
                        .filter(Boolean)
                        .map((part) => (
                          <span
                            key={`${part.icon}-${part.text}`}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap"
                            title={part.title || undefined}
                          >
                            <i className={`${part.icon} text-foreground-400`} />
                            {part.text}
                          </span>
                        ))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-center sm:justify-end">
                {isClassified && relatedBlogPost && !isPreview && (
                  <Link
                    to={`/blog/${relatedBlogPost.slug}`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 text-sm font-semibold text-primary-800 transition hover:-translate-y-0.5 hover:bg-primary-100"
                  >
                    <i className="ri-article-line" /> Read Featured Story
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  aria-pressed={saved}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    saved
                      ? "border-accent-300 bg-accent-50 text-accent-700"
                      : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                  }`}
                >
                  <i className={saved ? "ri-heart-fill" : "ri-heart-line"} />
                  {saved ? "Saved" : "Save"}
                </button>
                {!isPreview && <ShareMenu title={data.title} />}
              </div>
            </div>
          </section>

          <nav className="mt-7 flex gap-1 overflow-x-auto border-b border-background-200 lg:col-span-2 lg:col-start-1" aria-label="Profile sections">
            {[
              ["overview", "Overview"],
              ["services", "Services"],
              ["gallery", "Gallery"],
              ["reviews", "Reviews"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => jumpToSection(id)}
                className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-semibold transition ${activeSection === id ? "border-primary-600 text-primary-800" : "border-transparent text-foreground-500 hover:text-foreground-900"}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="grid grid-cols-1 gap-8 lg:contents">
            <div className="lg:col-span-2 lg:col-start-1">
              <div className="relative hidden" aria-hidden="true">
                <div className="w-full h-[320px] md:h-[500px] rounded-2xl overflow-hidden border border-background-200/70 bg-background-100 flex items-center justify-center">
                  {gallery[activeImage]?.src ? (
                    <img
                      alt={gallery[activeImage]?.alt}
                      className={`w-full h-full ${activeImage === 0 ? "listing-profile-cover-media object-cover" : "object-contain"}`}
                      src={gallery[activeImage]?.src}
                      style={
                        activeImage === 0
                          ? imageCropStyle(data.coverPosition, data.coverZoom, "cover")
                          : undefined
                      }
                    />
                  ) : (
                    <DefaultListingCover title={data.title} />
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
                <div className="hidden flex-wrap items-start justify-between gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    {/* Verified is no longer its own pill. A separate
                        "Verified" chip competed with the tier badge and read
                        as a second label; as a mark after the name it says
                        "this business is verified" instead of occupying a slot
                        of its own. */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <TierBadge tier={data.badge} featured={data.isFeatured} />
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
                        (data.parentCategoryLabel || data.categoryLabel) && {
                          icon: "ri-folder-line",
                          text: data.parentCategoryLabel || data.categoryLabel,
                        },
                        data.industryLabel && {
                          icon: "ri-building-line",
                          text: data.industryLabel,
                        },
                        {
                          icon: "ri-time-line",
                          text:
                            data.yearsExperience !== "" && data.yearsExperience != null
                              ? `${data.yearsExperience} ${years === 1 ? "Yr." : "Yrs."} Exp.`
                              : "— Yrs. Exp.",
                          title:
                            data.yearsExperience !== "" && data.yearsExperience != null
                              ? `${data.yearsExperience} ${
                                years === 1 ? "Year" : "Years"
                              } of Experience`
                              : "Years of experience not provided",
                        },
                        ...educationDetails,
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
                    {isClassified && relatedBlogPost && !isPreview && (
                      <Link
                        to={`/blog/${relatedBlogPost.slug}`}
                        className="group inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-800 shadow-[0_8px_24px_rgba(15,107,79,0.10)] transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-primary-100 hover:shadow-[0_12px_28px_rgba(15,107,79,0.16)]"
                        aria-label={`Read the featured story about ${data.title}`}
                      >
                        <i className="ri-article-line text-base" />
                        <span className="hidden sm:inline">Read featured story</span>
                        <span className="sm:hidden">Story</span>
                        <i className="ri-arrow-right-line transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    )}
                    {hasProducts && !isPreview && (
                      <Link
                        to={`/listings/${data.slug}/shop`}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-700"
                      >
                        <i className="ri-store-3-line" />
                        <span className="hidden sm:inline">Shop Products</span>
                        <span className="sm:hidden">Shop</span>
                      </Link>
                    )}
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

                <div className="hidden flex-wrap items-center gap-4 mb-6 text-sm">
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

                <div id="listing-overview" className="scroll-mt-28 rounded-2xl border border-background-200/80 bg-background-50 p-6 shadow-[0_10px_30px_rgba(29,42,35,0.05)] sm:p-8">
                  <h2 className="mb-4 font-heading text-2xl font-medium text-foreground-950">About</h2>
                  <p className="text-foreground-700 leading-relaxed whitespace-pre-line">
                    {data.description}
                  </p>
                  {data.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
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
                  {hasProducts && !isPreview && (
                    <div className="mt-6 border-t border-background-200 pt-5">
                        <Link
                          to={`/listings/${data.slug}/shop`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 text-sm font-semibold text-primary-800 transition hover:-translate-y-0.5 hover:bg-primary-100"
                        >
                          <i className="ri-store-3-line" /> Shop
                        </Link>
                    </div>
                  )}
                </div>

                <div id="listing-services" className="scroll-mt-28">
                {(data.amenities.length > 0 || data.hours.length > 0) && (
                  <div className="mt-5 rounded-2xl border border-background-200/80 bg-background-50 p-6 shadow-[0_10px_30px_rgba(29,42,35,0.05)] sm:p-8">
                    <h3 className="font-heading text-2xl font-medium text-foreground-950 mb-5">
                      Services & amenities
                    </h3>
                    {data.amenities.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    )}

                    {data.hours.length > 0 && (
                      <div className={`${data.amenities.length > 0 ? "mt-6 border-t border-background-200 pt-5" : ""}`}>
                        <h4 className="mb-3 flex items-center gap-2 font-heading text-lg font-medium text-foreground-950">
                          <i className="ri-time-line text-primary-600" />
                          Hours
                        </h4>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                          {regularHours.map(({ day, time }) => (
                            <p key={`${day}-${time}`} className="flex items-baseline justify-between gap-4 text-sm font-label sm:col-span-2">
                              <span className="text-foreground-600">{day}</span>
                              {time && <span className="text-right font-semibold text-foreground-900">{time}</span>}
                            </p>
                          ))}
                          {weekendHours.map(({ day, time }) => (
                            <p key={`${day}-${time}`} className="flex items-baseline justify-between gap-4 text-sm font-label">
                              <span className="text-foreground-600">{day}</span>
                              {time && <span className="text-right font-semibold text-foreground-900">{time}</span>}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>

                <div id="listing-products" className="scroll-mt-28">
                  <ListingProducts
                    slug={data.slug}
                    isPreview={isPreview}
                    listingTitle={data.title}
                    onAvailabilityChange={setHasProducts}
                  />
                </div>

                <section id="listing-reviews" className="scroll-mt-28 mt-5 rounded-2xl border border-background-200/80 bg-background-50 p-6 shadow-[0_10px_30px_rgba(29,42,35,0.05)] sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-heading text-2xl font-light text-foreground-950">
                      Reviews
                      <span className="text-sm font-label text-foreground-500 font-normal ml-2">
                        ({data.reviewCount})
                      </span>
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <i className="ri-star-fill text-accent-500" />
                        <span className="text-lg font-semibold text-foreground-950">
                          {data.rating}
                        </span>
                      </div>
                      {!isPreview && (
                        <WriteReviewButton listingSlug={data.slug} listingTitle={data.title} />
                      )}
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

            <div className="lg:col-start-3 lg:row-start-1 lg:row-span-[6]">
              <div className="sticky top-24 space-y-6">
                <div className="rounded-2xl border border-background-200/70 bg-background-50 p-6">
                  <h3 className="font-heading text-lg font-medium text-foreground-950 mb-5">
                    Contact
                  </h3>
                  {data.contactHidden ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                        <i className="ri-shield-check-line text-lg" />
                      </div>
                      <p className="text-sm font-semibold text-foreground-900 font-label">
                        Contact details are private
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground-600 font-label">
                        Email, phone, website and social links are hidden. Use Message Listing Owner
                        or the secure booking form below.
                      </p>
                    </div>
                  ) : data.contact ? (
                    <>
                      {hasContactActions && (
                        <div className="grid gap-2">
                          {contactActions.call && (
                            <a
                              aria-label={`Call ${data.title}`}
                              className="group flex min-h-16 items-center gap-3 rounded-xl border border-background-200 bg-white px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md"
                              href={contactActions.call}
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm">
                                <i className="ri-phone-line" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground-950 font-label">
                                  Call
                                </span>
                                <span className="block text-xs text-foreground-600 font-label">
                                  Call listing owner
                                </span>
                              </span>
                              <i className="ri-arrow-right-up-line text-foreground-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-700" />
                            </a>
                          )}
                          {contactActions.website && (
                            <a
                              aria-label={`Visit ${data.title} website`}
                              className="group flex min-h-16 items-center gap-3 rounded-xl border border-background-200 bg-white px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md"
                              href={contactActions.website}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm">
                                <i className="ri-global-line" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground-950 font-label">
                                  Website
                                </span>
                                <span className="block text-xs text-foreground-600 font-label">
                                  Visit official website
                                </span>
                              </span>
                              <i className="ri-arrow-right-up-line text-foreground-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-700" />
                            </a>
                          )}
                          {contactActions.whatsapp && (
                            <a
                              aria-label={`Chat with ${data.title} on WhatsApp`}
                              className="group flex min-h-16 items-center gap-3 rounded-xl border border-background-200 bg-white px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md"
                              href={contactActions.whatsapp}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm">
                                <i className="ri-whatsapp-line" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground-950 font-label">
                                  WhatsApp
                                </span>
                                <span className="block text-xs text-foreground-600 font-label">
                                  Start a WhatsApp chat
                                </span>
                              </span>
                              <i className="ri-arrow-right-up-line text-foreground-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-700" />
                            </a>
                          )}
                        </div>
                      )}
                      {(contactLocation || data.contact.instagram || data.contact.facebook || data.contact.youtube || data.contact.twitter) && (
                        <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-xl border border-background-200 bg-primary-50/40 p-3 text-sm text-foreground-700 shadow-sm font-label">
                          {contactLocation && (
                            <a
                              aria-label={`Open ${contactLocation} in maps`}
                              className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl pr-2 transition-colors hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                              href={contactLocationUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm">
                            <svg
                              aria-hidden="true"
                              className="h-6 w-6"
                              viewBox="0 0 32 32"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M16 3.5a8 8 0 0 0-8 8c0 5.8 8 13.1 8 13.1s8-7.3 8-13.1a8 8 0 0 0-8-8Z"
                                fill="currentColor"
                              />
                              <circle cx="16" cy="11.5" r="3.25" fill="#008654" />
                              <ellipse cx="16" cy="27" rx="9.5" ry="2.6" stroke="currentColor" strokeWidth="2.25" />
                            </svg>
                              </div>
                              <span className="min-w-0 truncate">{contactLocation}</span>
                              <i className="ri-arrow-right-up-line shrink-0 text-foreground-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-700" />
                            </a>
                          )}
                          {contactLocation && (data.contact.instagram || data.contact.facebook || data.contact.youtube || data.contact.twitter) && (
                            <span className="h-8 w-px shrink-0 bg-background-300" aria-hidden="true" />
                          )}
                        {data.contact.instagram && (
                          <a
                            aria-label="Instagram"
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md"
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
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md"
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
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md"
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
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md"
                            href={data.contact.twitter}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <i className="ri-twitter-x-line" />
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
                  {messagePath ? (
                    <Link
                      to={messagePath}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-700"
                    >
                      <i className="ri-chat-3-line" />
                      Message Listing Owner
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-label="Message Listing Owner (available after publishing)"
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-background-50 opacity-70"
                    >
                      <i className="ri-chat-3-line" />
                      Message Listing Owner
                    </button>
                  )}
                </div>

                {/* Sits directly under the contact card — someone who has just
                    read how to reach this business is exactly who wants to
                    book it. Hidden in the wizard's Preview step, where there's
                    no saved listing to submit a booking against yet. */}
                {data.bookingEnabled && !isPreview && data.slug && (
                  <BookingForm
                    slug={data.slug}
                    businessName={data.title}
                    bookingType={data.bookingType}
                    priceCents={data.bookingPriceCents}
                    rentalRateUnit={data.bookingRentalRateUnit}
                    rateRules={data.bookingRateRules}
                    durationMinutes={data.bookingDurationMinutes}
                    priceUnit={data.bookingPriceUnit}
                    maxDurationMinutes={data.bookingMaxDurationMinutes}
                  />
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
