const REQUIRED_KEY = "c767_listing_onboarding_required";
const DRAFT_KEY = "c767_listing_onboarding_draft";

const storageAvailable = () => typeof window !== "undefined" && Boolean(window.localStorage);

export function requireListingOnboarding() {
  if (!storageAvailable()) return;
  window.localStorage.setItem(REQUIRED_KEY, "1");
}

export function listingOnboardingRequired() {
  if (!storageAvailable()) return false;
  return window.localStorage.getItem(REQUIRED_KEY) === "1";
}

export function completeListingOnboarding() {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(REQUIRED_KEY);
  window.localStorage.removeItem(DRAFT_KEY);
}

export function saveListingOnboardingDraft(form) {
  if (!storageAvailable()) return;

  const serializable = { ...form };
  [
    "logoFile",
    "logoPreview",
    "photoFile",
    "photoPreview",
    "galleryFiles",
    "galleryPreviews",
  ].forEach((key) => delete serializable[key]);

  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable));
  } catch {
    // Draft persistence is optional and must never block the listing form.
  }
}

export function getListingOnboardingDraft() {
  if (!storageAvailable()) return null;
  try {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

