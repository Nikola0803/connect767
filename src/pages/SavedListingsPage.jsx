import { Link } from "react-router-dom";
import { useSavedListings } from "../hooks/useSavedListings";
import Button from "../components/ui/Button";

/**
 * Where the heart/"Save" button on a listing profile (ListingProfile.jsx)
 * actually leads — without this, saving a listing had no visible result
 * anywhere, which made the button feel broken even once it was wired up.
 * Purely client-side (see useSavedListings.jsx), so this works the same
 * whether or not the visitor is logged in.
 */
export default function SavedListingsPage() {
  const { items } = useSavedListings();

  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-14 bg-background-100/50 border-b border-background-200/70">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium mb-3">
            <i className="ri-heart-fill" />
            Saved
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
            Your saved listings
          </h1>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-background-300 p-10 text-center">
              <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-background-100 text-foreground-400 mb-4">
                <i className="ri-heart-line text-xl" />
              </div>
              <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1.5">
                Nothing saved yet
              </h3>
              <p className="text-sm text-foreground-600 max-w-sm mx-auto mb-5">
                Tap the heart on any listing profile to keep it here for later.
              </p>
              <Button to="/listings" variant="primary" icon="ri-compass-3-line">
                Browse the directory
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((item) => (
                <Link
                  key={item.slug}
                  to={`/listings/${item.slug}`}
                  className="group bg-background-50 rounded-2xl border border-background-200/70 overflow-hidden hover:border-primary-300 transition-colors flex flex-col cursor-pointer"
                >
                  <div className="w-full h-40 bg-background-100 flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img
                        alt={item.title}
                        src={item.image}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <i className="ri-store-2-line text-3xl text-foreground-300" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-foreground-500 font-label mb-1">{item.category}</p>
                    <h3 className="font-heading text-base font-medium text-foreground-950 group-hover:text-primary-700 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
