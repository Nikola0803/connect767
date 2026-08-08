/**
 * Shared closed-set choices for the per-listing "Education" and "Level of
 * experience" fields — single source of truth for AddListingPage.jsx's
 * submission wizard AND DirectoryPage.jsx's search filters, so the two can
 * never drift apart. Must stay in sync with the whitelists in
 * connect767-cms's class-rest-listings.php
 * (sanitize_education()/sanitize_experience_level()) — the backend rejects
 * anything that isn't an exact match against its own copy of these same
 * lists. (These fields used to live on the owner's user account, set once
 * at signup — moved to be per-listing so an account with several listings
 * can show different credentials on each one.)
 */
export const EDUCATION_CHOICES = [
  "High School Diploma",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD",
  "Post Graduate",
  "Professional Certificate",
  "Other",
];

export const EXPERIENCE_CHOICES = ["0-5 years", "5-10 years", "10-15 years", "15-20 years", "20+ years"];
