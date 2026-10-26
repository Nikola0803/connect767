import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { categoryTaxonomy, findIndustry } from "../data/industries";
import { EDUCATION_CHOICES } from "../data/profileChoices";
import {
  submitListing,
  updateListing,
  getListingBySlug,
  getBookingSettings,
  getCheckoutConfig,
  createListingPaymentIntent,
  confirmListingPayment,
  createListingPaypalOrder,
  captureListingPaypalOrder,
} from "../data/repository";
import { getStripe } from "../lib/stripeClient";
import Button from "../components/ui/Button";
import ListingTierCards from "../components/ListingTierCards";
import DemoModeNotice from "../components/DemoModeNotice";
import ListingProfile from "../components/ListingProfile";
import PaypalButton from "../components/PaypalButton";
import { FormField, Input, Select, Textarea } from "../components/ui/FormField";
import PositionPicker from "../components/ui/PositionPicker";
import PayoutSettingsFields from "../components/PayoutSettingsFields";
import { hasCompletePayoutDetails } from "../lib/payoutSettings";
import { Spinner, ErrorState } from "../components/ui/States";
import { isLiveApi } from "../lib/config";
import { imageCropStyle } from "../lib/imagePosition";
import {
  coverPhotoDimensionError,
  coverPhotoFileError,
  readImageDimensions,
} from "../lib/imageUpload";
import {
  bookingRateUnit,
  bookingRateLabel,
  bookingTypeOptions,
  isRentalBookingType,
  normalizeBookingType,
} from "../lib/bookingTypes";

const steps = [
  { n: 1, label: "Choose Tier" },
  { n: 2, label: "Business Info" },
  { n: 3, label: "Contact & Media" },
  { n: 4, label: "Review" },
  { n: 5, label: "Preview" },
];

const priceChoices = ["$", "$$", "$$$"];

const initialForm = {
  tier: "classified",
  businessName: "",
  category: "",
  priceTier: "",
  description: "",
  tags: "",
  location: "",
  education: "",
  degreeType: "",
  experienceLevel: "",
  yearsExperience: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  youtube: "",
  twitter: "",
  whatsapp: "",
  logoFile: null,
  logoPreview: "",
  logoPosition: "center",
  logoZoom: 1,
  photoFile: null,
  photoPreview: "",
  coverPosition: "center",
  coverZoom: 1,
  coverFit: "contain",
  galleryFiles: [],
  galleryPreviews: [],
  bookingEnabled: false,
  bookingType: "appointment",
  bookingPrice: "0",
  bookingDurationMinutes: "30",
  bookingMeetingUrl: "",
  bookingPayoutMethod: "",
  bookingPayoutAccountName: "",
  bookingPayoutBankName: "",
  bookingPayoutBankCountry: "Dominica",
  bookingPayoutAccountNumber: "",
  bookingPayoutRoutingNumber: "",
  bookingPayoutSwiftCode: "",
  bookingPayoutDigitalProvider: "",
  bookingPayoutDigitalAccount: "",
  amenities: "",
};

/**
 * Maps the wizard's in-progress form state into the exact same data shape
 * ListingDetailPage.jsx builds for a real, saved listing — so
 * <ListingProfile> renders identically for both. New listings obviously
 * have no reviews/verification/rating yet, so those are zeroed out rather
 * than faked.
 */
function buildPreviewData(form) {
  const industry = findIndustry(form.category);
  const hasContactInfo = Boolean(
    form.phone ||
      form.email ||
      form.website ||
      form.instagram ||
      form.facebook ||
      form.youtube ||
      form.twitter ||
      form.whatsapp
  );

  return {
    title: form.businessName || "Your business name",
    category: industry
      ? `${industry.label}${form.priceTier ? ` · ${form.priceTier}` : ""}`
      : "Industry",
    categoryPath: industry?.categorySlug || "",
    parentCategorySlug: industry?.categorySlug || "",
    categoryLabel: industry?.categoryLabel || "",
    badge: form.tier === "classified" ? "Classified" : "Free",
    verified: false,
    rating: "0",
    reviewCount: "0",
    location: form.location || "Location not set",
    price: form.priceTier || "",
    education: form.education || "",
    degreeType: form.degreeType || "",
    experienceLevel: form.experienceLevel || "",
    yearsExperience: form.yearsExperience || "",
    description:
      form.description || "No description added yet — this is where your story goes.",
    tags: form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    amenities: form.amenities
      ? form.amenities.split(",").map((a) => a.trim()).filter(Boolean)
      : [],
    hours: [],
    gallery: form.photoPreview
      ? [
          { alt: form.businessName || "Cover photo", src: form.photoPreview },
          ...form.galleryPreviews.map((src, i) => ({
            alt: `${form.businessName || "Gallery"} ${i + 1}`,
            src,
          })),
        ]
      : form.galleryPreviews.map((src, i) => ({
          alt: `${form.businessName || "Gallery"} ${i + 1}`,
          src,
        })),
    reviews: [],
    contact: hasContactInfo
      ? {
          phone: form.phone || "",
          email: form.email || "",
          website: form.website || "",
          websiteUrl: form.website
            ? form.website.startsWith("http")
              ? form.website
              : `https://${form.website}`
            : "",
          address: form.location || "",
          instagram: form.instagram || "",
          facebook: form.facebook || "",
          youtube: form.youtube || "",
          twitter: form.twitter || "",
          whatsapp: form.whatsapp || "",
        }
      : null,
    mapEmbedUrl: null,
    logo: form.logoPreview || "",
    logoPosition: form.logoPosition || "center",
    logoZoom: form.logoZoom || 1,
    coverPosition: form.coverPosition || "center",
    coverZoom: form.coverZoom || 1,
    coverFit: form.coverFit || "contain",
    bookingEnabled: form.bookingEnabled,
    bookingType: form.bookingType,
    bookingPriceCents: Math.max(0, Math.round((Number(form.bookingPrice) || 0) * 100)),
    bookingDurationMinutes: Number(form.bookingDurationMinutes) || 30,
  };
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.n} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              step.n === current
                ? "bg-primary-500 text-background-50"
                : step.n < current
                ? "bg-primary-100 text-primary-800"
                : "bg-background-100 text-foreground-500"
            }`}
          >
            <span
              className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                step.n === current
                  ? "bg-background-50/20"
                  : step.n < current
                  ? "bg-primary-200"
                  : "bg-background-200"
              }`}
            >
              {step.n < current ? <i className="ri-check-line" /> : step.n}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {i < steps.length - 1 && <div className="w-6 h-px bg-background-300" />}
        </div>
      ))}
    </div>
  );
}

