import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  categoryTaxonomy,
  findIndustry,
  resolveListingIndustrySlug,
} from "../data/industries";
import { EDUCATION_CHOICES } from "../data/profileChoices";
import {
  submitListing,
  updateListing,
  getListingBySlug,
  getMyListings,
  getBookingSettings,
  saveBookingSettings,
  getCheckoutConfig,
  createListingPaymentIntent,
  confirmListingPayment,
  createListingPaypalOrder,
  captureListingPaypalOrder,
  setListingTier,
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
import BookingRateEditor from "../components/booking/BookingRateEditor";
import {
  hasCompletePayoutDetails,
  hasPaidBookingRate,
  missingPayoutFieldIds,
} from "../lib/payoutSettings";
import { Spinner, ErrorState } from "../components/ui/States";
import { isLiveApi } from "../lib/config";
import { trackMarketingEventOnce } from "../lib/marketingAnalytics";
import { register } from "../lib/authClient";
import { useAuth } from "../hooks/useAuth";
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
  normalizeRentalRateUnit,
  normalizeBookingType,
  rentalRateUnitOptions,
} from "../lib/bookingTypes";
import {
  completeListingOnboarding,
  getListingOnboardingDraft,
  requireListingOnboarding,
  saveListingOnboardingDraft,
} from "../lib/listingOnboarding";

const steps = [
  { n: 1, label: "Plan" },
  { n: 2, label: "Business Details" },
  { n: 3, label: "Contact & Photos" },
  { n: 4, label: "Preview & Submit" },
];

const priceChoices = ["$", "$$", "$$$"];
const hasValidRequiredYears = (value) => /^\d+$/.test(String(value)) && Number(value) <= 80;

export function listingLocationParts(value) {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const city = parts[0];
  const country = parts[parts.length - 1];
  const region = parts.slice(1, -1).join(", ");
  const validPart = (part) => part.length >= 2 && /[\p{L}]/u.test(part);
  return validPart(city) && (!region || validPart(region)) && validPart(country)
    ? { city, region, country }
    : null;
}

export const hasCompleteListingLocation = (value) => Boolean(listingLocationParts(value));

export function missingBusinessRequiredFieldIds(form) {
  return [
    !String(form.businessName || "").trim() && "businessName",
    !findIndustry(form.category) && "category",
    !form.priceTier && "priceTier",
    !hasValidRequiredYears(form.yearsExperience) && "yearsExperience",
    !String(form.description || "").trim() && "description",
    !hasCompleteListingLocation(form.location) && "location",
  ].filter(Boolean);
}
const hasValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

export function contactEmailForNextStep(formEmail, accountEmail, authenticatedEmail) {
  if (String(formEmail || "").trim()) return formEmail;
  return String(accountEmail || authenticatedEmail || "").trim();
}

export function savedSellProductsSelection(publicListing, ownedListings = []) {
  const ownedListing = ownedListings.find(
    (listing) =>
      Number(listing.id) === Number(publicListing?.id) || listing.slug === publicListing?.slug
  );
  return typeof ownedListing?.sellProducts === "boolean"
    ? ownedListing.sellProducts
    : Boolean(publicListing?.sellProducts);
}

export function savedBookingSelection(publicListing, ownedListings = []) {
  const ownedListing = ownedListings.find(
    (listing) =>
      Number(listing.id) === Number(publicListing?.id) || listing.slug === publicListing?.slug
  );
  return typeof ownedListing?.bookingEnabled === "boolean"
    ? ownedListing.bookingEnabled
    : Boolean(publicListing?.bookingEnabled);
}

export function savedIndustrySelection(publicListing, ownedListings = []) {
  const ownedListing = ownedListings.find(
    (listing) =>
      Number(listing.id) === Number(publicListing?.id) || listing.slug === publicListing?.slug
  );
  return resolveListingIndustrySlug(ownedListing) || resolveListingIndustrySlug(publicListing);
}

const initialForm = {
  tier: "",
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
  coverFit: "smart",
  galleryFiles: [],
  galleryPreviews: [],
  sellProducts: false,
  bookingEnabled: false,
  hideContactInfo: false,
  bookingType: "appointment",
  bookingPrice: "0",
  bookingRentalRateUnit: "night",
  bookingRateRules: [],
  bookingDurationMinutes: "30",
  bookingPriceUnit: "appointment",
  bookingMaxDurationMinutes: "120",
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

const demoForm = {
  ...initialForm,
  tier: "classified",
  businessName: "James Local Fruits",
  category: "catering",
  priceTier: "$",
  description: "Locally grown organic foods at affordable prices.",
  tags: "farm-to-table, organic, local produce",
  amenities: "Delivery, Pickup",
  location: "Roseau, Saint George Parish, Dominica",
  education: "Professional Certificate",
  degreeType: "Food Safety & Hospitality",
  yearsExperience: "25",
  phone: "+1 (767) 555-0148",
  email: "hello@jameslocalfruits.dm",
  website: "jameslocalfruits.dm",
  instagram: "instagram.com/jameslocalfruits",
  photoPreview: "/uploads/hero.webp",
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
  const contactHidden = Boolean(
    form.bookingEnabled &&
      (Number(form.bookingPrice) > 0 || form.bookingRateRules.some((rule) => Number(rule.priceCents) > 0))
  );
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
    parentCategoryLabel: industry?.categoryLabel || "",
    industrySlug: industry?.slug || "",
    industryLabel: industry?.label || "",
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
    contactHidden,
    contact: hasContactInfo
      ? {
          phone: contactHidden ? "" : form.phone || "",
          email: "",
          website: contactHidden ? "" : form.website || "",
          websiteUrl: contactHidden
            ? ""
            : form.website
              ? form.website.startsWith("http")
                ? form.website
                : `https://${form.website}`
              : "",
          address: contactHidden ? "" : form.location || "",
          instagram: contactHidden ? "" : form.instagram || "",
          facebook: contactHidden ? "" : form.facebook || "",
          youtube: contactHidden ? "" : form.youtube || "",
          twitter: contactHidden ? "" : form.twitter || "",
          whatsapp: contactHidden ? "" : form.whatsapp || "",
        }
      : null,
    mapEmbedUrl: null,
    logo: form.logoPreview || "",
    logoPosition: form.logoPosition || "center",
    logoZoom: form.logoZoom || 1,
    coverPosition: form.coverPosition || "center",
    coverZoom: form.coverZoom || 1,
    coverFit: form.coverFit || "smart",
    bookingEnabled: form.bookingEnabled,
    bookingType: form.bookingType,
    bookingPriceCents: Math.max(0, Math.round((Number(form.bookingPrice) || 0) * 100)),
    bookingRentalRateUnit: isRentalBookingType(form.bookingType)
      ? normalizeRentalRateUnit(form.bookingRentalRateUnit, form.bookingType)
      : "",
    bookingRateRules: form.bookingRateRules,
    bookingDurationMinutes: Number(form.bookingDurationMinutes) || 30,
    bookingPriceUnit: form.bookingPriceUnit || "appointment",
    bookingMaxDurationMinutes: Number(form.bookingMaxDurationMinutes) || 120,
  };
}

