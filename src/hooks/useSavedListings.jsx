import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * "Save"/heart button on a listing profile (ListingProfile.jsx) — same
 * localStorage-persisted pattern as useCart.jsx, so a save survives a page
 * refresh instead of disappearing the moment you navigate away. There's no
 * backend concept of a saved listing (it's guest-friendly, no login
 * required), so this is entirely client-side, keyed by slug.
 */
const SavedListingsContext = createContext(null);
const STORAGE_KEY = "c767_saved_listings";

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SavedListingsProvider({ children }) {
  const [items, setItems] = useState(loadPersisted);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* localStorage unavailable — saves just won't survive a refresh */
    }
  }, [items]);

  const isSaved = (slug) => items.some((i) => i.slug === slug);

  const toggleSaved = (listing) => {
    if (!listing?.slug) return;
    setItems((prev) =>
      prev.some((i) => i.slug === listing.slug)
        ? prev.filter((i) => i.slug !== listing.slug)
        : [
            ...prev,
            {
              slug: listing.slug,
              title: listing.title,
              category: listing.category,
              image: listing.image || listing.gallery?.[0]?.src || "",
            },
          ]
    );
  };

  const count = useMemo(() => items.length, [items]);

  const value = { items, count, isSaved, toggleSaved };
  return <SavedListingsContext.Provider value={value}>{children}</SavedListingsContext.Provider>;
}

export function useSavedListings() {
  const ctx = useContext(SavedListingsContext);
  if (!ctx) throw new Error("useSavedListings must be used within a SavedListingsProvider");
  return ctx;
}
