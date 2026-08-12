import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { categoryTaxonomy, findIndustry } from "../data/industries";
import { EDUCATION_CHOICES } from "../data/profileChoices";
import {
  submitListing,
  updateListing,
  getListingBySlug,
  getCheckoutConfig,
  createListingPaymentIntent,
  confirmListingPayment,
  createListingPaypalOrder,
  captureListingPaypalOrder,
} from "../data/repository";
import { getStripe } from "../lib/stripeClient";
import Button from "../components/ui/Button";
import TierBadge from "../components/ui/TierBadge";
import DemoModeNotice from "../components/DemoModeNotice";
import ListingProfile from "../components/ListingProfile";
import PaypalButton from "../components/PaypalButton";
import { FormField, Input, Select, Textarea } from "../components/ui/FormField";
import PositionPicker from "../components/ui/PositionPicker";
import { Spinner, ErrorState } from "../components/ui/States";
import { isLiveApi } from "../lib/config";
import { imageCropStyle } from "../lib/imagePosition";

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
  galleryFiles: [],
  galleryPreviews: [],
  bookingEnabled: false,
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
    amenities: [],
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
  const isEditing = Boolean(editSlug);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
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
          photoPreview: data.coverPhoto || "",
          coverPosition: data.coverPosition || "center",
          coverZoom: data.coverZoom || 1,
          // gallery[0] is the cover once mapListingDetail prepends it, so the
          // gallery previews start after it.
          galleryPreviews: (data.gallery || [])
            .filter((g) => g.src && g.src !== data.coverPhoto)
            .map((g) => g.src),
        }));
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
        form.yearsExperience
      );
    if (step === 3) return form.email.trim();
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
        <div className={step === 5 ? "max-w-7xl mx-auto" : "max-w-3xl mx-auto"}>
          {step === 1 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Choose your <span className="text-accent-500 italic">listing tier</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-10">
                Free listings are a great way to get started. Upgrade to Classified anytime for
                premium placement and tools.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tier: "free" }))}
                  className={`text-left p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    form.tier === "free"
                      ? "border-primary-500 bg-primary-50/50 ring-2 ring-primary-200"
                      : "border-background-200/70 bg-background-50 hover:border-background-400"
                  }`}
                >
                  <div className="flex items-start justify-end mb-4">
                    <span className="text-2xl font-heading font-semibold text-foreground-950">
                      $0
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Booking module enabled",
                      "Pricing module enabled",
                      "One listing",
                      "24/7 support",
                    ].map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-foreground-700 font-label"
                      >
                        <i className="ri-check-line mt-0.5 text-secondary-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 h-1.5 rounded-full w-full bg-secondary-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        form.tier === "free" ? "bg-secondary-500 w-full" : "w-0"
                      }`}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tier: "classified" }))}
                  className={`text-left p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    form.tier === "classified"
                      ? "border-primary-500 bg-primary-50/50 ring-2 ring-primary-200"
                      : "border-background-200/70 bg-background-50 hover:border-background-400"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary-500 text-background-50">
                      <i className="ri-vip-crown-line" />
                      Classified
                    </span>
                    <span className="text-2xl font-heading font-semibold text-foreground-950">
                      $40/yr
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Booking & pricing modules enabled",
                      "Up to 15 listings",
                      "Premium website placement (up to 3 months)",
                      "Biography highlight (provided by client)",
                      "Featured on \"Trending Listings\"",
                      "Shared on all Connect767 social handles",
                    ].map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-foreground-700 font-label"
                      >
                        <i className="ri-check-line mt-0.5 text-primary-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 h-1.5 rounded-full w-full bg-primary-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        form.tier === "classified" ? "bg-primary-500 w-full" : "w-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
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
                <FormField label="Business name" htmlFor="businessName" required>
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
                  <FormField label="Price tier" required>
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
                    hint="Shown on your profile, e.g. 12 Years of Experience"
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
                <FormField label="Location" htmlFor="location">
                  <Input
                    id="location"
                    placeholder="e.g. Roseau, Dominica"
                    value={form.location}
                    onChange={update("location")}
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
                        Accept booking requests
                      </span>
                      <span className="block text-xs text-foreground-600 font-label mt-0.5">
                        Adds a &ldquo;Request a booking&rdquo; form to your profile. Requests arrive
                        by email and in your dashboard — nothing is charged or confirmed
                        automatically.
                      </span>
                    </span>
                  </label>
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
                  <FormField label="Logo / profile picture">
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
                    hint="This is the main image shown on your listing card and profile — shown here at roughly the same proportions as your live profile page"
                  >
                    <div className="relative w-full group">
                      <label className="relative flex flex-col items-center justify-center gap-2 w-full aspect-[16/9] rounded-lg border-2 border-dashed border-background-300 hover:border-primary-400 cursor-pointer transition-colors text-center overflow-hidden">
                        {form.photoPreview ? (
                          <img
                            src={form.photoPreview}
                            alt="Cover photo preview"
                            className="absolute inset-0 w-full h-full object-cover"
                            style={imageCropStyle(form.coverPosition, form.coverZoom)}
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
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setForm((f) => ({
                              ...f,
                              photoFile: file,
                              photoPreview: URL.createObjectURL(file),
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
                    {form.photoPreview && (
                      <PositionPicker
                        label="Position"
                        src={form.photoPreview}
                        shape="cover"
                        position={form.coverPosition}
                        zoom={form.coverZoom}
                        onPositionChange={(value) =>
                          setForm((f) => ({ ...f, coverPosition: value }))
                        }
                        onZoomChange={(value) => setForm((f) => ({ ...f, coverZoom: value }))}
                      />
                    )}
                  </FormField>
                </div>
                <FormField
                  label="Gallery"
                  hint="Add as many photos as you'd like — shown on your profile page"
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
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-foreground-800">Tier</span>
                    <div className="flex items-center gap-2">
                      <TierBadge tier={form.tier === "classified" ? "Classified" : "Free"} />
                      <span className="text-xs text-foreground-500 font-label">
                        {form.tier === "classified" ? "$40/yr" : "$0"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "free", label: "Free", price: "$0" },
                      { key: "classified", label: "Classified", price: "$40/yr" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, tier: t.key }))}
                        className={`px-3 py-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          form.tier === t.key
                            ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                            : "border-background-300 bg-background-50 hover:border-primary-300"
                        }`}
                      >
                        <span className="block text-xs font-semibold text-foreground-900">
                          {t.label}
                        </span>
                        <span className="block text-[11px] text-foreground-500 font-label">
                          {t.price}
                        </span>
                      </button>
                    ))}
                  </div>
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
                            className="w-full h-full object-cover"
                            style={imageCropStyle(form.coverPosition, form.coverZoom)}
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