export default function AddListingPage() {
  const { slug: editSlug } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(editSlug);
  const requestedTier = searchParams.get("tier");

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    ...initialForm,
    tier:
      requestedTier === "free" || requestedTier === "classified"
        ? requestedTier
        : initialForm.tier,
  }));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [coverPhotoError, setCoverPhotoError] = useState("");
  const [listingId, setListingId] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [loadError, setLoadError] = useState(null);
  // Set once a Classified submission successfully creates the (unpaid)
  // listing post — switches the page over to the payment step below
  // instead of the plain "submitted" thank-you screen. A Free submission
  // never sets this and goes straight to `submitted`.
  const [pendingPayment, setPendingPayment] = useState(null); // { listingId } | null
  const [justPaid, setJustPaid] = useState(false);

  // Edit mode reuses this same wizard, just pre-filled from the existing
  // listing (getListingBySlug returns the same display shape ListingProfile
  // uses, which has enough — categorySlug, contact.*, education/experience,
  // gallery, etc. — to map back into the wizard's flat form state).
  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    getListingBySlug(editSlug)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setLoadError("Couldn't find this listing.");
          return;
        }
        setListingId(data.id);
        setForm((f) => ({
          ...f,
          tier: data.badge === "Classified" ? "classified" : "free",
          businessName: data.title || "",
          category: data.categorySlug || "",
          priceTier: data.price || "",
          description: data.description || "",
          tags: (data.tags || []).join(", "),
          amenities: (data.amenities || []).join(", "),
          location: data.location || "",
          education: data.education || "",
          degreeType: data.degreeType || "",
          experienceLevel: data.experienceLevel || "",
          yearsExperience: data.yearsExperience || "",
          phone: data.contact?.phone || "",
          email: data.contact?.email || "",
          website: data.contact?.website || "",
          instagram: data.contact?.instagram || "",
          facebook: data.contact?.facebook || "",
          youtube: data.contact?.youtube || "",
          twitter: data.contact?.twitter || "",
          whatsapp: data.contact?.whatsapp || "",
          logoPreview: data.logo || "",
          logoPosition: data.logoPosition || "center",
          logoZoom: data.logoZoom || 1,
          // Read the real cover field. This used to take gallery[0], which is
          // the cover only by luck — so editing a listing showed an empty
          // cover slot and the owner had to re-upload it every single time,
          // while the logo (which does have its own field) survived fine.
          bookingEnabled: Boolean(data.bookingEnabled),
          bookingType: normalizeBookingType(data.bookingType),
          bookingPrice: ((data.bookingPriceCents || 0) / 100).toFixed(2),
          bookingDurationMinutes: String(data.bookingDurationMinutes || 30),
          photoPreview: data.coverPhoto || "",
          coverPosition: data.coverPosition || "center",
          coverZoom: data.coverZoom || 1,
          // Existing listings that predate coverFit should show the complete
          // image in the editor and live profile instead of silently cropping.
          coverFit: data.coverFit || "contain",
          // gallery[0] is the cover once mapListingDetail prepends it, so the
          // gallery previews start after it.
          galleryPreviews: (data.gallery || [])
            .filter((g) => g.src && g.src !== data.coverPhoto)
            .map((g) => g.src),
        }));
        getBookingSettings(data.id)
          .then((settings) => {
            if (cancelled) return;
            setForm((f) => ({
              ...f,
              bookingEnabled: Boolean(settings.bookingEnabled),
              bookingType: normalizeBookingType(settings.bookingType),
              bookingPrice: ((settings.bookingPriceCents || 0) / 100).toFixed(2),
              bookingDurationMinutes: String(settings.bookingDurationMinutes || 30),
              bookingMeetingUrl: settings.bookingMeetingUrl || "",
              bookingPayoutMethod: settings.bookingPayoutMethod || "",
              bookingPayoutAccountName: settings.bookingPayoutAccountName || "",
              bookingPayoutBankName: settings.bookingPayoutBankName || "",
              bookingPayoutBankCountry: settings.bookingPayoutBankCountry || "Dominica",
              bookingPayoutAccountNumber: settings.bookingPayoutAccountNumber || "",
              bookingPayoutRoutingNumber: settings.bookingPayoutRoutingNumber || "",
              bookingPayoutSwiftCode: settings.bookingPayoutSwiftCode || "",
              bookingPayoutDigitalProvider: settings.bookingPayoutDigitalProvider || "",
              bookingPayoutDigitalAccount: settings.bookingPayoutDigitalAccount || "",
            }));
          })
          .catch(() => {
            // Public listing data still contains enabled/price/duration;
            // only the private meeting URL is unavailable if this fails.
          });
        // Tier is fixed once a listing exists — start straight on Business Info.
        setStep(2);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load this listing.");
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing, editSlug]);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!form.location.trim()) {
      setStep(2);
      setSubmitError("Location is required. Add a city, region, or country before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateListing(listingId, form);
        setSubmitted(true);
        return;
      }
      const result = await submitListing(form);
      if (form.tier === "classified" && result?.id) {
        setPendingPayment({ listingId: result.id });
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setSubmitError(err.message || "Something went wrong submitting your listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const canContinue = () => {
    // Description is required — it's the part of a listing that actually
    // sells the business, and an empty one makes the profile look abandoned.
    // Degree level and degree type are optional: plenty of trades and shops
    // have no academic qualification to give, and demanding one would either
    // block them or invite junk data.
    if (step === 2)
      return (
        form.businessName.trim() &&
        form.category &&
        form.priceTier &&
        form.description.trim() &&
        form.yearsExperience &&
        form.location.trim()
      );
    if (step === 3)
      return form.email.trim() && !coverPhotoError && hasCompletePayoutDetails(form);
    return true;
  };

  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goBack = () => setStep((s) => Math.max(isEditing ? 2 : 1, s - 1));

  if (isEditing && loadingExisting) {
    return <Spinner className="pt-16 md:pt-20 min-h-[60vh]" />;
  }

  if (isEditing && loadError) {
    return (
      <div className="pt-16 md:pt-20">
        <ErrorState message={loadError} />
      </div>
    );
  }

  if (pendingPayment) {
    return (
      <ClassifiedPaymentStep
        listingId={pendingPayment.listingId}
        businessName={form.businessName}
        onDone={(paid) => {
          setJustPaid(paid);
          setPendingPayment(null);
          setSubmitted(true);
        }}
      />
    );
  }

  if (submitted) {
    return (
      <div className="pt-16 md:pt-20">
        <div className="w-full px-4 md:px-8 lg:px-12 py-24">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-6">
              <i className="ri-check-line text-3xl" />
            </div>
            <h1 className="font-heading text-3xl font-light text-foreground-950 mb-3">
              {isEditing ? "Changes saved" : "Listing submitted"}
            </h1>
            <p className="text-sm text-foreground-600 font-label mb-8">
              {isEditing ? (
                <>
                  <span className="font-semibold">{form.businessName}</span> has been updated.
                  Changes will show up on your live profile shortly.
                </>
              ) : (
                <>
                  Thanks for adding <span className="font-semibold">{form.businessName}</span> to
                  Connect767.{" "}
                  {form.tier === "classified"
                    ? justPaid
                      ? "Payment received — your Classified listing is in review and will be live shortly."
                      : "We'll follow up about Classified billing and get your profile live shortly."
                    : "Your free listing will be live within 24 hours."}
                </>
              )}
            </p>
            <Button to="/listings" icon="ri-arrow-right-line">
              Browse the directory
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-20">
      {coverPhotoError && step === 3 && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-20 right-4 md:right-8 z-50 flex w-[min(26rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-red-200 bg-background-50 p-4 text-sm text-red-700 shadow-xl"
        >
          <i className="ri-error-warning-line mt-0.5 text-lg flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-800">Cover photo needs attention</p>
            <p className="mt-1 leading-relaxed">{coverPhotoError}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss cover photo error"
            onClick={() => setCoverPhotoError("")}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-red-700 hover:bg-red-100 cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
        </div>
      )}
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 border-b border-background-200/70 bg-background-50">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Link
              className="text-xs font-label text-foreground-500 hover:text-foreground-800 cursor-pointer flex items-center gap-1"
              to="/listings"
            >
              <i className="ri-arrow-left-line" />
              Directory
            </Link>
            <span className="text-foreground-300">/</span>
            <span className="text-xs font-label text-foreground-800 font-medium">
              {isEditing ? "Edit Listing" : "Submit a Listing"}
            </span>
          </div>
          <StepIndicator current={step} />
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-10">
        {/* Step 5 (Preview) renders the real ListingProfile component, which
            expects the same max-w-7xl grid it gets on the live /listings/:slug
            page. Keeping this wrapper at the wizard's narrower max-w-3xl for
            that step squeezed the cover photo into a much smaller box than it
            actually gets on the live page, so the preview cropped/framed the
            image differently than reality — this wrapper now matches
            ListingProfile's own width on step 5 only, every other step keeps
            the narrower column that suits a form. */}
        <div className={step === 5 ? "max-w-7xl mx-auto" : step === 1 ? "max-w-4xl mx-auto" : "max-w-3xl mx-auto"}>
          {step === 1 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Choose Listing Tier to <span className="text-accent-500 italic">Create Listing</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-10">
                Free listings are a great way to get started. Upgrade to Classified anytime for
                premium placement and tools.
              </p>
              <ListingTierCards
                selectedTier={form.tier}
                onSelect={(tier) => setForm((f) => ({ ...f, tier }))}
                scale={0.7}
                className="mx-auto max-w-4xl"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Tell us about your <span className="text-accent-500 italic">business</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-10">
                This is what shows up on your profile card and in search results.
              </p>
              <div className="space-y-5">
                <FormField label="Listing Name" htmlFor="businessName" required>
                  <Input
                    id="businessName"
                    placeholder="e.g. Cocoa Palm Bistro"
                    value={form.businessName}
                    onChange={update("businessName")}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField label="Industry" htmlFor="category" required>
                    <Select id="category" value={form.category} onChange={update("category")}>
                      <option value="">Select your industry</option>
                      {categoryTaxonomy.map((cat) => (
                        <optgroup key={cat.slug} label={cat.label}>
                          {cat.industries.map((ind) => (
                            <option key={ind.slug} value={ind.slug}>
                              {ind.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Price tier" required hint="$ = Budget · $$ = Moderate · $$$ = Premium">
                    <div className="flex gap-2">
                      {priceChoices.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, priceTier: p }))}
                          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer transition-colors ${
                            form.priceTier === p
                              ? "bg-primary-500 text-background-50 border-primary-500"
                              : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField label="Degree Level" htmlFor="education">
                    <Select id="education" value={form.education} onChange={update("education")}>
                      <option value="">Select degree level</option>
                      {EDUCATION_CHOICES.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField
                    label="Degree Type"
                    htmlFor="degreeType"
                    hint="Field of study — shown next to your degree level"
                  >
                    <Input
                      id="degreeType"
                      placeholder="e.g. Nursing, Business Administration"
                      value={form.degreeType}
                      onChange={update("degreeType")}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Exact figure alongside the range: the range drives the
                      directory's filters, this is what the profile shows. */}
                  <FormField
                    label="Years of Experience"
                    htmlFor="yearsExperience"
                    hint="Enter the current total once. It will increase automatically each calendar year."
                    required
                  >
                    <Input
                      id="yearsExperience"
                      type="number"
                      min="0"
                      max="80"
                      placeholder="12"
                      value={form.yearsExperience}
                      onChange={update("yearsExperience")}
                    />
                  </FormField>
                </div>
                <FormField
                  label="Description"
                  htmlFor="description"
                  required
                  hint="Drag the bottom-right corner to make this box bigger"
                >
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="Describe goods or services offered"
                    value={form.description}
                    onChange={update("description")}
                  />
                </FormField>
                <FormField label="Tags" htmlFor="tags">
                  <Input
                    id="tags"
                    placeholder="comma-separated, e.g. farm-to-table, date night"
                    value={form.tags}
                    onChange={update("tags")}
                  />
                </FormField>
                <FormField label="Amenities" htmlFor="amenities" hint="comma-separated, e.g. Parking, WiFi, Wheelchair Accessible">
                  <Input
                    id="amenities"
                    placeholder="e.g. Parking, WiFi, Outdoor Seating"
                    value={form.amenities}
                    onChange={update("amenities")}
                  />
                </FormField>
                <FormField label="Location" htmlFor="location" required>
                  <Input
                    id="location"
                    placeholder="e.g. Roseau, Dominica"
                    value={form.location}
                    onChange={update("location")}
                    required
                  />
                </FormField>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Contact <span className="text-accent-500 italic">& media</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-10">
                How customers reach you, plus a photo to bring your profile to life.
              </p>
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField label="Phone" htmlFor="phone">
                    <Input
                      id="phone"
                      placeholder="+1 (767) 555-0100"
                      value={form.phone}
                      onChange={update("phone")}
                    />
                  </FormField>
                  <FormField label="Email" htmlFor="contactEmail" required>
                    <Input
                      id="contactEmail"
                      placeholder="hello@yourbusiness.com"
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                    />
                  </FormField>
                </div>
                <FormField label="Website" htmlFor="website">
                  <Input
                    id="website"
                    placeholder="yourbusiness.com"
                    value={form.website}
                    onChange={update("website")}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField label="Instagram" htmlFor="instagram">
                    <Input
                      id="instagram"
                      placeholder="instagram.com/yourbusiness"
                      value={form.instagram}
                      onChange={update("instagram")}
                    />
                  </FormField>
                  <FormField label="Facebook" htmlFor="facebook">
                    <Input
                      id="facebook"
                      placeholder="facebook.com/yourbusiness"
                      value={form.facebook}
                      onChange={update("facebook")}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField label="YouTube" htmlFor="youtube">
                    <Input
                      id="youtube"
                      placeholder="youtube.com/@yourbusiness"
                      value={form.youtube}
                      onChange={update("youtube")}
                    />
                  </FormField>
                  <FormField label="Twitter / X" htmlFor="twitter">
                    <Input
                      id="twitter"
                      placeholder="x.com/yourbusiness"
                      value={form.twitter}
                      onChange={update("twitter")}
                    />
                  </FormField>
                </div>
                <FormField
                  label="WhatsApp"
                  htmlFor="whatsapp"
                  hint="Phone number — shown as a WhatsApp chat link"
                >
                  <Input
                    id="whatsapp"
                    placeholder="+1 (767) 555-0100"
                    value={form.whatsapp}
                    onChange={update("whatsapp")}
                  />
                </FormField>

                {/* Bookings were listed as a Classified feature on the pricing
                    page and supported end-to-end in the CMS (booking_enabled
                    meta + class-rest-bookings.php), but no screen ever let an
                    owner switch it on. */}
                <FormField label="Bookings">
                  <label className="flex items-start gap-3 p-4 rounded-lg border border-background-300 hover:border-primary-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-background-300 cursor-pointer"
                      checked={form.bookingEnabled}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bookingEnabled: e.target.checked }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold text-foreground-900">
                        Accept bookings and appointments
                      </span>
                      <span className="block text-xs text-foreground-600 font-label mt-0.5">
                        Adds a secure booking form to your profile. Set a price for automatic
                        Stripe/PayPal confirmation, or leave it at $0 for owner approval.
                      </span>
                    </span>
                  </label>
                </FormField>
                {form.bookingEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 rounded-xl border border-primary-200 bg-primary-50/30 p-4">
                    <div className="sm:col-span-2">
                      <FormField
                        label="Booking type"
                        htmlFor="bookingType"
                        hint="Choose the service or exact rental industry. The correct rate period is applied automatically."
                      >
                        <Select id="bookingType" value={form.bookingType} onChange={update("bookingType")}>
                          {form.bookingType === "rental" && <option value="rental">Rental stay (existing listing)</option>}
                          {bookingTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </FormField>
                    </div>
                    <FormField
                      label={isRentalBookingType(form.bookingType)
                        ? `${bookingRateLabel(form.bookingType)} rate (USD)`
                        : "Booking price (USD)"}
                      htmlFor="bookingPrice"
                      hint={isRentalBookingType(form.bookingType)
                        ? `The total is calculated from the number of ${bookingRateUnit(form.bookingType)}s`
                        : "Enter 0 for a free booking request"}
                    >
                      <Input
                        id="bookingPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.bookingPrice}
                        onChange={update("bookingPrice")}
                        placeholder="0.00"
                      />
                    </FormField>
                    {!isRentalBookingType(form.bookingType) && <FormField label="Meeting duration" htmlFor="bookingDurationMinutes">
                      <Select
                        id="bookingDurationMinutes"
                        value={form.bookingDurationMinutes}
                        onChange={update("bookingDurationMinutes")}
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                        <option value="120">2 hours</option>
                      </Select>
                    </FormField>}
                    {!isRentalBookingType(form.bookingType) && <div className="sm:col-span-2">
                      <FormField
                        label="Private meeting link"
                        htmlFor="bookingMeetingUrl"
                        hint="Zoom, Google Meet, Microsoft Teams, or another HTTPS meeting room. Customers receive it only after payment or confirmation."
                      >
                        <Input
                          id="bookingMeetingUrl"
                          type="url"
                          icon="ri-video-chat-line"
                          value={form.bookingMeetingUrl}
                          onChange={update("bookingMeetingUrl")}
                          placeholder="https://meet.google.com/..."
                        />
                      </FormField>
                    </div>}
                    <PayoutSettingsFields
                      form={form}
                      onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
                  <FormField
                    label="Logo / profile picture"
                    hint="Your account photo, shared across all listings."
                  >
                    <div className="relative w-32 h-32 group">
                      <label className="flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-full border-2 border-dashed border-background-300 hover:border-primary-400 cursor-pointer transition-colors text-center overflow-hidden bg-background-100/40">
                        {form.logoPreview ? (
                          <img
                            src={form.logoPreview}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                            style={imageCropStyle(form.logoPosition, form.logoZoom)}
                          />
                        ) : (
                          <>
                            <i className="ri-image-add-line text-xl text-foreground-400" />
                            <span className="text-[11px] text-foreground-500 font-label px-3 leading-tight">
                              Upload logo
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setForm((f) => ({
                              ...f,
                              logoFile: file,
                              logoPreview: URL.createObjectURL(file),
                            }));
                          }}
                        />
                      </label>
                      {form.logoPreview && (
                        <button
                          type="button"
                          aria-label="Remove logo"
                          onClick={() =>
                            setForm((f) => ({ ...f, logoFile: null, logoPreview: "" }))
                          }
                          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-foreground-950/70 text-background-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <i className="ri-close-line text-sm" />
                        </button>
                      )}
                    </div>
                    {form.logoPreview && (
                      <PositionPicker
                        label="Position"
                        src={form.logoPreview}
                        shape="logo"
                        position={form.logoPosition}
                        zoom={form.logoZoom}
                        onPositionChange={(value) =>
                          setForm((f) => ({ ...f, logoPosition: value }))
                        }
                        onZoomChange={(value) => setForm((f) => ({ ...f, logoZoom: value }))}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Cover photo"
                    hint="Best fit: 1600 × 900 px (16:9), max 2 MB. Keep key content centered for the 4:3 directory crop."
                  >
                    <div className="relative w-full group">
                      <label className="relative flex flex-col items-center justify-center gap-2 w-full aspect-[16/9] rounded-lg border-2 border-dashed border-background-300 hover:border-primary-400 cursor-pointer transition-colors text-center overflow-hidden">
                        {form.photoPreview ? (
                          <img
                            src={form.photoPreview}
                            alt="Cover photo preview"
                            className={`absolute inset-0 w-full h-full ${form.coverFit === "contain" ? "object-contain" : "object-cover"}`}
                            style={imageCropStyle(form.coverPosition, form.coverZoom, form.coverFit)}
                          />
                        ) : (
                          <>
                            <i className="ri-image-add-line text-2xl text-foreground-400" />
                            <span className="text-sm text-foreground-600 font-label">
                              Click to upload a photo
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fileError = coverPhotoFileError(file);
                            if (fileError) {
                              setCoverPhotoError(fileError);
                              e.target.value = "";
                              return;
                            }
                            try {
                              const { width, height } = await readImageDimensions(file);
                              const dimensionError = coverPhotoDimensionError(width, height);
                              if (dimensionError) {
                                setCoverPhotoError(dimensionError);
                                e.target.value = "";
                                return;
                              }
                            } catch {
                              setCoverPhotoError(
                                "We couldn't display this image. It may be damaged or use an unsupported format. Choose a different picture.",
                              );
                              e.target.value = "";
                              return;
                            }
                            setCoverPhotoError("");
                            setForm((f) => ({
                              ...f,
                              photoFile: file,
                              photoPreview: URL.createObjectURL(file),
                              coverFit: "contain",
                              coverPosition: "center",
                              coverZoom: 1,
                            }));
                          }}
                        />
                      </label>
                      {form.photoPreview && (
                        <button
                          type="button"
                          aria-label="Remove cover photo"
                          onClick={() =>
                            setForm((f) => ({ ...f, photoFile: null, photoPreview: "" }))
                          }
                          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-foreground-950/70 text-background-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <i className="ri-close-line text-sm" />
                        </button>
                      )}
                    </div>
                    {coverPhotoError && (
                      <div
                        role="alert"
                        className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                      >
                        <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
                        <span>{coverPhotoError}</span>
                      </div>
                    )}
                    {form.photoPreview && (
                      <PositionPicker
                        label="Position"
                        src={form.photoPreview}
                        shape="cover"
                        position={form.coverPosition}
                        zoom={form.coverZoom}
                        fit={form.coverFit}
                        onPositionChange={(value) =>
                          setForm((f) => ({ ...f, coverPosition: value }))
                        }
                        onZoomChange={(value) => setForm((f) => ({ ...f, coverZoom: value }))}
                        onFitChange={(value) => setForm((f) => ({ ...f, coverFit: value }))}
                      />
                    )}
                  </FormField>
                </div>
                <FormField
                  label="Gallery"
                  hint="Add extra photos to your profile gallery."
                >
                  <div className="flex flex-wrap gap-3">
                    {form.galleryPreviews.map((src, i) => (
                      <div
                        key={src}
                        className="relative w-24 h-24 rounded-lg overflow-hidden border border-background-200/70 group"
                      >
                        <img
                          src={src}
                          alt={`Gallery upload ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remove gallery photo ${i + 1}`}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              galleryFiles: f.galleryFiles.filter((_, idx) => idx !== i),
                              galleryPreviews: f.galleryPreviews.filter((_, idx) => idx !== i),
                            }))
                          }
                          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-foreground-950/70 text-background-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <i className="ri-close-line text-sm" />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-background-300 hover:border-primary-400 cursor-pointer transition-colors text-center">
                      <i className="ri-add-line text-lg text-foreground-400" />
                      <span className="text-[10px] text-foreground-500 font-label">
                        Add photos
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setForm((f) => ({
                            ...f,
                            galleryFiles: [...f.galleryFiles, ...files],
                            galleryPreviews: [
                              ...f.galleryPreviews,
                              ...files.map((file) => URL.createObjectURL(file)),
                            ],
                          }));
                        }}
                      />
                    </label>
                  </div>
                </FormField>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Review <span className="text-accent-500 italic">& submit</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-10">
                Double-check everything looks right before you publish.
              </p>
              <div className="rounded-2xl border border-background-200/70 bg-background-100/40 p-6 space-y-5">
                {/* Tier is changeable right here at the end. Previously it was
                    locked in at step 1, so anyone who reconsidered after
                    seeing their finished listing had to abandon the form and
                    start over. */}
                <div className="pb-4 border-b border-background-200/70">
                  <span className="mb-3 block text-sm font-semibold text-foreground-800">Tier</span>
                  <ListingTierCards
                    compact
                    selectedTier={form.tier}
                    onSelect={(tier) => setForm((f) => ({ ...f, tier }))}
                    className="gap-3"
                  />
                  {form.tier === "classified" && (
                    <p className="text-[11px] text-foreground-500 font-label mt-2">
                      You'll be taken to payment after submitting.
                    </p>
                  )}
                </div>
                {[
                  ["Business name", form.businessName || "—"],
                  [
                    "Industry",
                    findIndustry(form.category)
                      ? `${findIndustry(form.category).label} (${findIndustry(form.category).categoryLabel})`
                      : "—",
                  ],
                  ["Price tier", form.priceTier || "—"],
                  ["Degree Level", form.education || "—"],
                  ["Degree Type", form.degreeType || "—"],
                  ["Years of Experience", form.yearsExperience ? `${form.yearsExperience}` : "—"],
                  ["Location", form.location || "—"],
                  ["Phone", form.phone || "—"],
                  ["Email", form.email || "—"],
                  ["Website", form.website || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-foreground-600 font-label">{label}</span>
                    <span className="font-semibold text-foreground-900 font-label text-right">
                      {value}
                    </span>
                  </div>
                ))}
                {/* Images shown as thumbnails rather than described in
                    words. These were three text rows reading "Not uploaded" —
                    which was wrong when editing (the check only looked at the
                    File object, never the already-saved image) and was never
                    much use even when right. A picture answers "did that
                    upload, and is it cropped how I want?" in one glance. */}
                <div className="pt-4 border-t border-background-200/70">
                  <span className="text-sm text-foreground-600 font-label block mb-3">Images</span>
                  <div className="flex flex-wrap items-start gap-5">
                    <div>
                      <span className="text-[11px] font-label text-foreground-500 block mb-1.5">
                        Logo
                      </span>
                      {form.logoPreview ? (
                        <div className="w-16 h-16 rounded-full overflow-hidden border border-background-200/70">
                          <img
                            src={form.logoPreview}
                            alt="Logo"
                            className="w-full h-full object-cover"
                            style={imageCropStyle(form.logoPosition, form.logoZoom)}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full border border-dashed border-background-300 flex items-center justify-center">
                          <i className="ri-close-line text-foreground-300" />
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] font-label text-foreground-500 block mb-1.5">
                        Cover photo
                      </span>
                      {form.photoPreview ? (
                        <div className="w-40 aspect-[16/9] rounded-lg overflow-hidden border border-background-200/70">
                          <img
                            src={form.photoPreview}
                            alt="Cover"
                            className={`w-full h-full ${form.coverFit === "contain" ? "object-contain" : "object-cover"}`}
                            style={imageCropStyle(form.coverPosition, form.coverZoom, form.coverFit)}
                          />
                        </div>
                      ) : (
                        <div className="w-40 aspect-[16/9] rounded-lg border border-dashed border-background-300 flex items-center justify-center">
                          <span className="text-[11px] text-foreground-400 font-label">
                            Not added
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] font-label text-foreground-500 block mb-1.5">
                        Gallery ({form.galleryPreviews.length})
                      </span>
                      {form.galleryPreviews.length ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[168px]">
                          {form.galleryPreviews.slice(0, 6).map((src, i) => (
                            <div
                              key={src || i}
                              className="w-12 h-12 rounded-md overflow-hidden border border-background-200/70"
                            >
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-foreground-400 font-label">
                          None added
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {form.description && (
                  <div className="pt-4 border-t border-background-200/70">
                    <span className="text-sm text-foreground-600 font-label block mb-1.5">
                      Description
                    </span>
                    {/* Matches the live profile, so the review step shows the
                        paragraph breaks the owner actually typed rather than
                        one run-on block. */}
                    <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-line">
                      {form.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Preview <span className="text-accent-500 italic">your listing</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-6">
                This is the actual listing page layout — exactly how your profile will look once
                it's approved, not a mockup.
              </p>

              {/* Cancels this page's own px-4 md:px-8 lg:px-12 padding so
                  ListingProfile gets the exact same available width here as
                  it does on the real /listings/:slug page — see the wrapper
                  comment above for why step 5 alone uses max-w-7xl. */}
              <div className="rounded-2xl border border-background-200/70 bg-background-50 overflow-hidden -mx-4 md:-mx-8 lg:-mx-12">
                <ListingProfile data={buildPreviewData(form)} isPreview />
              </div>
            </div>
          )}

          {step === 5 && !isLiveApi && <DemoModeNotice className="mt-6" />}

          {submitError && (
            <div className="mt-6 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
              <i className="ri-error-warning-line mt-0.5" />
              {submitError}
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1}
              onClick={goBack}
              icon="ri-arrow-left-line"
              iconPosition="left"
            >
              Back
            </Button>
            {step < 5 ? (
              <Button
                type="button"
                variant="primary"
                disabled={!canContinue()}
                onClick={goNext}
                icon="ri-arrow-right-line"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                variant="accent"
                onClick={handleSubmit}
                disabled={submitting}
                icon="ri-check-line"
              >
                {submitting ? "Saving…" : isEditing ? "Save changes" : "Submit Listing"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The $40/yr Classified fee, charged right after the wizard creates the
 * (unpaid) listing — see class-stripe-listing-checkout.php. Same
 * card-or-PayPal pattern as ListingProducts.jsx's BuyModal, just against a
 * listingId instead of a vendor product/order id. Paying doesn't skip
 * moderation — the listing stays `pending` either way — it only settles
 * billing, which is why "I'll pay later" is still a safe way out of this
 * step rather than a dead end.
 */
function ClassifiedPaymentStep({ listingId, businessName, onDone }) {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [clientSecret, setClientSecret] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCheckoutConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig({ stripeEnabled: false, paypalEnabled: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startCardPayment = async () => {
    setError(null);
    setStarting(true);
    try {
      const result = await createListingPaymentIntent(listingId);
      setClientSecret(result.clientSecret);
    } catch (err) {
      setError(err.message || "Couldn't start card payment — please try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-5">
            <i className="ri-vip-crown-line text-2xl" />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-2">
            One last step — pay for Classified
          </h1>
          <p className="text-sm text-foreground-600 font-label">
            <span className="font-semibold">{businessName}</span> is saved and pending review.
            Complete the $40/yr Classified fee to unlock premium placement.
          </p>
        </div>

        <div className="bg-background-50 border border-background-200/70 rounded-2xl p-6 md:p-8 shadow-sm">
          {loadingConfig && <Spinner />}

          {!loadingConfig && error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700">
              {error}
            </div>
          )}

          {!loadingConfig && !clientSecret && (
            <div className="space-y-3">
              {config?.stripeEnabled && (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={startCardPayment}
                  disabled={starting}
                >
                  {starting ? "Starting…" : "Pay $40 with card"}
                </Button>
              )}

              {config?.stripeEnabled && config?.paypalEnabled && (
                <div className="flex items-center gap-3 my-1 text-xs text-foreground-500 font-label">
                  <span className="flex-1 h-px bg-background-200" />
                  or
                  <span className="flex-1 h-px bg-background-200" />
                </div>
              )}

              {config?.paypalEnabled && (
                <PaypalButton
                  clientId={config.paypalClientId}
                  createOrder={async () => {
                    const result = await createListingPaypalOrder(listingId);
                    return { orderId: listingId, paypalOrderId: result.paypalOrderId };
                  }}
                  captureOrder={(id) => captureListingPaypalOrder(id)}
                  onSuccess={() => onDone(true)}
                  onError={(message) => setError(message)}
                />
              )}

              {!config?.stripeEnabled && !config?.paypalEnabled && (
                <p className="text-sm text-foreground-500 font-label">
                  Card and PayPal payment aren't set up on this site yet — we'll follow up about
                  billing by email instead.
                </p>
              )}
            </div>
          )}

          {clientSecret && config && (
            <Elements stripe={getStripe(config.stripePublishableKey)} options={{ clientSecret }}>
              <ClassifiedStripeForm listingId={listingId} onSuccess={() => onDone(true)} />
            </Elements>
          )}
        </div>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => onDone(false)}
            className="text-xs font-label text-foreground-500 hover:text-foreground-800 cursor-pointer"
          >
            I'll pay later
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassifiedStripeForm({ listingId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    // Never trust the client's own belief that payment succeeded —
    // confirmListingPayment() asks Stripe directly, server-side, before
    // flipping payment_status to 'paid'.
    try {
      const result = await confirmListingPayment(listingId);
      if (result.status === "paid") {
        onSuccess();
      } else {
        setError("Payment is still processing — check your email for confirmation shortly.");
        setSubmitting(false);
      }
    } catch {
      setError("Payment went through, but we couldn't confirm it immediately. Check your email.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700">
          {error}
        </div>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full mt-5"
        disabled={!stripe || submitting}
      >
        {submitting ? "Processing…" : "Pay $40"}
      </Button>
    </form>
  );
}