function StepIndicator({ current }) {
  const currentStep = steps.find((step) => step.n === current) || steps[0];

  return (
    <nav aria-label="Listing registration progress" className="mt-3 sm:mt-4">
      <div className="rounded-xl border border-background-200/80 bg-background-50/90 p-3 shadow-sm lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700">
            Step {current} of {steps.length}
          </span>
          <span className="truncate text-xs font-semibold text-foreground-900">
            {currentStep.label}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {steps.map((step) => (
            <span
              key={step.n}
              className={`h-1.5 rounded-full ${step.n <= current ? "bg-primary-700" : "bg-background-300"}`}
            />
          ))}
        </div>
      </div>
      <ol className="hidden w-full items-center rounded-2xl border border-background-200/80 bg-background-50/80 p-2 shadow-sm lg:flex">
        {steps.map((step, i) => {
          const isCurrent = step.n === current;
          const isComplete = step.n < current;
          return (
            <Fragment key={step.n}>
              <li className="shrink-0">
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isCurrent
                      ? "bg-primary-700 text-white shadow-sm"
                      : isComplete
                        ? "bg-primary-50 text-primary-800"
                        : "text-foreground-500"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                      isCurrent
                        ? "bg-white/20 text-white"
                        : isComplete
                          ? "bg-primary-200 text-primary-900"
                          : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    {isComplete ? (
                      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2">
                        <path d="m3 8 3 3 7-7" />
                      </svg>
                    ) : step.n}
                  </span>
                  <span>{step.label}</span>
                </div>
              </li>
              {i < steps.length - 1 && (
                <li aria-hidden="true" role="presentation" className="mx-2 flex min-w-9 flex-1 items-center">
                  <svg
                    viewBox="0 0 36 12"
                    preserveAspectRatio="none"
                    className={`h-3 w-full ${isComplete ? "text-primary-400" : "text-background-400"}`}
                  >
                    <path d="M1 6h30M26 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function OwnerAccountPanel({ account, onChange, signInHref, showRequiredErrors = false }) {
  const termsAreMissing = showRequiredErrors && !account.agree;
  const nameIsMissing = showRequiredErrors && !account.name.trim();
  const emailIsInvalid = showRequiredErrors && !hasValidEmail(account.email);
  const passwordIsInvalid = showRequiredErrors && account.password.length < 8;
  const confirmationIsInvalid = showRequiredErrors && (!account.confirmPassword || account.password !== account.confirmPassword);

  return (
    <section className="mt-5 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-background-50 p-4 shadow-[0_14px_38px_rgba(23,84,55,0.08)] sm:mt-8 sm:p-5 md:p-6">
      <div className="mb-4 flex items-start gap-3 sm:mb-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700 text-background-50 sm:h-10 sm:w-10">
          <i className="ri-user-add-line text-lg" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-primary-950 sm:text-xl">Create your account</h2>
          <p className="mt-1 hidden text-xs leading-relaxed text-foreground-600 sm:block">
            This account will own the listing and let you update it after submission.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <FormField label="Account name" htmlFor="accountName" required error={nameIsMissing ? "Enter an account name." : ""}>
          <Input id="accountName" placeholder="Personal or business name" value={account.name} onChange={onChange("name")} error={nameIsMissing} aria-invalid={nameIsMissing || undefined} required />
        </FormField>
        <FormField label="Account email" htmlFor="accountEmail" required error={emailIsInvalid ? "Enter a valid email address." : ""}>
          <Input id="accountEmail" type="email" placeholder="owner@email.com" value={account.email} onChange={onChange("email")} error={emailIsInvalid} aria-invalid={emailIsInvalid || undefined} required />
        </FormField>
        <FormField label="Password" htmlFor="accountPassword" hint="At least 8 characters" required error={passwordIsInvalid ? "Use at least 8 characters." : ""}>
          <Input id="accountPassword" type="password" placeholder="••••••••" minLength={8} value={account.password} onChange={onChange("password")} error={passwordIsInvalid} aria-invalid={passwordIsInvalid || undefined} required />
        </FormField>
        <FormField label="Confirm password" htmlFor="accountConfirmPassword" required error={confirmationIsInvalid ? "Passwords must match." : ""}>
          <Input id="accountConfirmPassword" type="password" placeholder="••••••••" minLength={8} value={account.confirmPassword} onChange={onChange("confirmPassword")} error={confirmationIsInvalid} aria-invalid={confirmationIsInvalid || undefined} required />
        </FormField>
      </div>
      <label className={`mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs transition-all ${termsAreMissing ? "border-2 border-red-500 bg-red-50 text-red-900 ring-4 ring-red-200 shadow-[0_0_0_6px_rgba(254,202,202,0.45),0_10px_24px_rgba(220,38,38,0.12)]" : "border-transparent text-foreground-700"}`}>
        <input id="accountTerms" type="checkbox" className={`mt-0.5 rounded ${termsAreMissing ? "border-red-500 accent-red-600" : "border-background-300"}`} checked={account.agree} onChange={onChange("agree")} aria-invalid={termsAreMissing || undefined} aria-describedby={termsAreMissing ? "accountTermsError" : undefined} />
        <span>
          I agree to the <Link to="/terms" target="_blank" className="font-semibold text-primary-800">Terms</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-primary-800">Privacy Policy</Link>.
          {termsAreMissing && <span id="accountTermsError" className="ml-1 font-semibold text-red-700">Required to continue.</span>}
        </span>
      </label>
      <p className="mt-5 border-t border-primary-200/80 pt-4 text-center text-sm text-foreground-600">
        Already have an account?{" "}
        <Link to={signInHref} className="font-semibold text-primary-800 transition hover:text-primary-950 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}

export default function AddListingPage() {
  const navigate = useNavigate();
  const { slug: editSlug } = useParams();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const isEditing = Boolean(editSlug);
  const requestedTier = searchParams.get("tier");
  const submitQuery = searchParams.toString();
  const signInHref = `/auth/login?redirect=${encodeURIComponent(`/listings/submit${submitQuery ? `?${submitQuery}` : ""}`)}`;
  const isOnboarding = !isEditing && searchParams.get("onboarding") === "1";
  const isManagingPlan = isEditing && searchParams.get("managePlan") === "1";
  const isManagingBookings = isEditing && searchParams.get("manageBookings") === "1";
  const previewStep = import.meta.env.DEV ? Number(searchParams.get("previewStep")) : 0;

  const [step, setStep] = useState(previewStep >= 1 && previewStep <= 4 ? previewStep : 1);
  const [form, setForm] = useState(() => {
    const savedDraft = isOnboarding ? getListingOnboardingDraft() : null;
    return {
      ...(previewStep ? demoForm : initialForm),
      ...(savedDraft || {}),
      tier:
        requestedTier === "free" || requestedTier === "classified"
          ? requestedTier
          : savedDraft?.tier || (previewStep ? demoForm.tier : initialForm.tier),
    };
  });
  const [account, setAccount] = useState(() => ({
    name: previewStep ? "James Local Fruits" : "",
    email: previewStep ? "owner@jameslocalfruits.dm" : "",
    password: previewStep ? "Preview123!" : "",
    confirmPassword: previewStep ? "Preview123!" : "",
    agree: Boolean(previewStep),
  }));
  const [accountCreated, setAccountCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [requiredAttentionStep, setRequiredAttentionStep] = useState(null);
  const [coverPhotoError, setCoverPhotoError] = useState("");
  const [listingId, setListingId] = useState(null);
  const [savedTier, setSavedTier] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [loadError, setLoadError] = useState(null);
  // Set once a Classified submission successfully creates the (unpaid)
  // listing post — switches the page over to the payment step below
  // instead of the plain "submitted" thank-you screen. A Free submission
  // never sets this and goes straight to `submitted`.
  const [pendingPayment, setPendingPayment] = useState(null); // { listingId } | null
  const [justPaid, setJustPaid] = useState(false);
  const listingStarted = useRef(false);

  const noteListingStarted = () => {
    if (isEditing || listingStarted.current) return;
    listingStarted.current = true;
    trackMarketingEventOnce("listing_started", "listing_form");
  };

  useEffect(() => {
    if (!isOnboarding || isEditing || submitted) return;
    saveListingOnboardingDraft(form);
  }, [form, isEditing, isOnboarding, submitted]);

  // Edit mode reuses this same wizard, just pre-filled from the existing
  // listing (getListingBySlug returns the same display shape ListingProfile
  // uses, which has enough — categorySlug, contact.*, education/experience,
  // gallery, etc. — to map back into the wizard's flat form state).
  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    Promise.all([
      getListingBySlug(editSlug),
      getMyListings().catch(() => []),
    ])
      .then(([data, ownedListings]) => {
        if (cancelled) return;
        if (!data) {
          setLoadError("Couldn't find this listing.");
          return;
        }
        setListingId(data.id);
        const savedSellProducts = savedSellProductsSelection(data, ownedListings || []);
        const savedBookingEnabled = savedBookingSelection(data, ownedListings || []);
        const savedIndustry = savedIndustrySelection(data, ownedListings || []);
        const existingTier = data.badge === "Classified" ? "classified" : "free";
        setSavedTier(existingTier);
        setForm((f) => ({
          ...f,
          tier: existingTier,
          businessName: data.title || "",
          category: savedIndustry,
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
          bookingEnabled: savedBookingEnabled,
          hideContactInfo: Boolean(data.contactHidden),
          bookingType: normalizeBookingType(data.bookingType),
          bookingPrice: ((data.bookingPriceCents || 0) / 100).toFixed(2),
          bookingRentalRateUnit: normalizeRentalRateUnit(data.bookingRentalRateUnit, data.bookingType),
          bookingRateRules: data.bookingRateRules || [],
          bookingDurationMinutes: String(data.bookingDurationMinutes || 30),
          bookingPriceUnit: data.bookingPriceUnit || "appointment",
          bookingMaxDurationMinutes: String(data.bookingMaxDurationMinutes || 120),
          photoPreview: data.coverPhoto || "",
          coverPosition: data.coverPosition || "center",
          coverZoom: data.coverZoom || 1,
          coverFit: data.coverFit || "smart",
          // gallery[0] is the cover once mapListingDetail prepends it, so the
          // gallery previews start after it.
          galleryPreviews: (data.gallery || [])
            .filter((g) => g.src && g.src !== data.coverPhoto)
            .map((g) => g.src),
          sellProducts: savedSellProducts,
        }));
        getBookingSettings(data.id)
          .then((settings) => {
            if (cancelled) return;
            setForm((f) => ({
              ...f,
              bookingEnabled: Boolean(settings.bookingEnabled),
              hideContactInfo: Boolean(settings.hideContactInfo),
              phone: settings.phone ?? f.phone,
              email: settings.email ?? f.email,
              website: settings.website ?? f.website,
              instagram: settings.instagram ?? f.instagram,
              facebook: settings.facebook ?? f.facebook,
              youtube: settings.youtube ?? f.youtube,
              twitter: settings.twitter ?? f.twitter,
              whatsapp: settings.whatsapp ?? f.whatsapp,
              bookingType: normalizeBookingType(settings.bookingType),
              bookingPrice: ((settings.bookingPriceCents || 0) / 100).toFixed(2),
              bookingRentalRateUnit: normalizeRentalRateUnit(settings.bookingRentalRateUnit, settings.bookingType),
              bookingRateRules: settings.bookingRateRules || [],
              bookingDurationMinutes: String(settings.bookingDurationMinutes || 30),
              bookingPriceUnit: settings.bookingPriceUnit || "appointment",
              bookingMaxDurationMinutes: String(settings.bookingMaxDurationMinutes || 120),
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
        // Normal edits start at the plan. Seller Center shortcuts still open
        // the matching relocated review or booking section.
        setStep(isManagingPlan ? 4 : isManagingBookings ? 3 : 1);
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
  }, [isEditing, editSlug, isManagingBookings, isManagingPlan]);

  useEffect(() => {
    if (!isManagingBookings || loadingExisting || step !== 3) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("booking-settings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isManagingBookings, loadingExisting, step]);

  const handleSubmit = async () => {
    setSubmitError(null);
    const missingBusinessFields = [
      [form.tier, "Listing plan"],
      [form.businessName.trim(), "Listing name"],
      [findIndustry(form.category), "Industry"],
      [form.priceTier, "Price tier"],
      [form.description.trim(), "Description"],
      [hasValidRequiredYears(form.yearsExperience), "Years of experience (0–80)"],
      [hasCompleteListingLocation(form.location), "Location (city/state/parish and country)"],
    ]
      .filter(([value]) => !value)
      .map(([, label]) => label);
    if (missingBusinessFields.length) {
      setStep(2);
      setSubmitError(`Complete all required fields: ${missingBusinessFields.join(", ")}.`);
      return;
    }
    if (!hasValidEmail(form.email)) {
      setStep(3);
      setSubmitError("Enter a valid email address.");
      return;
    }
    if (coverPhotoError) {
      setStep(3);
      setSubmitError("Choose a valid cover photo before submitting.");
      return;
    }
    if (!hasCompletePayoutDetails(form)) {
      setStep(3);
      setSubmitError("Complete the required payment and payout information before submitting.");
      return;
    }
    if (!isEditing && !auth.isAuthenticated && !accountCreated) {
      if (!account.name.trim() || !hasValidEmail(account.email)) {
        setStep(1);
        setSubmitError("Enter your account name and a valid account email.");
        return;
      }
      if (account.password.length < 8 || account.password !== account.confirmPassword) {
        setStep(1);
        setSubmitError("Use a password of at least 8 characters and confirm it correctly.");
        return;
      }
      if (!account.agree) {
        setStep(1);
        setSubmitError("Accept the Terms and Privacy Policy to create your account.");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateListing(listingId, form);
        if (savedTier && form.tier !== savedTier) {
          const tierResult = await setListingTier(listingId, form.tier);
          setSavedTier(form.tier);
          if (tierResult?.paymentRequired) {
            setPendingPayment({ listingId });
            return;
          }
        }
        setSubmitted(true);
        return;
      }
      if (!auth.isAuthenticated && !accountCreated) {
        await register({
          name: account.name.trim(),
          email: account.email.trim(),
          password: account.password,
          accountType: "business",
        });
        requireListingOnboarding();
        setAccountCreated(true);
      }
      const result = await submitListing(form);
      if (result?.id) {
        setListingId(result.id);
        completeListingOnboarding();
      }
      if (form.tier === "classified" && result?.id) {
        setPendingPayment({ listingId: result.id });
      } else if (form.sellProducts && result?.id) {
        navigate(`/dashboard?products=${result.id}#products-services`, { replace: true });
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setSubmitError(err.message || "Something went wrong submitting your listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveSpecialRates = async (bookingRateRules) => {
    setForm((current) => ({ ...current, bookingRateRules }));
    if (!isEditing || !listingId || !isLiveApi) {
      return { deferred: true };
    }
    await saveBookingSettings(listingId, { ...form, bookingRateRules });
    return { deferred: false };
  };

  const update = (field) => (e) => {
    noteListingStarted();
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleLogoPhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => {
      if (current.logoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(current.logoPreview);
      }
      return {
        ...current,
        logoFile: file,
        logoPreview: URL.createObjectURL(file),
        logoPosition: "center",
        logoZoom: 1,
      };
    });
    event.target.value = "";
  };

  const handleCoverPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileError = coverPhotoFileError(file);
    if (fileError) {
      setCoverPhotoError(fileError);
      event.target.value = "";
      return;
    }
    try {
      const { width, height } = await readImageDimensions(file);
      const dimensionError = coverPhotoDimensionError(width, height);
      if (dimensionError) {
        setCoverPhotoError(dimensionError);
        event.target.value = "";
        return;
      }
    } catch {
      setCoverPhotoError(
        "We couldn't display this image. It may be damaged or use an unsupported format. Choose a different picture.",
      );
      event.target.value = "";
      return;
    }
    setCoverPhotoError("");
    setForm((current) => {
      if (current.photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(current.photoPreview);
      }
      return {
        ...current,
        photoFile: file,
        photoPreview: URL.createObjectURL(file),
        coverFit: "smart",
        coverPosition: "center",
        coverZoom: 1,
      };
    });
    event.target.value = "";
  };

  const updateAccount = (field) => (e) =>
    setAccount((current) => ({
      ...current,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const canContinue = () => {
    // Description is required — it's the part of a listing that actually
    // sells the business, and an empty one makes the profile look abandoned.
    // Degree level and degree type are optional: plenty of trades and shops
    // have no academic qualification to give, and demanding one would either
    // block them or invite junk data.
    if (step === 1) {
      const planIsSelected = form.tier === "free" || form.tier === "classified";
      const accountIsComplete =
        isEditing ||
        auth.isAuthenticated ||
        accountCreated ||
        (account.name.trim() &&
          hasValidEmail(account.email) &&
          account.password.length >= 8 &&
          account.password === account.confirmPassword &&
          account.agree);
      return planIsSelected && accountIsComplete;
    }
    if (step === 2) return missingBusinessRequiredFieldIds(form).length === 0;
    if (step === 3)
      return hasValidEmail(form.email) && !coverPhotoError && hasCompletePayoutDetails(form);
    return true;
  };

  const missingRequiredFieldIds = () => {
    if (step === 1) {
      const accountFields =
        isEditing || auth.isAuthenticated || accountCreated
          ? []
          : [
              !account.name.trim() && "accountName",
              !hasValidEmail(account.email) && "accountEmail",
              account.password.length < 8 && "accountPassword",
              (!account.confirmPassword || account.password !== account.confirmPassword) && "accountConfirmPassword",
              !account.agree && "accountTerms",
            ].filter(Boolean);
      return [
        !form.tier && "listingTier",
        ...accountFields,
      ].filter(Boolean);
    }
    if (step === 2) {
      return missingBusinessRequiredFieldIds(form);
    }
    if (step === 3) {
      return [
        !hasValidEmail(form.email) && "contactEmail",
        coverPhotoError && "coverPhoto",
        ...missingPayoutFieldIds(form),
      ].filter(Boolean);
    }
    return [];
  };

  const goNext = () => {
    if (!canContinue()) {
      const missingFields = missingRequiredFieldIds();
      setRequiredAttentionStep(step);
      setSubmitError("Complete the highlighted required fields before continuing.");
      window.requestAnimationFrame(() => {
        const firstMissing = document.getElementById(missingFields[0]);
        firstMissing?.focus?.();
        firstMissing?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setRequiredAttentionStep(null);
    setSubmitError(null);
    if (step === 1 && !form.email.trim()) {
      const contactEmail = contactEmailForNextStep(form.email, account.email, auth.email);
      if (contactEmail) {
        setForm((current) => ({ ...current, email: contactEmail }));
      }
    }
    setStep((s) => Math.min(4, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const showAccountRequiredErrors = requiredAttentionStep === 1;
  const showBusinessRequiredErrors = requiredAttentionStep === 2;
  const showPayoutRequiredErrors = requiredAttentionStep === 3;
  const planIsMissing = showAccountRequiredErrors && !form.tier;
  const contactEmailIsInvalid = requiredAttentionStep === 3 && !hasValidEmail(form.email);
  const industryIsMissing = !findIndustry(form.category);
  const locationIsIncomplete = !hasCompleteListingLocation(form.location);

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
          if (form.sellProducts && listingId) {
            navigate(`/dashboard?products=${listingId}#products-services`, { replace: true });
          } else {
            setSubmitted(true);
          }
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
            <div className="flex flex-wrap items-center justify-center gap-3">
              {form.sellProducts && listingId && (
                <Button
                  to={`/dashboard?products=${listingId}#products-services`}
                  icon="ri-store-2-line"
                >
                  Add products to sell
                </Button>
              )}
              <Button to="/listings" variant={form.sellProducts && listingId ? "outline" : "primary"} icon="ri-arrow-right-line">
                Browse the directory
              </Button>
            </div>
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
      <div className="w-full border-b border-background-200/70 bg-background-50 px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-12">
        <div className={`${step === 1 ? "max-w-4xl" : step === 4 ? "max-w-2xl" : "max-w-3xl"} mx-auto`}>
          {isOnboarding && (
            <div className="mb-5 rounded-2xl border border-primary-200 bg-primary-50/80 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-background-50">
                  <i className="ri-store-2-line" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-800">Account created · Listing in progress</p>
                  <h1 className="mt-1 font-heading text-xl font-medium text-foreground-950">Now create your first listing</h1>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-600">Your progress saves automatically. Complete and submit this listing to open your dashboard.</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mb-2">
            {!isOnboarding && (
              <>
                <Link
                  className="text-xs font-label text-foreground-500 hover:text-foreground-800 cursor-pointer flex items-center gap-1"
                  to="/listings"
                >
                  <i className="ri-arrow-left-line" />
                  Directory
                </Link>
                <span className="text-foreground-300">/</span>
              </>
            )}
            <span className="text-xs font-label text-foreground-800 font-medium">
              {isEditing ? "Edit Listing" : isOnboarding ? "Create Your Free Listing" : "Submit a Listing"}
            </span>
          </div>
          <StepIndicator current={step} />
        </div>
      </div>

      <div className="w-full px-3 py-5 sm:px-4 sm:py-10 md:px-8 lg:px-12">
        {/* Step 4 (Preview) renders the real ListingProfile component, which
            expects the same max-w-7xl grid it gets on the live /listings/:slug
            page. Keeping this wrapper at the wizard's narrower max-w-3xl for
            that step squeezed the cover photo into a much smaller box than it
            actually gets on the live page, so the preview cropped/framed the
            image differently than reality — this wrapper now matches
            ListingProfile's own width on step 4 only, every other step keeps
            the narrower column that suits a form. */}
        <div className={step === 4 ? "max-w-7xl mx-auto" : step === 1 ? "max-w-4xl mx-auto" : "max-w-3xl mx-auto"}>
          {step === 1 && (
            <section className="mb-4 rounded-2xl border border-background-200/80 bg-background-50/80 p-4 shadow-[0_18px_50px_rgba(49,77,62,0.07)] sm:mb-6 sm:rounded-3xl sm:p-6 md:p-8">
              <h1 className="mb-2 font-heading text-2xl font-light leading-tight text-foreground-950 sm:mb-3 sm:text-3xl md:text-4xl">
                Create your <span className="text-accent-500 italic">listing</span>
              </h1>
              <p className="mb-6 text-xs text-foreground-600 font-label sm:mb-8 sm:text-sm">
                Get discovered on Connect767.
              </p>
              <div id="listingTier" tabIndex="-1" className="flex flex-wrap items-center gap-3 scroll-mt-28">
                <h2 className="font-heading text-xl font-light text-foreground-950 sm:text-2xl">
                  Choose your <span className="text-accent-500 italic">listing plan</span>
                </h2>
                <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-700">
                  Required
                </span>
              </div>
              <div className="mb-4 sm:mb-5" />
              <div className={`rounded-2xl transition-all ${planIsMissing ? "border-2 border-red-500 bg-red-50/40 p-3 ring-4 ring-red-200 shadow-[0_0_0_7px_rgba(254,202,202,0.45),0_16px_36px_rgba(220,38,38,0.14)]" : ""}`}>
                <ListingTierCards
                  compact
                  selectedTier={form.tier}
                  onSelect={(tier) => {
                    noteListingStarted();
                    setForm((f) => ({ ...f, tier }));
                  }}
                  className="w-full gap-3 sm:gap-4"
                />
              </div>
              {planIsMissing && (
                <p role="alert" className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                  <i className="ri-error-warning-fill" aria-hidden="true" /> Select a listing plan before continuing.
                </p>
              )}
              {!isEditing && !auth.isAuthenticated && !accountCreated && (
                <OwnerAccountPanel account={account} onChange={updateAccount} signInHref={signInHref} showRequiredErrors={showAccountRequiredErrors} />
              )}
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-background-200/80 bg-background-50/80 p-4 shadow-[0_18px_50px_rgba(49,77,62,0.07)] sm:rounded-3xl sm:p-6 md:p-8">
              <h1 className="mb-2 font-heading text-2xl font-light leading-tight text-foreground-950 sm:mb-3 sm:text-3xl md:text-4xl">
                Tell us about your <span className="text-accent-500 italic">listing</span>
              </h1>
              <p className="mb-6 text-xs text-foreground-600 font-label sm:mb-8 sm:text-sm">
                Add the details customers need.
              </p>
              <div className="space-y-4 sm:space-y-5">
                <FormField
                  label="Listing Name"
                  htmlFor="businessName"
                  required
                  error={showBusinessRequiredErrors && !form.businessName.trim() ? "Enter a listing name." : ""}
                >
                  <Input
                    id="businessName"
                    placeholder="e.g. Cocoa Palm Bistro or James Brown"
                    value={form.businessName}
                    onChange={update("businessName")}
                    error={showBusinessRequiredErrors && !form.businessName.trim()}
                    aria-invalid={showBusinessRequiredErrors && !form.businessName.trim()}
                    required
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField
                    label="Industry"
                    htmlFor="category"
                    required
                    error={showBusinessRequiredErrors && industryIsMissing ? "Select an industry to save it to your profile." : ""}
                  >
                    <Select
                      id="category"
                      value={form.category}
                      onChange={update("category")}
                      error={showBusinessRequiredErrors && industryIsMissing}
                      aria-invalid={showBusinessRequiredErrors && industryIsMissing}
                      className={showBusinessRequiredErrors && industryIsMissing ? "ring-4 ring-red-100 animate-pulse" : ""}
                      required
                    >
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
                  <FormField
                    label="Price tier"
                    required
                    hint="$ = Budget · $$ = Moderate · $$$ = Premium"
                    error={showBusinessRequiredErrors && !form.priceTier ? "Choose a price tier." : ""}
                  >
                    <div
                      id="priceTier"
                      tabIndex={showBusinessRequiredErrors && !form.priceTier ? -1 : undefined}
                      className={`flex gap-2 rounded-xl transition-all ${showBusinessRequiredErrors && !form.priceTier ? "border-2 border-red-500 bg-red-50/50 p-2 ring-4 ring-red-200 shadow-[0_0_0_6px_rgba(254,202,202,0.45),0_10px_24px_rgba(220,38,38,0.12)]" : ""}`}
                    >
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
                  <FormField label="Highest Degree Level" htmlFor="education">
                    <Select id="education" value={form.education} onChange={update("education")}>
                      <option value="">Select Highest Degree Level</option>
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
                    hint="Shown next to your Highest Degree Level"
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
                    error={showBusinessRequiredErrors && !hasValidRequiredYears(form.yearsExperience) ? "Enter a whole number from 0 to 80." : ""}
                  >
                    <Input
                      id="yearsExperience"
                      type="number"
                      min="0"
                      max="80"
                      placeholder="12"
                      value={form.yearsExperience}
                      onChange={update("yearsExperience")}
                      error={showBusinessRequiredErrors && !hasValidRequiredYears(form.yearsExperience)}
                      aria-invalid={showBusinessRequiredErrors && !hasValidRequiredYears(form.yearsExperience)}
                      required
                    />
                  </FormField>
                </div>
                <FormField
                  label="Description"
                  htmlFor="description"
                  required
                  hint="Drag the bottom-right corner to make this box bigger"
                  error={showBusinessRequiredErrors && !form.description.trim() ? "Describe the products or services offered." : ""}
                >
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="Describe goods or services offered"
                    value={form.description}
                    onChange={update("description")}
                    error={showBusinessRequiredErrors && !form.description.trim()}
                    aria-invalid={showBusinessRequiredErrors && !form.description.trim()}
                    required
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
                <FormField
                  label="Location"
                  htmlFor="location"
                  required
                  hint="Required: City/State/Parish and Country"
                  error={showBusinessRequiredErrors && locationIsIncomplete ? "Enter a city/state/parish and country." : ""}
                >
                  <Input
                    id="location"
                    placeholder="e.g. Roseau, Dominica"
                    value={form.location}
                    onChange={update("location")}
                    error={showBusinessRequiredErrors && locationIsIncomplete}
                    aria-invalid={showBusinessRequiredErrors && locationIsIncomplete}
                    required
                  />
                </FormField>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-background-200/80 bg-background-50/80 p-4 shadow-[0_18px_50px_rgba(49,77,62,0.07)] sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <h1 className="mb-2 font-heading text-2xl font-light text-foreground-950 sm:mb-3 sm:text-3xl md:text-4xl">
                Help customers <span className="text-accent-500 italic">connect</span>
              </h1>
              <p className="mb-6 text-xs text-foreground-600 font-label sm:mb-8 sm:text-sm">
                Add contact details, business tools, and profile images.
              </p>
              <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <FormField label="Phone" htmlFor="phone">
                    <Input
                      id="phone"
                      placeholder="+1 (767) 555-0100"
                      value={form.phone}
                      onChange={update("phone")}
                    />
                  </FormField>
                  <FormField label="Email" htmlFor="contactEmail" required error={contactEmailIsInvalid ? "Enter a valid contact email address." : ""}>
                    <Input
                      id="contactEmail"
                      placeholder="hello@yourbusiness.com"
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      error={contactEmailIsInvalid}
                      aria-invalid={contactEmailIsInvalid || undefined}
                      required
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
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

                <FormField label="Storefront products">
                  <div className="rounded-xl border border-background-300 bg-background-50 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-background-300 cursor-pointer"
                        checked={form.sellProducts}
                        onChange={(e) =>
                          setForm((current) => ({ ...current, sellProducts: e.target.checked }))
                        }
                      />
                      <span>
                        <span className="block text-sm font-semibold text-foreground-900">
                          Sell products from this listing
                        </span>
                        <span className="mt-0.5 hidden text-xs text-foreground-600 font-label sm:block">
                          Available to every listing. When you submit this listing, the product
                          editor will open automatically for photos, prices, inventory, shipping,
                          and local-pickup options.
                        </span>
                        <span className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-primary-800">
                          <i className="ri-information-line mt-0.5" aria-hidden="true" />
                          Payout information is required when accepting product payments online.
                        </span>
                      </span>
                    </label>
                    {isEditing && listingId && (
                      <Link
                        to={`/dashboard?products=${listingId}#products-services`}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800"
                      >
                        <i className="ri-store-2-line" />
                        Manage this listing&apos;s products now
                      </Link>
                    )}
                  </div>
                </FormField>

                {/* Bookings were listed as a Classified feature on the pricing
                    page and supported end-to-end in the CMS (booking_enabled
                    meta + class-rest-bookings.php), but no screen ever let an
                    owner switch it on. */}
                <div id="booking-settings" className="scroll-mt-28">
                  <FormField label="Bookings">
                    <label className="flex items-start gap-3 p-4 rounded-lg border border-background-300 hover:border-primary-300 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-background-300 cursor-pointer"
                        checked={form.bookingEnabled}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            bookingEnabled: e.target.checked,
                            hideContactInfo:
                              e.target.checked && Number(f.bookingPrice) > 0,
                          }))
                        }
                      />
                      <span>
                        <span className="block text-sm font-semibold text-foreground-900">
                          Accept bookings and appointments
                        </span>
                        <span className="mt-0.5 hidden text-xs text-foreground-600 font-label sm:block">
                          Adds a secure booking form to your profile. Set a price for automatic
                          Stripe/PayPal confirmation, or leave it at $0 for owner approval.
                        </span>
                        <span className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-primary-800">
                          <i className="ri-information-line mt-0.5" aria-hidden="true" />
                          Payout information is required when accepting booking payments online.
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
                        <Select id="bookingType" value={form.bookingType} onChange={(event) => setForm((current) => ({
                          ...current,
                          bookingType: event.target.value,
                          bookingRentalRateUnit: bookingRateUnit(event.target.value),
                        }))}>
                          {form.bookingType === "rental" && <option value="rental">Rental stay (existing listing)</option>}
                          {bookingTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </FormField>
                    </div>
                    {isRentalBookingType(form.bookingType) && (
                      <FormField
                        label="Base billing period"
                        htmlFor="bookingRentalRateUnit"
                        hint="This is how your standard rate is charged and how the final booking total is calculated."
                      >
                        <Select id="bookingRentalRateUnit" value={normalizeRentalRateUnit(form.bookingRentalRateUnit, form.bookingType)} onChange={update("bookingRentalRateUnit")}>
                          {rentalRateUnitOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </FormField>
                    )}
                    <FormField
                      label={isRentalBookingType(form.bookingType)
                        ? `${bookingRateLabel(form.bookingType, form.bookingRentalRateUnit)} rate (USD)`
                        : form.bookingPriceUnit === "minute"
                          ? "Price per minute (USD)"
                          : form.bookingPriceUnit === "hour"
                            ? "Price per hour (USD)"
                            : "Fixed meeting price (USD)"}
                      htmlFor="bookingPrice"
                      hint={isRentalBookingType(form.bookingType)
                        ? `The total is calculated from the number of ${normalizeRentalRateUnit(form.bookingRentalRateUnit, form.bookingType)}s`
                        : "Enter 0 for a free booking request"}
                    >
                      <Input
                        id="bookingPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.bookingPrice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            bookingPrice: e.target.value,
                            hideContactInfo: Number(e.target.value) > 0,
                          }))
                        }
                        placeholder="0.00"
                      />
                    </FormField>
                    {!isRentalBookingType(form.bookingType) && <>
                      <FormField label="Meeting pricing" htmlFor="bookingPriceUnit" hint="Charge one fixed price, by the minute, or by the hour.">
                        <Select id="bookingPriceUnit" value={form.bookingPriceUnit} onChange={update("bookingPriceUnit")}>
                          <option value="appointment">Fixed price per meeting</option>
                          <option value="minute">Price per minute</option>
                          <option value="hour">Price per hour</option>
                        </Select>
                      </FormField>
                      <FormField label="Minimum meeting length" htmlFor="bookingDurationMinutes">
                        <Select id="bookingDurationMinutes" value={form.bookingDurationMinutes} onChange={(event) => setForm((current) => ({
                          ...current,
                          bookingDurationMinutes: event.target.value,
                          bookingMaxDurationMinutes: String(Math.max(Number(event.target.value), Number(current.bookingMaxDurationMinutes) || 0)),
                        }))}>
                          <option value="15">15 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">1 hour</option>
                        </Select>
                      </FormField>
                      <FormField label="Maximum meeting length" htmlFor="bookingMaxDurationMinutes" hint="Visitors choose in 15-minute increments.">
                        <Select id="bookingMaxDurationMinutes" value={form.bookingMaxDurationMinutes} onChange={update("bookingMaxDurationMinutes")}>
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="90">1 hour 30 minutes</option>
                          <option value="120">2 hours</option>
                          <option value="180">3 hours</option>
                          <option value="240">4 hours</option>
                          <option value="480">8 hours</option>
                        </Select>
                      </FormField>
                    </>}
                    <BookingRateEditor
                      basePriceCents={Math.max(0, Math.round((Number(form.bookingPrice) || 0) * 100))}
                      rules={form.bookingRateRules}
                      billingPeriod={isRentalBookingType(form.bookingType)
                        ? normalizeRentalRateUnit(form.bookingRentalRateUnit, form.bookingType)
                        : form.bookingPriceUnit}
                      rateLabel={isRentalBookingType(form.bookingType)
                        ? `${bookingRateLabel(form.bookingType, form.bookingRentalRateUnit).toLowerCase()} rate`
                        : form.bookingPriceUnit === "minute"
                          ? "per-minute rate"
                          : form.bookingPriceUnit === "hour"
                            ? "hourly rate"
                            : "appointment rate"}
                      onChange={(bookingRateRules) => setForm((current) => ({ ...current, bookingRateRules }))}
                      onSave={saveSpecialRates}
                    />
                    {(Number(form.bookingPrice) > 0 || form.bookingRateRules.some((rule) => Number(rule.priceCents) > 0)) && (
                      <div
                        className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
                        role="note"
                        aria-label="Paid booking privacy notice"
                      >
                        <i className="ri-information-line mt-0.5 text-lg text-amber-700" />
                        <div>
                          <p className="text-sm font-semibold text-amber-950">
                            Paid booking privacy notice
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-900 font-label">
                            When paid bookings are active, all public contact information—including
                            your phone, email, address, website, WhatsApp and social media links—will
                            be hidden. Customers can still contact you through Message Listing Owner
                            or Connect767&apos;s secure booking form. Your details remain saved privately
                            in your account.
                          </p>
                        </div>
                      </div>
                    )}
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
                    </div>
                  )}
                  {(form.bookingEnabled || form.sellProducts) && (
                    <div className="mt-5">
                      <PayoutSettingsFields
                        form={form}
                        onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
                        forceVisible={form.sellProducts}
                        context={form.sellProducts ? (form.bookingEnabled && hasPaidBookingRate(form) ? "combined" : "storefront") : "booking"}
                        showRequiredErrors={showPayoutRequiredErrors}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start">
                  <FormField
                    label="Profile Photo"
                    hint="Your account photo, shared across all listings."
                  >
                    {!form.logoPreview ? (
                      <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-full border-2 border-dashed border-background-300 bg-background-100/40 text-center transition-colors hover:border-primary-400">
                          <>
                            <i className="ri-image-add-line text-xl text-foreground-400" />
                            <span className="text-[11px] text-foreground-500 font-label px-3 leading-tight">
                              Upload photo
                            </span>
                          </>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoPhotoChange}
                        />
                      </label>
                    ) : (
                      <>
                        <PositionPicker
                          src={form.logoPreview}
                          shape="logo"
                          position={form.logoPosition}
                          zoom={form.logoZoom}
                          onPositionChange={(value) =>
                            setForm((f) => ({ ...f, logoPosition: value }))
                          }
                          onZoomChange={(value) => setForm((f) => ({ ...f, logoZoom: value }))}
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-800">
                            <i className="ri-image-edit-line text-base" aria-hidden="true" />
                            Change photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoPhotoChange}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((current) => {
                                if (current.logoPreview?.startsWith("blob:")) {
                                  URL.revokeObjectURL(current.logoPreview);
                                }
                                return { ...current, logoFile: null, logoPreview: "" };
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                          >
                            <i className="ri-delete-bin-line text-base" aria-hidden="true" />
                            Remove photo
                          </button>
                        </div>
                      </>
                    )}
                  </FormField>
                  <FormField
                    label="Cover photo"
                    hint="Recommended exact fit: 1600 × 900 px or 1500 × 844 px (16:9), max 2 MB. Use Reposition for a full-bleed cover or Full image to avoid cropping."
                  >
                    {!form.photoPreview ? (
                      <div className="relative w-full group">
                        <label className="relative flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-background-300 text-center transition-colors hover:border-primary-400 cursor-pointer">
                          <>
                            <i className="ri-image-add-line text-2xl text-foreground-400" />
                            <span className="text-sm text-foreground-600 font-label">
                              Click to upload a photo
                            </span>
                          </>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleCoverPhotoChange}
                          />
                      </label>
                      </div>
                    ) : (
                      <>
                        <PositionPicker
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
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-800">
                            <i className="ri-image-edit-line text-base" aria-hidden="true" />
                            Change photo
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={handleCoverPhotoChange}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((current) => {
                                if (current.photoPreview?.startsWith("blob:")) {
                                  URL.revokeObjectURL(current.photoPreview);
                                }
                                return { ...current, photoFile: null, photoPreview: "" };
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                          >
                            <i className="ri-delete-bin-line text-base" aria-hidden="true" />
                            Remove photo
                          </button>
                        </div>
                      </>
                    )}
                    {coverPhotoError && (
                      <div
                        role="alert"
                        className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                      >
                        <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
                        <span>{coverPhotoError}</span>
                      </div>
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
            </section>
          )}

          {step === 4 && (
            <div className="mx-auto max-w-2xl">
              <h1 className="mb-2 font-heading text-2xl font-light text-foreground-950 sm:mb-3 sm:text-3xl md:text-4xl">
                Review your <span className="text-accent-500 italic">listing</span>
              </h1>
              <p className="mb-6 hidden text-xs text-foreground-600 font-label sm:mb-10 sm:block sm:text-sm">
                Make sure everything looks right before submitting.
              </p>
              <div className="space-y-3 rounded-2xl border border-background-200/70 bg-background-100/40 p-4 sm:p-5">
                {/* Tier is changeable right here at the end. Previously it was
                    locked in at step 1, so anyone who reconsidered after
                    seeing their finished listing had to abandon the form and
                    start over. */}
                <div className="border-b border-background-200/70 pb-3">
                  <span className="mb-2 block text-sm font-semibold text-foreground-800">Tier</span>
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
                  ["Highest Degree Level", form.education || "—"],
                  ["Degree Type", form.degreeType || "—"],
                  ["Years of Experience", form.yearsExperience ? `${form.yearsExperience}` : "—"],
                  ["Location", form.location || "—"],
                  ["Phone", form.phone || "—"],
                  ["Email", form.email || "—"],
                  ["Website", form.website || "—"],
                  ["Storefront", form.sellProducts ? "Add products after saving" : "No products selected"],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[minmax(7.5rem,0.7fr)_minmax(0,1fr)] items-start gap-x-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-4">
                    <span className="text-foreground-600 font-label">{label}</span>
                    <span className="min-w-0 break-words font-semibold text-foreground-900 font-label">
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
                <div className="border-t border-background-200/70 pt-3">
                  <span className="mb-2 block text-sm text-foreground-600 font-label">Images</span>
                  <div className="flex flex-wrap items-start gap-4">
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
                          <div className="w-40 aspect-[16/9] rounded-lg overflow-hidden border border-background-200/70 bg-background-100">
                          <img
                            src={form.photoPreview}
                            alt="Cover"
                            className={`h-full w-full ${form.coverFit === "cover" ? "object-cover" : "object-contain"}`}
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
                  <div className="border-t border-background-200/70 pt-3">
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

                <div className="flex justify-end border-t border-background-200/70 pt-4">
                  <Button
                    type="button"
                    variant="accent"
                    onClick={handleSubmit}
                    disabled={submitting}
                    icon="ri-check-line"
                  >
                    {submitting
                      ? "Saving…"
                      : isEditing
                        ? "Save changes"
                        : form.sellProducts
                          ? "Save listing & add product"
                          : "Submit Listing"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <details className="group mt-6">
              <summary className="mx-auto flex max-w-2xl cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border-2 border-primary-200 bg-gradient-to-r from-primary-50 to-background-50 px-4 py-4 text-base font-semibold text-primary-900 shadow-[0_12px_30px_rgba(23,84,55,0.12)] transition hover:border-primary-300 hover:shadow-[0_16px_34px_rgba(23,84,55,0.16)] sm:px-5">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-700 text-background-50 shadow-sm">
                    <i className="ri-eye-line text-lg" aria-hidden="true" />
                  </span>
                  Preview Profile
                </span>
                <i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              {/* ListingProfile remains the real production component. The
                  redesign only collapses it until the owner chooses to view
                  it; no preview behavior or data mapping is replaced. */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-background-200/70 bg-background-50">
                <ListingProfile data={buildPreviewData(form)} isPreview />
              </div>
            </details>
          )}

          {step === 4 && !isEditing && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-4 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-background-50">
                <i className="ri-mail-check-line" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-heading text-lg font-medium text-primary-950">What happens next?</h2>
                <p className="mt-1 text-xs leading-relaxed text-foreground-700 sm:text-sm">
                  We&apos;ll review your listing and email you when it goes live.
                </p>
              </div>
            </div>
          )}

          {step === 4 && !isLiveApi && <DemoModeNotice className="mt-6" />}

          {step === 4 && form.sellProducts && !isEditing && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50/80 px-4 py-4 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-background-50">
                <i className="ri-store-2-line" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-800">Next: list your first product</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground-700">
                  Saving this listing will take you directly to the product editor with this storefront selected.
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div role="alert" className="mt-6 flex items-start gap-2 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-[0_0_0_5px_rgba(254,202,202,0.35)]">
              <i className="ri-error-warning-fill mt-0.5 text-red-600" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div
            id="listing-wizard-actions"
            className={`mt-6 flex items-center sm:mt-10 ${step === 4 ? "mx-auto max-w-2xl justify-start" : "justify-between"}`}
          >
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
            {step < 4 ? (
              <Button
                type="button"
                variant="primary"
                onClick={goNext}
                icon="ri-arrow-right-line"
                title={!canContinue() ? "Complete the highlighted required fields to continue" : undefined}
                className={!canContinue() ? "hover:ring-4 hover:ring-red-100" : ""}
              >
                Continue
              </Button>
            ) : null}
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
